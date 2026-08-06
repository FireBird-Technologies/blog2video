/**
 * Generates `assets/preview.jpg` for local crafted-template bundles by rendering
 * each bundle's `preview_file` (the marquee `*Preview.tsx`) in headless Chrome
 * and screenshotting it — the same compile/render path the app uses — then
 * writing the image INTO the bundle folder and adding its `{size, sha256}` entry
 * to the bundle's `manifest.json` files-map.
 *
 * After running, upload the updated bundle(s) to R2 with the existing bundler:
 *   python3 scripts/bundle_and_upload_crafted_template.py \
 *     --upload-existing-bundle --upload --replace-existing \
 *     --bundle-dir crafted-templates/<name> --r2-prefix <r2_prefix>
 *
 * Usage (from frontend/):
 *   npm run thumbs:crafted                 # every bundle under ../crafted-templates
 *   npm run thumbs:crafted -- <bundleDir>… # specific bundle folder(s)
 *
 * Env: PUPPETEER_EXECUTABLE_PATH (optional; falls back to the "chrome" channel).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import puppeteer from "puppeteer-core";

const WIDTH = 1920;
const HEIGHT = 1080;
const PREVIEW_REL = "assets/preview.jpg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const CRAFTED_ROOT = path.resolve(REPO_ROOT, "crafted-templates");

function resolveChromePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

type Bundle = { dir: string; name: string; previewRel: string };

function discoverBundles(args: string[]): Bundle[] {
  const dirs = args.length > 0
    ? args.map((a) => path.resolve(a))
    : readdirSync(CRAFTED_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(CRAFTED_ROOT, d.name));

  const bundles: Bundle[] = [];
  for (const dir of dirs) {
    const manifestPath = path.join(dir, "manifest.json");
    if (!existsSync(manifestPath)) {
      console.warn(`  skip ${path.basename(dir)}: no manifest.json`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const previewRel: string | undefined = manifest?.frontend?.preview ?? manifest?.preview;
    if (!previewRel || !existsSync(path.join(dir, previewRel))) {
      console.warn(`  skip ${path.basename(dir)}: preview file not found (${previewRel ?? "unset"})`);
      continue;
    }
    bundles.push({ dir, name: manifest?.name || path.basename(dir), previewRel });
  }
  return bundles;
}

/** Update the bundle's manifest.json files-map with the new image (mirrors the
 *  bundler: hash manifest.json last, without its own entry present at hash time). */
function updateManifest(dir: string, imageBytes: Buffer) {
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest.files !== "object" || manifest.files === null) manifest.files = {};
  manifest.preview_image = PREVIEW_REL;
  // Preserve the existing key order (the bundler appends, doesn't sort); just
  // add/refresh our entries. The manifest.json self-entry is hashed last,
  // without its own entry present at hash time (matches the bundler).
  delete manifest.files["manifest.json"];
  manifest.files[PREVIEW_REL] = { size: imageBytes.length, sha256: sha256(imageBytes) };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const withoutSelf = readFileSync(manifestPath);
  manifest.files["manifest.json"] = { size: withoutSelf.length, sha256: sha256(withoutSelf) };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function main() {
  const bundles = discoverBundles(process.argv.slice(2));
  if (bundles.length === 0) {
    console.log("No crafted bundles found.");
    return;
  }
  console.log(`Crafted bundles to snapshot: ${bundles.length}`);

  let vite: ViteDevServer | undefined;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  // Tiny sidecar server that hands the current bundle's preview source to
  // CapturePage (query params can't carry a whole TSX file).
  let currentSource = "";
  const srcServer = createHttpServer((_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(currentSource);
  });

  try {
    await new Promise<void>((resolve) => srcServer.listen(0, "127.0.0.1", resolve));
    const srcPort = (srcServer.address() as { port: number }).port;
    const srcUrl = `http://127.0.0.1:${srcPort}/`;

    vite = await createServer({ root: FRONTEND_ROOT, server: { port: 0 } });
    await vite.listen();
    const base = vite.resolvedUrls?.local?.[0]?.replace(/\/$/, "");
    if (!base) throw new Error("Vite dev server did not report a local URL");

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
    for (const b of bundles) {
      try {
        currentSource = readFileSync(path.join(b.dir, b.previewRel), "utf8");
        const url = `${base}/_capture?craftedSrc=${encodeURIComponent(srcUrl)}&name=${encodeURIComponent(b.name)}`;
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
        await page.evaluate(() => (document as Document).fonts?.ready);
        await page.waitForFunction("window.__captureReady === true", { timeout: 25_000 });

        const el = await page.$("#capture-root");
        if (!el) throw new Error("#capture-root not found");
        const shot = Buffer.from(await el.screenshot({ type: "jpeg", quality: 82 }));

        const outPath = path.join(b.dir, PREVIEW_REL);
        mkdirSync(path.dirname(outPath), { recursive: true });
        writeFileSync(outPath, shot);
        updateManifest(b.dir, shot);
        ok++;
        console.log(`  ✓ ${b.name} -> ${PREVIEW_REL} (${statSync(outPath).size} bytes)`);
      } catch (err) {
        failed++;
        console.warn(`  ✗ ${b.name}: ${(err as Error).message}`);
      }
    }
    console.log(`\nDone. ${ok} ok, ${failed} failed.`);
    if (failed > 0 && ok === 0) process.exitCode = 1;
  } finally {
    await browser?.close();
    await vite?.close();
    srcServer.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
