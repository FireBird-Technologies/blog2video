// Scope check: report identifiers a generated scene reads but never defines.
//
// WHY THIS EXISTS
// A scene shipped `interpolate(frame0, ...)` where only `frame` was ever
// declared. That parses, so esbuild's transform accepts it; esbuild's BUNDLER
// accepts it too (an unresolved identifier is assumed to be a runtime global);
// and every regex contract in code_validator passes it. It then threw
// "frame0 is not defined" in the browser on the first frame.
//
// The Level-2 runtime harness does catch it, but only when it is reachable:
// it runs LAST, after every static gate, and it fails open when its toolchain
// is missing. This check is static, cheap, and runs BEFORE all of that, so an
// undefined identifier is reported even when the scene also has other defects
// (which is exactly when the runtime gate never gets to run).
//
// Reads {code, allowed[], babelPath} as JSON on stdin, writes {ok, undefined}.
//
// TOOLCHAIN: @babel/standalone, which bundles parser AND traverse in one file
// (babel.packages.{parser,traverse}) and is the same artifact the Level-2
// runtime harness loads.
//
// It deliberately does NOT use @babel/parser + @babel/traverse from
// remotion-video/node_modules. Those are TRANSITIVE dev-only deps there: the
// image installs with `npm ci --omit=dev`, which keeps @babel/parser but drops
// @babel/traverse — so this check would have loaded, found no traverse, and
// failed open in production while passing locally. That is precisely the
// failure mode this gate was written to close, so it must not reproduce it.
//
// Fails OPEN — any problem loading the toolchain reports ok:true rather than
// blocking generation.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const read = () => {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const out = (o) => {
  process.stdout.write(JSON.stringify(o));
  process.exit(0);
};

const payload = read();
if (!payload || !payload.code || !payload.babelPath) {
  out({ ok: true, skipped: "no payload" });
}

// Unwrap CommonJS/ESM interop until the callable falls out — otherwise
// `traverse(...)` is an object and every scene silently "passes".
const callable = (mod) => {
  for (let i = 0; i < 3; i++) {
    if (typeof mod === "function") return mod;
    if (mod && typeof mod.default !== "undefined") mod = mod.default;
    else break;
  }
  return mod;
};

let parser, traverse;
try {
  let babel = await import(pathToFileURL(payload.babelPath).href);
  babel = babel.default ?? babel;
  parser = babel.packages?.parser;
  traverse = callable(babel.packages?.traverse);
  if (typeof parser?.parse !== "function" || typeof traverse !== "function") {
    out({ ok: true, skipped: "babel entrypoints not callable" });
  }
} catch (e) {
  out({ ok: true, skipped: `babel unavailable: ${e.message}` });
}

// Strip imports/exports the same way the runtimes do before evaluating, so the
// code analysed here is the code that actually runs.
const src = String(payload.code)
  .replace(/^\s*import[^\n]*\n/gm, "")
  .replace(/^\s*export\s+default\s+/gm, "")
  .replace(/^\s*export\s+/gm, "");

// Generated scenes are plain JSX (the preview compiler runs Babel with only
// the react preset, so TS syntax would fail there anyway), but parsing with
// the typescript plugin as a fallback costs nothing and stops this check from
// silently skipping a scene that happens to carry a type annotation.
let ast;
for (const plugins of [["jsx"], ["jsx", "typescript"]]) {
  try {
    ast = parser.parse(src, { sourceType: "script", errorRecovery: true, plugins });
    break;
  } catch {
    /* try the next plugin set */
  }
}
if (!ast) {
  // A genuine syntax error is _parse_check's job to report, not this check's.
  out({ ok: true, skipped: "parse failed" });
}

const allowed = new Set(payload.allowed || []);
const found = new Map();

try {
  traverse(ast, {
    // A Program-level scope walk after traversal gives Babel's own binding
    // resolution, which understands hoisting, destructuring, catch params,
    // function params and every block scope — none of which a regex can.
    Program(p) {
      for (const [name, refPaths] of Object.entries(p.scope.globals ?? {})) {
        if (allowed.has(name)) continue;
        const node = Array.isArray(refPaths) ? refPaths[0] : refPaths;
        const line = node?.loc?.start?.line ?? null;
        if (!found.has(name)) found.set(name, line);
      }
    },
  });
} catch (e) {
  out({ ok: true, skipped: `traverse failed: ${e.message}` });
}

out({
  ok: found.size === 0,
  undefined: [...found.entries()].map(([name, line]) => ({ name, line })),
});
