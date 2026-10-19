// Renders icons/icon.svg to the PNG sizes the manifest and iOS need.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const svg = await readFile(new URL("../icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
