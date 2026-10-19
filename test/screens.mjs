// Seeds two weeks of simulated nights and screenshots every screen at iPhone size.
// Usage: node test/screens.mjs   (screenshots land in test/results/screen-*.png)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "test/results");
const types = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  try {
    let path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (path.endsWith("/")) path += "index.html";
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: process.env.LOCALE || "en-US",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
await context.grantPermissions(["microphone"], { origin: url });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && problems.push(`console: ${m.text()}`));
const shot = (name, fullPage = false) => page.screenshot({ path: join(out, `screen-${name}.png`), fullPage });

await page.goto(url);
await page.evaluate(async () => {
  const { NightAnalyzer, summarize } = await import("/js/analysis.js");
  const db = await import("/js/db.js");
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tagSets = [["Alcohol"], [], ["Nasal strip"], ["Alcohol", "Late meal"], [], ["Blocked nose"], ["Nasal strip"], [], ["Alcohol"], ["Side sleeping"], [], ["Nasal strip"], ["Late meal"], []];
  const today = new Date();
  for (let d = tagSets.length; d >= 1; d--) {
    const tags = tagSets[d - 1];
    const start = new Date(today);
    start.setDate(today.getDate() - d);
    start.setHours(22 + Math.floor(rand() * 2), Math.floor(rand() * 60), 0, 0);
    const minutes = 400 + Math.floor(rand() * 90);
    const heavy = tags.includes("Alcohol") ? 2.2 : tags.includes("Nasal strip") ? 0.4 : 1;
    // Snoring episodes: start minute, length, loudness above room.
    const episodes = [];
    for (let i = 0; i < 4 + Math.floor(rand() * 4); i++) {
      episodes.push([30 + Math.floor(rand() * (minutes - 60)), Math.floor((5 + rand() * 30) * heavy), 8 + rand() * 24 * Math.min(heavy, 1.5)]);
    }
    const gapAt = d === 3 ? [180, 205] : null;
    const a = new NightAnalyzer();
    for (let k = 1; k < minutes * 600; k++) {
      const t = k / 10;
      const min = t / 60;
      if (gapAt && min >= gapAt[0] && min < gapAt[1]) continue;
      const ep = episodes.find(([s, len]) => min >= s && min < s + len);
      const snoring = ep && t % 4.5 < 1.6;
      a.level(t, snoring ? -60 + ep[2] : -60 + rand());
      if (k % 5 === 0) {
        const cough = rand() < 0.0004;
        a.frame(t, snoring ? 0.85 : 0.01, snoring ? "Snoring" : cough ? "Cough" : "Silence", 0.8);
        if (cough) for (let j = 1; j <= 3; j++) a.level(t + j / 100, -30);
      }
    }
    a.finish();
    const night = { id: String(start.getTime()), start: start.getTime(), end: start.getTime() + minutes * 60000, status: "done", tags, note: "", sensitivity: "normal", minutes: a.minutes };
    night.lastBeat = night.end;
    night.summary = summarize(night);
    await db.putNight(night);
  }
});
await page.reload();
await page.waitForSelector("#model-status.is-ready", { timeout: 90000 });
await page.click("#install-dismiss");
await page.click("#checklist summary");
await shot("tonight");
await page.click("#last-night");
await page.waitForTimeout(600);
await shot("report", true);
const chart = await page.locator("#night-chart svg").boundingBox();
await page.mouse.click(chart.x + chart.width * 0.55, chart.y + chart.height * 0.6);
await page.waitForTimeout(300);
await page.locator("#night-chart").scrollIntoViewIfNeeded();
await shot("report-tip");
await page.click('.tabbar button[data-go="history"]');
await page.waitForTimeout(600);
await shot("history", true);
await page.click('.tabbar button[data-go="settings"]');
await page.waitForTimeout(400);
await shot("settings", true);
await page.click('.tabbar button[data-go="tonight"]');
await page.click("#start");
await page.waitForSelector("#recording:not([hidden])");
await page.waitForTimeout(3000);
await shot("recording");
await page.dispatchEvent("#hold-stop", "pointerdown");
await page.waitForTimeout(2000);
await shot("after-short-night");
console.log(problems.length ? problems.join("\n") : "no page errors");
await browser.close();
server.close();
