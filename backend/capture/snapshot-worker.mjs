/**
 * Standalone custom-template snapshot worker (runs inside the backend image).
 *
 * Invoked by the backend as `CAPTURE_WORKER_CMD <template_id>` after a template
 * is created/regenerated (see app/services/custom_template_snapshot.py). For the
 * given id it opens the DEPLOYED frontend's hidden `/_capture?custom=<id>&secret=…`
 * route in headless Chrome, screenshots `#capture-root`, and POSTs the image to
 * the backend's internal preview-image endpoint (which uploads to R2 and sets
 * `preview_image_url`).
 *
 * Unlike frontend/scripts/capture-custom-thumbnails.ts, this never boots Vite —
 * it always targets a running frontend (CAPTURE_FRONTEND_URL) and needs only
 * puppeteer-core, so it is cheap to bundle into the backend container.
 *
 * Required env:
 *   BACKEND_BASE          backend origin (e.g. http://localhost:7860 in-container)
 *   CAPTURE_FRONTEND_URL  deployed frontend origin serving /_capture (Vercel)
 *   CAPTURE_SECRET        shared secret matching backend settings.CAPTURE_SECRET
 *   PUPPETEER_EXECUTABLE_PATH  Chrome binary (falls back to the "chrome" channel)
 *
 * Usage: node snapshot-worker.mjs <template_id> [<template_id> ...]
 * Also accepts a leading "--ids" flag (ignored) so CAPTURE_WORKER_CMD can read
 * naturally: CAPTURE_WORKER_CMD="node /app/capture/snapshot-worker.mjs --ids".
 */
import puppeteer from "puppeteer-core";

const WIDTH = 1920;
const HEIGHT = 1080;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name}`);
  return v.replace(/\/$/, "");
}

async function main() {
  const backend = requireEnv("BACKEND_BASE");
  const frontend = requireEnv("CAPTURE_FRONTEND_URL");
  const secret = process.env.CAPTURE_SECRET;
  if (!secret) throw new Error("Missing required env CAPTURE_SECRET");

  const ids = process.argv
    .slice(2)
    .filter((a) => /^\d+$/.test(a))
    .map(Number);
  if (ids.length === 0) throw new Error("No template id provided");

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    headless: true,
    args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars", "--lang=en-US"],
  });

  let failed = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

    for (const id of ids) {
      try {
        const url = `${frontend}/_capture?custom=${id}&secret=${encodeURIComponent(secret)}`;
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForFunction("window.__captureReady === true", { timeout: 25_000 });

        const el = await page.$("#capture-root");
        if (!el) throw new Error("#capture-root not found");
        const shot = await el.screenshot({ type: "webp", quality: 82 });
        const bytes = new Uint8Array(shot);

        const form = new FormData();
        form.append("file", new Blob([bytes], { type: "image/webp" }), `custom-${id}.webp`);
        const res = await fetch(`${backend}/api/custom-templates/internal/preview-image/${id}`, {
          method: "POST",
          headers: { "X-Capture-Secret": secret },
          body: form,
        });
        if (!res.ok) throw new Error(`POST preview-image -> ${res.status}`);
        console.log(`✓ ${id}`);
      } catch (err) {
        failed++;
        console.warn(`✗ ${id}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
