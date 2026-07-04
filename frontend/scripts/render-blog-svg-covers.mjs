import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.resolve(__dirname, "../public/blog");
const SIZE = { width: 1200, height: 630 };

const INPUTS = [
  "blog-cover-biggest-update-magazine-captions-custom-templates",
  "blog-cover-stock-visualizer",
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function main() {
  const executablePath = await resolveExecutablePath();
  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    headless: true,
    args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars", "--lang=en-US"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ ...SIZE, deviceScaleFactor: 1 });

    for (const baseName of INPUTS) {
      const svgPath = path.join(BLOG_DIR, `${baseName}.svg`);
      const pngPath = path.join(BLOG_DIR, `${baseName}.png`);
      const svg = await fs.readFile(svgPath, "utf8");

      await page.setContent(
        `<html><body style="margin:0;background:transparent"><div id="capture-root" style="width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden">${svg}</div></body></html>`,
        { waitUntil: "load" }
      );

      const el = await page.$("#capture-root");
      if (!el) {
        throw new Error(`Capture root missing for ${baseName}`);
      }

      await el.screenshot({ path: pngPath, type: "png" });
      console.log(`Rendered ${path.basename(pngPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
