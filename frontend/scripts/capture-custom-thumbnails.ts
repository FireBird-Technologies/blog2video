/**
 * Snapshots CUSTOM templates' real preview into a static image and stores it in
 * R2 (via the backend), mirroring the built-in poster capture
 * ({@link ./capture-posters.ts}). Used so custom-template thumbnails hold zero
 * Remotion Players on mobile — a grid of live Players exhausts iOS Safari's
 * per-tab memory and reloads the tab.
 *
 * For each target template it opens the hidden `/_capture?custom=<id>&secret=…`
 * route in headless Chrome, waits for the settle signal, screenshots
 * `#capture-root`, and POSTs the image to the backend's internal preview-image
 * endpoint, which uploads to R2 and sets `preview_image_url`.
 *
 * Modes:
 *   npm run thumbs:custom -- --all            # every template missing an image
 *   npm run thumbs:custom -- --all --force    # every template (re-snapshot)
 *   npm run thumbs:custom -- --ids 12 34 56   # specific ids
 *   node capture-custom-thumbnails.mjs --ids 12   # single id (worker mode)
 *
 * Env:
 *   BACKEND_BASE   backend origin, e.g. https://api.example.com (required)
 *   CAPTURE_SECRET shared secret matching backend settings.CAPTURE_SECRET (required)
 *   CAPTURE_FRONTEND_URL  a already-running frontend serving /_capture; when unset
 *                         a local Vite dev server is booted (dev/CI use).
 *   PUPPETEER_EXECUTABLE_PATH  Chrome/Chrome-Headless-Shell binary (falls back to
 *                              the "chrome" channel).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import puppeteer from "puppeteer-core";

const WIDTH = 1920;
const HEIGHT = 1080;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name}`);
  return v;
}

type Target = { id: number; user_id: number };

function parseArgs(argv: string[]): { all: boolean; force: boolean; ids: number[] } {
  const all = argv.includes("--all");
  const force = argv.includes("--force");
  const idsFlag = argv.indexOf("--ids");
  let ids: number[] = [];
  if (idsFlag !== -1) {
    ids = argv.slice(idsFlag + 1).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  } else if (!all) {
    // Bare trailing numeric args → single/multi id worker mode.
    ids = argv.filter((a) => /^\d+$/.test(a)).map(Number);
  }
  return { all, force, ids };
}

async function fetchTargets(backend: string, secret: string, all: boolean, force: boolean, ids: number[]): Promise<Target[]> {
  if (ids.length > 0) return ids.map((id) => ({ id, user_id: 0 }));
  // --all: ask the backend for the id list (optionally only those missing an image).
  const url = `${backend.replace(/\/$/, "")}/api/custom-templates/internal/ids?only_missing=${all && !force ? "true" : "false"}`;
  const res = await fetch(url, { headers: { "X-Capture-Secret": secret } });
  if (!res.ok) throw new Error(`GET /internal/ids -> ${res.status}`);
  return (await res.json()) as Target[];
}

function resolveChromePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
}

async function main() {
  const backend = requireEnv("BACKEND_BASE");
  const secret = requireEnv("CAPTURE_SECRET");
  const { all, force, ids } = parseArgs(process.argv.slice(2));
  if (!all && ids.length === 0) {
    throw new Error("Nothing to do: pass --all or --ids <id...> (or a trailing id).");
  }

  let server: ViteDevServer | undefined;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    let frontendBase = process.env.CAPTURE_FRONTEND_URL;
    if (!frontendBase) {
      server = await createServer({ root: path.resolve(__dirname, ".."), server: { port: 0 } });
      await server.listen();
      frontendBase = server.resolvedUrls?.local?.[0];
      if (!frontendBase) throw new Error("Vite dev server did not report a local URL");
    }
    frontendBase = frontendBase.replace(/\/$/, "");
    console.log(`Frontend: ${frontendBase}`);

    const targets = await fetchTargets(backend, secret, all, force, ids);
    console.log(`Templates to snapshot: ${targets.length}`);
    if (targets.length === 0) return;

    const executablePath = resolveChromePath();
    browser = await puppeteer.launch({
      ...(executablePath ? { executablePath } : { channel: "chrome" }),
      headless: true,
      args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars", "--lang=en-US"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

    let ok = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const url = `${frontendBase}/_capture?custom=${t.id}&secret=${encodeURIComponent(secret)}`;
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
        await page.evaluate(() => (document as Document).fonts?.ready);
        await page.waitForFunction("window.__captureReady === true", { timeout: 25_000 });

        const el = await page.$("#capture-root");
        if (!el) throw new Error("#capture-root not found");
        const shot = await el.screenshot({ type: "webp", quality: 82 });
        const bytes = new Uint8Array(shot as Uint8Array);

        const form = new FormData();
        form.append("file", new Blob([bytes], { type: "image/webp" }), `custom-${t.id}.webp`);
        const res = await fetch(
          `${backend.replace(/\/$/, "")}/api/custom-templates/internal/preview-image/${t.id}`,
          { method: "POST", headers: { "X-Capture-Secret": secret }, body: form },
        );
        if (!res.ok) throw new Error(`POST preview-image -> ${res.status}`);
        ok++;
        console.log(`  ✓ ${t.id}`);
      } catch (err) {
        failed++;
        console.warn(`  ✗ ${t.id}: ${(err as Error).message}`);
      }
    }
    console.log(`\nDone. ${ok} ok, ${failed} failed.`);
    if (failed > 0 && ok === 0) process.exitCode = 1;
  } finally {
    await browser?.close();
    await server?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
