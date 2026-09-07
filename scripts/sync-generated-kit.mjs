#!/usr/bin/env node
/**
 * Sync the generated-template craft kit from its canonical source to every
 * consuming tree, and emit the export manifest both injection points read.
 *
 * WHY THIS EXISTS
 * ---------------
 * The kit source used to live in three byte-identical trees kept in sync BY
 * HAND, and the list of kit exports was maintained by hand in TWO more places
 * (the backend's _wrap_generated_code import block and the frontend's
 * KIT_EXPORTS array). That seam had already drifted in production:
 *
 *   - `CustomTable` was exported from the kit and present in the frontend's
 *     KIT_EXPORTS, but MISSING from the backend wrapper's import list — so a
 *     scene using it compiled in the browser preview and failed at render.
 *   - `types.ts` had diverged: the remotion-video copy carried hasVideo,
 *     caption fields and stock-footage video fields that neither frontend had.
 *
 * Adding kit primitives makes that worse, so the export list is now GENERATED
 * from the canonical `kit/index.ts` and the trees are copied mechanically.
 *
 * USAGE
 *   node scripts/sync-generated-kit.mjs           # write
 *   node scripts/sync-generated-kit.mjs --check   # verify only (CI); non-zero on drift
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Canonical source: the render-truth tree. Its types.ts is the superset. */
const SOURCE_KIT = join(ROOT, "remotion-video/src/templates/generated/kit");
const SOURCE_TYPES = join(ROOT, "remotion-video/src/templates/generated/types.ts");

/** Every tree that consumes a copy of the kit. */
const DEST_ROOTS = [
  join(ROOT, "frontend/src/components/remotion/generated"),
  join(ROOT, "frontend-pdf2video/src/components/remotion/generated"),
];

const MANIFEST_BASENAME = "exportManifest.generated.ts";

/**
 * Kit exports that are deliberately NOT injected into generated scene code.
 *
 * The manifest is the *injection* set, not simply "everything the kit exports".
 * Two categories are excluded:
 *
 *  - Composition-level scenes (DataChartScene / DataTableScene) — GeneratedVideo
 *    renders these itself for dedicated data-viz scenes. A scene component must
 *    never nest one inside itself.
 *  - Provider/plumbing (KitProvider) — SceneFrame wires the context; a scene
 *    mounting its own provider would detach the brand palette.
 *
 * Low-level colour/easing helpers (hexToRgb, easeOutQuint, typeScale, ...) are
 * intentionally left OUT of this list: they are pure functions, harmless to
 * expose, and previously unavailable only because two hand-maintained lists had
 * drifted. Injecting them is a deliberate widening, not an accident.
 */
const NOT_INJECTED = new Set(["DataChartScene", "DataTableScene", "KitProvider"]);

const checkOnly = process.argv.includes("--check");
const problems = [];
let wrote = 0;

/**
 * Parse the runtime (value) export names out of the canonical kit/index.ts.
 *
 * Handles the two forms the file uses:
 *   export { a, b as c, type D } from "./x";
 *   export * from "./y";            <- reported, cannot be resolved statically
 *
 * `type X` entries are dropped: they exist only at compile time and cannot be
 * injected as runtime globals into generated scene code.
 */
function parseKitExports(indexSource) {
  const names = new Set();

  for (const m of indexSource.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const raw of m[1].split(",")) {
      let name = raw.trim();
      if (!name) continue;
      // `export { type Foo }` and `export { Foo as Bar }`
      if (/^type\s/.test(name)) continue;
      if (/\sas\s/.test(name)) name = name.split(/\sas\s/)[1].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name) && !NOT_INJECTED.has(name)) names.add(name);
    }
  }

  // A star re-export would silently hide exports from the manifest.
  if (/export\s+\*\s+from/.test(indexSource)) {
    problems.push(
      "kit/index.ts uses `export * from ...`, which this script cannot resolve statically. " +
        "Replace it with an explicit `export { ... } from ...` so the manifest stays complete.",
    );
  }

  return [...names].sort();
}

/** Write a file, or in --check mode record a mismatch instead. */
function emit(destPath, content, label) {
  const exists = existsSync(destPath);
  const current = exists ? readFileSync(destPath, "utf8") : null;
  if (current === content) return;

  if (checkOnly) {
    problems.push(exists ? `out of date: ${label}` : `missing: ${label}`);
    return;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content, "utf8");
  wrote += 1;
  console.log(`  wrote ${label}`);
}

// ─── 1. Build the export manifest ────────────────────────────────────────────

const indexPath = join(SOURCE_KIT, "index.ts");
if (!existsSync(indexPath)) {
  console.error(`FATAL: canonical kit index not found at ${indexPath}`);
  process.exit(2);
}

const exportNames = parseKitExports(readFileSync(indexPath, "utf8"));
if (exportNames.length === 0) {
  console.error("FATAL: parsed zero kit exports — refusing to emit an empty manifest.");
  process.exit(2);
}

const manifest =
  `// @generated by scripts/sync-generated-kit.mjs — DO NOT EDIT BY HAND.\n` +
  `// Run \`node scripts/sync-generated-kit.mjs\` after changing kit/index.ts.\n` +
  `//\n` +
  `// The single source of truth for which kit values are injected into\n` +
  `// AI-generated scene code. Read by the frontend preview compiler and by the\n` +
  `// backend render wrapper, so preview and render can never disagree.\n` +
  `export const KIT_EXPORT_NAMES = [\n` +
  exportNames.map((n) => `  "${n}",`).join("\n") +
  `\n] as const;\n`;

// ─── 2. Fan out ──────────────────────────────────────────────────────────────

console.log(checkOnly ? "Checking generated-kit sync..." : "Syncing generated kit...");

emit(join(SOURCE_KIT, MANIFEST_BASENAME), manifest, `kit/${MANIFEST_BASENAME} (canonical)`);

const kitFiles = readdirSync(SOURCE_KIT).filter((f) => /\.(ts|tsx)$/.test(f));

for (const destRoot of DEST_ROOTS) {
  if (!existsSync(destRoot)) {
    console.log(`  skip (tree absent): ${relative(ROOT, destRoot)}`);
    continue;
  }
  for (const file of kitFiles) {
    emit(
      join(destRoot, "kit", file),
      readFileSync(join(SOURCE_KIT, file), "utf8"),
      `${relative(ROOT, join(destRoot, "kit", file))}`,
    );
  }
  // types.ts lives beside kit/, not inside it. Copying the canonical superset
  // closes the existing divergence; every extra field is optional, so the
  // frontends keep compiling.
  if (existsSync(SOURCE_TYPES)) {
    emit(
      join(destRoot, "types.ts"),
      readFileSync(SOURCE_TYPES, "utf8"),
      `${relative(ROOT, join(destRoot, "types.ts"))}`,
    );
  }
}

// ─── 3. Report ───────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  if (checkOnly) console.error("\nRun: node scripts/sync-generated-kit.mjs");
  process.exit(1);
}

console.log(
  checkOnly
    ? `OK — all trees in sync (${exportNames.length} kit exports).`
    : `Done — ${wrote} file(s) written, ${exportNames.length} kit exports.`,
);
