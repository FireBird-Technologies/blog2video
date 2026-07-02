/**
 * Generates static poster PNGs for every built-in template preview, in both
 * landscape (1920×1080) and portrait (1080×1920) formats, into
 * `public/template-posters/`.
 *
 * These posters are shown as template thumbnails (in the coverflow carousel side
 * cards and the BlogUrlForm step-2 grid) so those views hold zero Remotion
 * Players — fixing the mobile OOM/tab-reload. Regenerate whenever a preview's
 * sample scenes, colors, or the underlying composition change:
 *
 *     npm run posters:build
 *
 * How it works: boots a Vite dev server, opens the hidden `/_capture` route in
 * headless Chrome (via puppeteer-core), waits for fonts + a settle window, then
 * screenshots the `#capture-root` element at composition size.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import puppeteer from "puppeteer-core";

// Built-in template ids (keys of TEMPLATE_PREVIEWS). Kept in sync with
// src/components/templatePreviewRegistry.tsx.
const BUILTIN_TEMPLATE_IDS = [
  "default",
  "nightfall",
  "gridcraft",
  "spotlight",
  "matrix",
  "whiteboard",
  "newspaper",
  "newscast",
  "blackswan",
  "mosaic",
  "bloomberg",
  "chronicle",
  "economist",
  "stickman_2",
  "stickman_football",
  "magazine",
];

const ORIENTATIONS = [
  { name: "landscape" as const, width: 1920, height: 1080, suffix: "" },
  { name: "portrait" as const, width: 1080, height: 1920, suffix: "-portrait" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/template-posters");

function resolveChromePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let server: ViteDevServer | undefined;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    server = await createServer({ server: { port: 0 } });
    await server.listen();
    const base = server.resolvedUrls?.local?.[0];
    if (!base) throw new Error("Vite dev server did not report a local URL");
    console.log(`Vite dev server: ${base}`);

    const executablePath = resolveChromePath();
    browser = await puppeteer.launch({
      ...(executablePath ? { executablePath } : { channel: "chrome" }),
      headless: true,
      args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars", "--lang=en-US"],
    });

    const page = await browser.newPage();

    for (const id of BUILTIN_TEMPLATE_IDS) {
      for (const o of ORIENTATIONS) {
        await page.setViewport({ width: o.width, height: o.height, deviceScaleFactor: 1 });
        const url = `${base.replace(/\/$/, "")}/_capture?template=${encodeURIComponent(id)}&orientation=${o.name}`;
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });

        await page.evaluate(() => (document as Document).fonts?.ready);
        await page.waitForFunction(
          "window.__captureReady === true",
          { timeout: 20_000 },
        );

        const el = await page.$("#capture-root");
        if (!el) throw new Error(`#capture-root not found for ${id} (${o.name})`);

        const outPath = path.join(OUT_DIR, `${id}${o.suffix}.webp`);
        await el.screenshot({ path: outPath as `${string}.webp`, type: "webp", quality: 82 });
        console.log(`  ✓ ${id}${o.suffix}.webp`);
      }
    }

    console.log(`\nDone. ${BUILTIN_TEMPLATE_IDS.length * ORIENTATIONS.length} posters written to ${OUT_DIR}`);
  } finally {
    await browser?.close();
    await server?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
