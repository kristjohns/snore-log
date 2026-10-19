// Runs YAMNet over the ESC-50 clips in test/audio and prints per-clip snoring scores.
// Usage: node test/run-classify.mjs   (serves the project on a local port itself)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".wav": "audio/wav" };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
await page.goto(`http://localhost:${port}/test/classify.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const clips = (await readdir(join(root, "test/audio"))).filter((f) => f.endsWith(".wav")).sort();
const rows = [];
for (const f of clips) {
  const frames = await page.evaluate((u) => window.classifyUrl(u), `/test/audio/${f}`);
  const scores = frames.map((x) => x.snore);
  const max = Math.max(...scores);
  const label = f.split("--")[0];
  rows.push({ f, label, max, frames });
  const hits = (t) => scores.filter((s) => s >= t).length;
  console.log(
    `${label.padEnd(16)} max=${max.toFixed(2)} >=.1:${hits(0.1)} >=.2:${hits(0.2)} >=.3:${hits(0.3)} /${scores.length}  ${frames.map((x) => x.top[0]).slice(0, 3).join(" | ")}`
  );
}
await mkdir(join(root, "test/results"), { recursive: true });
await writeFile(join(root, "test/results/classify.json"), JSON.stringify(rows, null, 1));
const ms = rows.flatMap((r) => r.frames.map((x) => x.ms));
console.log(`\ninference ms: mean ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)}, max ${Math.max(...ms).toFixed(1)}, results/call ${rows[0].frames[0].results}, snore index ${rows[0].frames[0].snoreIndex}`);
await browser.close();
server.close();
