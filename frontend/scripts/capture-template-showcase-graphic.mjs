import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import puppeteer from "puppeteer-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const outputPath = path.resolve(
  frontendDir,
  "public/assets/blog2video-template-showcase-code-accurate-1280x800.png",
);

let server;
let browser;

try {
  server = await createServer({ root: frontendDir, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls?.local?.[0];
  if (!base) throw new Error("Vite did not expose a local URL");

  browser = await puppeteer.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base.replace(/\/$/, "")}/assets/blog2video-template-code-accurate.html`, {
    waitUntil: "networkidle0",
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  const canvas = await page.$("#canvas");
  if (!canvas) throw new Error("#canvas was not found");
  await canvas.screenshot({ path: outputPath, type: "png" });
  console.log(outputPath);
} finally {
  await browser?.close();
  await server?.close();
}
