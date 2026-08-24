/**
 * Generate the favicon set from a source logo.
 *
 * Search engines will not use a `data:` URI favicon — Google and Bing fetch the
 * icon as a separate crawlable URL and cache it independently of the page. So the
 * site needs REAL files at stable paths, which this script produces:
 *
 *   favicon.ico          16 + 32 + 48 (Google's documented fallback path)
 *   favicon-96x96.png    96 (Google renders at multiples of 48)
 *   apple-touch-icon.png 180 (iOS home screen)
 *   icon-192.png/512.png PWA manifest sizes
 *
 * Run with:  node scripts/build-favicons.mjs
 *
 * Resizing uses macOS `sips` (no npm dependency); the .ico is assembled here
 * because an ICO is just a directory header followed by embedded PNG payloads,
 * which needs no image library at all.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Where to write, and what to draw. Each brand is served from its own domain and
// needs its own icon; a shared one would show the wrong logo in half the results.
//   node scripts/build-favicons.mjs                       -> blog2video, from b2v-logo.png
//   node scripts/build-favicons.mjs --mark P2V --out DIR  -> synthesized badge
const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const publicDir = resolve(arg("--out") || join(here, "..", "public"));
const mark = arg("--mark");
const explicitSource = arg("--source") || (!mark ? argv[0] : undefined);

/**
 * The badge some brands use in place of real artwork: a rounded #9333ea square
 * with a white wordmark. This is the exact SVG that used to be inlined as a
 * favicon data URI — rendered to a file so crawlers can actually fetch it.
 * `sips` rasterizes SVG natively, which keeps the text properly antialiased.
 */
function svgSource(text, tmp) {
  const fontSize = text.length > 3 ? 20 : 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#9333ea"/><text x="32" y="33" font-family="Helvetica,Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`;
  const svgPath = join(tmp, "mark.svg");
  const pngPath = join(tmp, "mark.png");
  writeFileSync(svgPath, svg);
  execFileSync("sips", ["-s", "format", "png", svgPath, "--out", pngPath], {
    stdio: "ignore",
  });
  return pngPath;
}

function resize(src, size, out) {
  execFileSync("sips", ["-z", String(size), String(size), src, "--out", out], {
    stdio: "ignore",
  });
}

/**
 * Build a multi-resolution .ico from PNG buffers.
 *
 * ICO layout: 6-byte header, then one 16-byte directory entry per image, then
 * the payloads. PNG payloads are legal in ICO (Vista+) and every engine that
 * matters reads them, so no BMP encoding is required.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    // 256 is encoded as 0 in the single-byte width/height fields.
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const tmp = mkdtempSync(join(tmpdir(), "favicons-"));
try {
  const SOURCE = explicitSource
    ? resolve(explicitSource)
    : mark
      ? svgSource(mark, tmp)
      : join(publicDir, "b2v-logo.png");

  // .ico carries the small sizes browsers and crawlers actually request.
  const icoSizes = [16, 32, 48];
  const pngs = icoSizes.map((size) => {
    const out = join(tmp, `${size}.png`);
    resize(SOURCE, size, out);
    return { size, data: readFileSync(out) };
  });
  writeFileSync(join(publicDir, "favicon.ico"), buildIco(pngs));

  // Standalone PNGs referenced directly from <head> / the manifest.
  for (const [size, name] of [
    [96, "favicon-96x96.png"],
    [180, "apple-touch-icon.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"],
  ]) {
    resize(SOURCE, size, join(publicDir, name));
  }

  console.log(`favicons written to ${publicDir} from ${SOURCE}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
