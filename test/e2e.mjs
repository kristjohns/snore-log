// End-to-end run of a whole (short) night in headless Chromium, using a WAV file
// as the microphone. Takes as long as the night plus about a minute.
// Usage: python3 test/make-night.py test/results/night.wav && node test/e2e.mjs
//        NIGHT=night-short.wav NIGHT_SECONDS=100 node test/e2e.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "test/results");
const NIGHT_SECONDS = Number(process.env.NIGHT_SECONDS || 300);
const types = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json",
};
const server = createServer(async (req, res) => {
  try {
    let path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (path.endsWith("/")) path += "index.html";
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${join(out, process.env.NIGHT || "night.wav")}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
await context.grantPermissions(["microphone"], { origin: url });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
// MediaPipe logs its start-up notes as errors; those start with "INFO:".
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && problems.push(`console: ${m.text()}`));
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

await page.goto(url);
await page.waitForSelector("#model-status.is-ready", { timeout: 90000 });
log("detector ready");
await shot("01-tonight");

await page.click('#tonight-tags .chip:has-text("Alcohol")');
await page.click("#start");
await page.waitForSelector("#recording:not([hidden])");
log("recording");
await page.waitForTimeout(8000);
await shot("02-recording");
await page.waitForTimeout((NIGHT_SECONDS / 2 - 8) * 1000);
log("mid-night:", await page.textContent("#rec-meta"));
await page.waitForTimeout(Math.max(NIGHT_SECONDS / 4, 16) * 1000);
await shot("03-recording-dim");
await page.waitForTimeout((NIGHT_SECONDS / 4 + 4) * 1000);
log("end:", await page.textContent("#rec-meta"));

await page.dispatchEvent("#hold-stop", "pointerdown");
await page.waitForSelector("#view-night:not([hidden])", { timeout: 10000 });
await page.waitForTimeout(1500);
await shot("04-report");
const report = await page.evaluate(() => ({
  hero: document.querySelector("#night-hero").innerText,
  stats: document.querySelector("#night-stats").innerText,
  legend: document.querySelector("#night-legend").innerText,
  clips: [...document.querySelectorAll("#clips li")].map((li) => li.innerText.replace(/\s+/g, " ")),
  sounds: document.querySelector("#sounds").innerText,
  tags: [...document.querySelectorAll('#night-tags .chip[aria-pressed="true"]')].map((c) => c.textContent),
}));
log("report", JSON.stringify(report, null, 1));

// Tap a column of the timeline to see its tooltip.
const box = await page.locator("#night-chart svg").boundingBox();
await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.5);
await page.waitForTimeout(300);
await page.locator("#night-chart").screenshot({ path: join(out, "05-timeline-tip.png") });
if (report.clips.length && !report.clips[0].includes("No ")) {
  await page.click("#clips .play");
  await page.waitForTimeout(1500);
  log("clip progress", await page.$eval("#clips .clip-progress span", (s) => s.style.width));
}

await page.click('.tabbar button[data-go="history"]');
await page.waitForTimeout(800);
await shot("06-history");
await page.click('.tabbar button[data-go="settings"]');
await page.waitForTimeout(500);
await shot("07-settings");
await page.click('.tabbar button[data-go="tonight"]');
await page.waitForTimeout(800);
await shot("08-tonight-after");
await page.click("#open-check");
await page.waitForTimeout(6000);
await shot("09-mic-test");
log("mic test:", await page.textContent("#check-label"), await page.textContent("#check-snore"));
await page.click("#check-close");

await writeFile(join(out, "e2e-report.json"), JSON.stringify({ report, problems }, null, 1));
log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no page errors");
await browser.close();
server.close();
