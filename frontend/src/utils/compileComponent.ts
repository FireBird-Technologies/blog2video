/**
 * JIT compiler for AI-generated Remotion component code.
 * Uses @babel/standalone to transpile JSX, then Function() factory
 * to create a React component with injected Remotion APIs.
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
  Img,
  random,
} from "remotion";
import * as Remotion from "remotion";
import * as Recharts from "recharts";
import * as RemotionTransitions from "@remotion/transitions";
import { Player } from "@remotion/player";
import { getTemplateConfig } from "../components/remotion/templateConfig";
import { CaptionTrack } from "../components/remotion/CaptionTrack";
import { BackgroundMusic } from "../components/remotion/BackgroundMusic";
import { SmartVideo } from "../components/remotion/SmartVideo";
import * as Kit from "../components/remotion/generated/kit";

// Craft-kit exports injected into JIT-compiled AI scene code.
//
// Generated from the canonical kit/index.ts by scripts/sync-generated-kit.mjs
// and shared with the backend's _wrap_generated_code, so the preview and the
// render inject exactly the same set. This used to be a hand-maintained array
// duplicated on both sides, which had already drifted in production —
// `CustomTable` was listed here but missing from the backend, so a scene using
// it previewed fine and then failed to render.
import { KIT_EXPORT_NAMES } from "../components/remotion/generated/kit/exportManifest.generated";

const KIT_EXPORTS = KIT_EXPORT_NAMES;

/**
 * Strip an `easing` option that is not callable, so interpolate falls back to
 * Remotion's default (linear) instead of throwing.
 *
 * Remotion's `Easing` has NO flat combined members — no `inOutCubic`, no
 * `easeInOut`, no `inOutQuad`. The only way to combine is
 * `Easing.inOut(Easing.cubic)`. Generated scenes write the flat form anyway,
 * and reading a missing member yields `undefined`, which Remotion then CALLS:
 * "TypeError: easing is not a function", thrown during render.
 *
 * That throw is why the whole templates page FROZE rather than showing one
 * broken card. It unwinds into Remotion's own ErrorBoundary inside PlayerUI,
 * which responds by re-creating the component tree — which re-runs the same
 * crash. crash -> catch -> remount -> crash pins the main thread, and the outer
 * PlayerErrorBoundary never gets a chance to settle.
 *
 * A validator gate now rejects the bad member at generation time, but every
 * ALREADY-STORED scene still carries it, so this recovers at preview time: the
 * animation loses its curve, the page stays alive, and every other scene on it
 * still renders. Shared by both compile paths in this file.
 */
function safeEasingOptions(
  options?: Parameters<typeof interpolate>[3],
): Parameters<typeof interpolate>[3] {
  if (!options || typeof options !== "object") return options;
  if (!("easing" in options)) return options;
  const easing = (options as { easing?: unknown }).easing;

  // A `typeof === "function"` check is NOT enough, and that is the whole
  // subtlety here. The common shape is `Easing.out(Easing.quint)` — and
  // `quint` does not exist, so the argument is `undefined`. But the
  // COMBINATOR still returns a closure:
  //
  //     static out(easing) { return (t) => 1 - easing(1 - t); }
  //
  // That closure IS a function, so a type check waves it through, and the
  // TypeError only surfaces when Remotion finally invokes it mid-render.
  //
  // So probe it: call it once on a value in its own domain. If it throws (or
  // returns something non-numeric), drop the key and let Remotion fall back to
  // its own default — `options?.easing ?? ((num) => num)`, i.e. linear.
  if (typeof easing === "function") {
    try {
      const probe = (easing as (t: number) => unknown)(0.5);
      if (typeof probe === "number" && Number.isFinite(probe)) return options;
    } catch {
      // falls through to the strip below
    }
  }
  const { easing: _dropped, ...rest } = options as Record<string, unknown>;
  return rest as Parameters<typeof interpolate>[3];
}

export interface SceneProps {
  /** The scene's short title (Scene.title) — a label, not a sentence. */
  sceneTitle?: string;
  /** The on-screen copy (Scene.display_text). NOT the voiceover. */
  displayText: string;
  /** The voiceover script (Scene.narration_text) — usually a paragraph, and
   *  usually NOT what belongs on screen as a headline. */
  narrationText: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  /** True when a stock-footage clip is filling this scene's visual slot.
   *  GeneratedVideo/the preview renders the clip itself — the component must
   *  leave that slot's area empty/transparent rather than treating the scene
   *  as if it has no visual at all. imageUrl is undefined in this case. */
  hasVideo?: boolean;
  sceneIndex: number;
  totalScenes: number;
  logoUrl?: string;
  brandImages?: string[];
  brandColors: {
    primary: string;
    /** @deprecated Never read by any component. It carried
     *  theme.colors.surface, which no longer exists — panels are derived
     *  from bg+text by derivePalette. Optional so callers may omit it. */
    secondary?: string;
    accent: string;
    background: string;
    text: string;
  };
  aspectRatio: "landscape" | "portrait";
  /** Structured content fields — populated when blog content contains lists, stats, quotes, etc. */
  contentType?: "plain" | "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps" | "dataviz";
  bullets?: string[];
  metrics?: { value: string; label: string; suffix?: string }[];
  codeLines?: string[];
  codeLanguage?: string;
  quote?: string;
  quoteAuthor?: string;
  comparisonLeft?: { label: string; description: string };
  comparisonRight?: { label: string; description: string };
  timelineItems?: { label: string; description: string }[];
  steps?: string[];
  /** Data-viz fields — used by the dedicated kit chart/table scenes (DataChartScene/DataTableScene). */
  chartTable?: { headers?: string[]; rows?: (string | number)[][] };
  chartType?: string;
  chartSummary?: string;
  /** Size for the HEADLINE (props.displayText) — fed by the editor's *Display
   *  text* slider. Named "title" for backward compatibility with every stored
   *  generated scene, which binds `props.titleFontSize ?? N` on the headline. */
  titleFontSize?: number;
  /** Size for body copy — fed by the same *Display text* slider. */
  descriptionFontSize?: number;
  /** Size for the scene's short title / eyebrow (props.sceneTitle) — fed by the
   *  editor's *Title* slider, applied by the kit rather than by scene code. */
  sceneTitleFontSize?: number;
  headingFont?: string;
  bodyFont?: string;
  /** Free-form per-layout props declared by this layout's prop schema (P3).
   *  Read defensively: props.layoutProps?.chapterNumber ?? "01". */
  layoutProps?: Record<string, unknown>;
  /** The closing CTA + social handles, present only on the FINAL scene.
   *
   *  The generated outro composes these into its OWN layout — it renders
   *  <SocialIcons> and maps `ctas` itself. Previously GeneratedVideo replaced
   *  the outro entirely with GeneratedCtaOverlay, so every template ended with
   *  the same generic card.
   *
   *  MUST mirror GeneratedCtaProps in
   *  remotion-video/src/templates/generated/types.ts — these two declarations
   *  are maintained by hand and have drifted before (see `bg2`). */
  ctaProps?: {
    socials?: Record<string, { enabled?: boolean; label?: string }>;
    showWebsiteButton?: boolean;
    websiteLink?: string;
    ctaButtonText?: string;
    ctas?: Array<{
      ctaButtonText?: string;
      websiteLink?: string;
      showWebsiteButton?: boolean;
    }>;
  };
}

export type CompileResult =
  | { success: true; component: React.FC<SceneProps> }
  | { success: false; error: string };

export type MultiFileCompileResult =
  | { success: true; component: React.ComponentType<any>; exports: Record<string, unknown> }
  | { success: false; error: string };

// Lazy-loaded Babel reference
let babelPromise: Promise<typeof import("@babel/standalone")> | null = null;

function loadBabel() {
  if (!babelPromise) {
    babelPromise = import("@babel/standalone");
  }
  return babelPromise;
}

/**
 * Pre-load Babel so it's ready when needed. Call this early
 * (e.g. when user navigates to custom templates page).
 */
export function preloadBabel(): void {
  loadBabel();
}

/**
 * Compile a code string into a React component.
 * The code should define `const SceneComponent = (props) => { ... }`
 * with no import/export statements.
 */
export async function compileComponentCode(
  code: string
): Promise<CompileResult> {
  // console.log("[F7-DEBUG] compileComponentCode called: code length =", code.length, "chars");
  try {
    const Babel = await loadBabel();
    // console.log("[F7-DEBUG] Babel loaded successfully");

    // Strip any import/export statements the LLM might have added
    const cleaned = code
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+(default\s+)?/gm, "");

    // Transpile JSX → plain JS
    const result = Babel.transform(cleaned, {
      presets: ["react"],
      filename: "generated.tsx",
    });

    if (!result?.code) {
      return { success: false, error: "Babel transform returned empty code" };
    }

    // Safe wrapper around interpolate — ensures inputRange is strictly monotonic
    // even when the LLM generates dynamic ranges that resolve to equal values at runtime.
    const safeInterpolate: typeof interpolate = (frame, inputRange, outputRange, options?) => {
      // Generated code sometimes calls the React-Native/Framer form,
      // `interpolate(frame, { inputRange, outputRange })`, passing a CONFIG
      // OBJECT where an array belongs. `.map()` on it threw
      // "inputRange.map is not a function" DURING RENDER, which unwinds past
      // the scene into the Player and blanks the entire preview — template
      // 181's intro shipped three such calls and showed an empty frame.
      //
      // A validator gate now rejects that shape at generation time, but stored
      // scenes still carry it, so recover here instead of taking the preview
      // down: read the ranges back off the object when they are there.
      if (!Array.isArray(inputRange)) {
        const cfg = inputRange as unknown as {
          inputRange?: number[];
          outputRange?: number[];
        } | null;
        if (cfg && Array.isArray(cfg.inputRange)) {
          return safeInterpolate(
            frame,
            cfg.inputRange,
            (Array.isArray(cfg.outputRange) ? cfg.outputRange : outputRange) as number[],
            (cfg as unknown as Parameters<typeof interpolate>[3]) ?? options,
          );
        }
        // Nothing usable — return the first output rather than throwing, so one
        // bad call costs one static value and not the whole preview.
        return Array.isArray(outputRange) ? (outputRange[0] as number) : 0;
      }
      // The MIRROR of the guard above, for the output side.
      //
      // Remotion throws "inputRange (N) and outputRange (undefined) must have
      // the same length" when outputRange is missing or not an array — most
      // often because the generated code destructured a prop that does not
      // exist, or spread a value it expected to be a tuple. That throw happens
      // DURING RENDER, so it unwinds past the scene into the Player and blanks
      // the WHOLE preview, not just the offending scene.
      //
      // A length mismatch is equally fatal and equally recoverable: pad with the
      // last value, or trim, so the animation degrades to something static
      // rather than taking the preview down.
      if (!Array.isArray(outputRange)) {
        return 0;
      }
      const safe = (inputRange as number[]).map((v, i) =>
        i === 0 ? v : Math.max(v, (inputRange as number[])[i - 1] + 1)
      ) as typeof inputRange;
      const out = outputRange as number[];
      if (out.length !== safe.length) {
        if (out.length === 0) return 0;
        const matched =
          out.length > safe.length
            ? out.slice(0, safe.length)
            : [...out, ...Array(safe.length - out.length).fill(out[out.length - 1])];
        return interpolate(
          frame,
          safe,
          matched as typeof outputRange,
          safeEasingOptions(options),
        );
      }
      return interpolate(frame, safe, outputRange, safeEasingOptions(options));
    };

    // Create factory function that receives Remotion APIs + craft kit as parameters
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      "React",
      "useCurrentFrame",
      "useVideoConfig",
      "interpolate",
      "spring",
      "Easing",
      "AbsoluteFill",
      "Sequence",
      "Img",
      "random",
      ...KIT_EXPORTS,
      result.code + "\nreturn SceneComponent;"
    );

    const SceneComponent = factory(
      React,
      useCurrentFrame,
      useVideoConfig,
      safeInterpolate,
      spring,
      Easing,
      AbsoluteFill,
      Sequence,
      Img,
      random,
      ...KIT_EXPORTS.map((name) => (Kit as Record<string, unknown>)[name])
    );

    if (typeof SceneComponent !== "function") {
      // console.error("[F7-DEBUG] SceneComponent is not a function, got:", typeof SceneComponent);
      return {
        success: false,
        error: "Generated code did not produce a valid SceneComponent function",
      };
    }

    // console.log("[F7-DEBUG] Compilation SUCCESS — SceneComponent is a valid function");
    return { success: true, component: SceneComponent as React.FC<SceneProps> };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[F7-DEBUG] Compilation FAILED:", message);
    return { success: false, error: message };
  }
}

/**
 * Compile a single self-contained TSX preview component.
 *
 * Designed for the marquee preview file shipped with each crafted template
 * (see backend/templates/CRAFTED_TEMPLATE_FOLDER_SPEC.md §4). Authoring
 * rules: default-export a component accepting `{ thumbnailMode?: boolean }`,
 * with no `import` statements (they are stripped).
 *
 * The runtime injects these as free variables — the preview can reference
 * them directly without imports:
 *   - `React`, `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`
 *   - `Player` (from `@remotion/player`)
 *   - `getTemplateConfig` (built-in template lookup)
 *   - Remotion primitives for inline scenes (so the preview can define
 *     its own composition + layouts using the same APIs the real video
 *     uses): `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`,
 *     `Easing`, `AbsoluteFill`, `Sequence`, `Img`, `random`.
 */
export async function compilePreviewComponent(
  code: string,
): Promise<{ success: true; component: React.ComponentType<{ thumbnailMode?: boolean }> } | { success: false; error: string }> {
  try {
    const Babel = await loadBabel();
    const cleaned = code
      .replace(/^\s*import\s+[^;\n]*;?\s*$/gm, "")
      .replace(/^\s*export\s+default\s+/gm, "const __PreviewComponent__ = ")
      .replace(/^\s*export\s+/gm, "");
    const transformed = Babel.transform(cleaned, {
      presets: ["react", "typescript"],
      filename: "preview.tsx",
    });
    if (!transformed?.code) {
      return { success: false, error: "Babel transform returned empty code" };
    }
    // Mirror the safe-interpolate wrapper from compileComponentCode so
    // dynamic inputRanges that resolve to equal values don't crash at runtime.
    const safeInterpolate: typeof interpolate = (frame, inputRange, outputRange, options?) => {
      // Generated code sometimes calls the React-Native/Framer form,
      // `interpolate(frame, { inputRange, outputRange })`, passing a CONFIG
      // OBJECT where an array belongs. `.map()` on it threw
      // "inputRange.map is not a function" DURING RENDER, which unwinds past
      // the scene into the Player and blanks the entire preview — template
      // 181's intro shipped three such calls and showed an empty frame.
      //
      // A validator gate now rejects that shape at generation time, but stored
      // scenes still carry it, so recover here instead of taking the preview
      // down: read the ranges back off the object when they are there.
      if (!Array.isArray(inputRange)) {
        const cfg = inputRange as unknown as {
          inputRange?: number[];
          outputRange?: number[];
        } | null;
        if (cfg && Array.isArray(cfg.inputRange)) {
          return safeInterpolate(
            frame,
            cfg.inputRange,
            (Array.isArray(cfg.outputRange) ? cfg.outputRange : outputRange) as number[],
            (cfg as unknown as Parameters<typeof interpolate>[3]) ?? options,
          );
        }
        // Nothing usable — return the first output rather than throwing, so one
        // bad call costs one static value and not the whole preview.
        return Array.isArray(outputRange) ? (outputRange[0] as number) : 0;
      }
      // The MIRROR of the guard above, for the output side.
      //
      // Remotion throws "inputRange (N) and outputRange (undefined) must have
      // the same length" when outputRange is missing or not an array — most
      // often because the generated code destructured a prop that does not
      // exist, or spread a value it expected to be a tuple. That throw happens
      // DURING RENDER, so it unwinds past the scene into the Player and blanks
      // the WHOLE preview, not just the offending scene.
      //
      // A length mismatch is equally fatal and equally recoverable: pad with the
      // last value, or trim, so the animation degrades to something static
      // rather than taking the preview down.
      if (!Array.isArray(outputRange)) {
        return 0;
      }
      const safe = (inputRange as number[]).map((v, i) =>
        i === 0 ? v : Math.max(v, (inputRange as number[])[i - 1] + 1)
      ) as typeof inputRange;
      const out = outputRange as number[];
      if (out.length !== safe.length) {
        if (out.length === 0) return 0;
        const matched =
          out.length > safe.length
            ? out.slice(0, safe.length)
            : [...out, ...Array(safe.length - out.length).fill(out[out.length - 1])];
        return interpolate(
          frame,
          safe,
          matched as typeof outputRange,
          safeEasingOptions(options),
        );
      }
      return interpolate(frame, safe, outputRange, safeEasingOptions(options));
    };
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      "React",
      "useState",
      "useEffect",
      "useRef",
      "useMemo",
      "useCallback",
      "Player",
      "getTemplateConfig",
      "useCurrentFrame",
      "useVideoConfig",
      "interpolate",
      "spring",
      "Easing",
      "AbsoluteFill",
      "Sequence",
      "Img",
      "random",
      transformed.code + "\nreturn typeof __PreviewComponent__ !== 'undefined' ? __PreviewComponent__ : null;",
    );
    const component = factory(
      React,
      React.useState,
      React.useEffect,
      React.useRef,
      React.useMemo,
      React.useCallback,
      Player,
      getTemplateConfig,
      useCurrentFrame,
      useVideoConfig,
      safeInterpolate,
      spring,
      Easing,
      AbsoluteFill,
      Sequence,
      Img,
      random,
    );
    if (typeof component !== "function") {
      return { success: false, error: "Preview file did not produce a default-exported component" };
    }
    return { success: true, component: component as React.ComponentType<{ thumbnailMode?: boolean }> };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Compile a self-contained TS/JSON data module (no React, no JSX).
 *
 * Designed for crafted template data files like `frontend/layoutFields.ts`
 * that ship in the bundle and export plain data via `export const X = {…}`
 * or `export default {…}`. Imports/exports are stripped, the file is run
 * through Babel's TypeScript preset (with module → CommonJS), and the
 * resulting `module.exports` object is returned for the caller to read.
 *
 * Returns `null` on any failure (compile error, malformed source, throw).
 * Callers should treat that as "no override" and fall back accordingly.
 */
export async function compileDataModule(
  source: string,
): Promise<Record<string, unknown> | null> {
  if (!source || !source.trim()) return null;
  // Plain JSON shortcut — no Babel needed.
  const trimmed = source.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return { default: parsed, ...(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) };
    } catch {
      // fall through to Babel path
    }
  }
  try {
    const Babel = await loadBabel();
    const transformed = Babel.transform(source, {
      presets: ["typescript"],
      plugins: ["transform-modules-commonjs"],
      filename: "data.ts",
    });
    if (!transformed?.code) return null;
    const moduleObj = { exports: {} as Record<string, unknown> };
    const noopRequire = (): Record<string, unknown> => ({});
    // eslint-disable-next-line no-new-func
    const factory = new Function("exports", "module", "require", transformed.code);
    factory(moduleObj.exports, moduleObj, noopRequire);
    return moduleObj.exports;
  } catch (err) {
    console.warn("[compileDataModule] failed:", err);
    return null;
  }
}

function normalizeRelPath(path: string): string {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirOf(path: string): string {
  const norm = normalizeRelPath(path);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(0, idx) : "";
}

function joinPath(baseDir: string, rel: string): string {
  const stack = baseDir ? baseDir.split("/").filter(Boolean) : [];
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

function resolveRelativeModule(
  fromPath: string,
  specifier: string,
  files: Map<string, string>
): string | null {
  const fromDir = dirOf(fromPath);
  const base = joinPath(fromDir, specifier);
  const root = normalizeRelPath(fromPath).split("/")[0] || "";
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ].map(normalizeRelPath);

  // If a relative import traverses above the module graph root (e.g. ../../SocialIcons
  // from frontend/layouts/*), try resolving it inside the same root namespace first.
  // Example fallback: SocialIcons.tsx -> frontend/SocialIcons.tsx
  if (root && base && !base.startsWith(`${root}/`) && base !== root) {
    candidates.push(
      normalizeRelPath(`${root}/${base}`),
      normalizeRelPath(`${root}/${base}.ts`),
      normalizeRelPath(`${root}/${base}.tsx`),
      normalizeRelPath(`${root}/${base}.js`),
      normalizeRelPath(`${root}/${base}.jsx`),
      normalizeRelPath(`${root}/${base}/index.ts`),
      normalizeRelPath(`${root}/${base}/index.tsx`),
      normalizeRelPath(`${root}/${base}/index.js`),
      normalizeRelPath(`${root}/${base}/index.jsx`),
    );
  }

  for (const candidate of candidates) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

function pickComponentExport(exportsObj: Record<string, unknown>): React.ComponentType<any> | null {
  const defaultExport = exportsObj.default;
  if (typeof defaultExport === "function") {
    return defaultExport as React.ComponentType<any>;
  }
  const keys = Object.keys(exportsObj);
  const preferred = keys.find((k) => /(Composition|Video|GeneratedVideo)$/i.test(k));
  if (preferred && typeof exportsObj[preferred] === "function") {
    return exportsObj[preferred] as React.ComponentType<any>;
  }
  const firstFn = keys.find((k) => typeof exportsObj[k] === "function");
  return firstFn ? (exportsObj[firstFn] as React.ComponentType<any>) : null;
}

export async function compileModuleGraphEntry(
  filesMap: Record<string, string>,
  entryRelPath: string,
  publicAssetUrls?: Record<string, string> | null,
): Promise<MultiFileCompileResult> {
  try {
    const Babel = await loadBabel();
    const files = new Map<string, string>();
    for (const [k, v] of Object.entries(filesMap || {})) {
      if (typeof k !== "string" || typeof v !== "string") continue;
      files.set(normalizeRelPath(k), v);
    }
    const entry = normalizeRelPath(entryRelPath);
    if (!entry || !files.has(entry)) {
      return { success: false, error: `Entry not found in frontend_files: ${entryRelPath}` };
    }

    const staticFileOverrides =
      publicAssetUrls && typeof publicAssetUrls === "object" ? publicAssetUrls : null;
    const resolveStaticFile = (filePath: string) => {
      const key = String(filePath || "")
        .replace(/\\/g, "/")
        .replace(/^\.+\//, "")
        .replace(/^\/+/, "");
      const mapped = staticFileOverrides?.[key] || staticFileOverrides?.[`public/${key}`];
      if (mapped) return mapped;
      // Crafted bundles compile outside Vite's normal module graph. If the
      // package has not provided a CDN mapping yet, fall back to the app's
      // public root so local previews can still load template assets.
      if (key.startsWith("templates/")) return `/${key}`;
      return Remotion.staticFile(filePath);
    };
    // Crafted/custom template code is compiled from an R2 bundle, so it cannot
    // import repo-local files — the resolver below only maps a few bare
    // specifiers and returns {} for anything else. Swapping both video
    // primitives here reaches already-published bundles without re-publishing
    // them, including crafted templates that used Video directly.
    //
    // Why swap it at all: in the Player, OffthreadVideo seeks a hidden <video>
    // and holds a delayRender() until the frame decodes, which freezes the
    // timeline mid-playback. SmartVideo keeps OffthreadVideo for CLI renders
    // (frame accuracy preserved) and uses <Video> in the Player.
    const remotionRuntime = {
      ...Remotion,
      staticFile: resolveStaticFile,
      Video: SmartVideo as unknown as typeof Remotion.Video,
      OffthreadVideo: SmartVideo as unknown as typeof Remotion.OffthreadVideo,
    } as typeof Remotion;
    const moduleCache = new Map<string, Record<string, unknown>>();
    const compiling = new Set<string>();
    const makeMissingModuleStub = (specifier: string): Record<string, unknown> => {
      const noOpComponent = () => null;
      const noOpFn = () => undefined;
      const spec = String(specifier || "");
      const RuntimeLogoOverlay = ({
        src,
        position = "bottom_right",
        maxOpacity = 0.9,
        size: sizePercent = 100,
        aspectRatio = "landscape",
      }: {
        src?: string;
        position?: string;
        maxOpacity?: number;
        size?: number;
        aspectRatio?: string;
      }) => {
        const frame = Remotion.useCurrentFrame();
        const { width, height } = Remotion.useVideoConfig();
        if (!src) return null;
        const isPortrait = aspectRatio === "portrait" || height > width;
        const opacity = Remotion.interpolate(frame, [0, 20], [0, maxOpacity], {
          extrapolateRight: "clamp",
        });
        const percent = typeof sizePercent === "number" && sizePercent > 0 ? sizePercent : 100;
        const baseSize = isPortrait ? Math.round(width * 0.12) : Math.round(width * 0.105);
        const size = Math.round(baseSize * (percent / 100));
        const margin = isPortrait ? Math.round(width * 0.032) : Math.round(width * 0.022);
        const posStyle: React.CSSProperties = {
          position: "absolute",
          zIndex: 100,
          opacity,
          width: size,
          height: size,
          filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.25))",
        };
        switch (position) {
          case "top_left":
            posStyle.top = margin;
            posStyle.left = margin;
            break;
          case "top_right":
            posStyle.top = margin;
            posStyle.right = margin;
            break;
          case "bottom_left":
            posStyle.bottom = margin;
            posStyle.left = margin;
            break;
          case "bottom_right":
          default:
            posStyle.bottom = margin;
            posStyle.right = margin;
            break;
        }
        return React.createElement(
          "div",
          { style: posStyle },
          React.createElement(Remotion.Img, {
            src,
            style: { width: "100%", height: "100%", objectFit: "contain" },
          }),
        );
      };
      if (spec.toLowerCase().includes("playbackspeed")) {
        return {
          __esModule: true,
          default: {},
          getPlaybackSpeed: (speed?: number) => {
            const s = Number(speed);
            return Number.isFinite(s) && s > 0 ? s : 1;
          },
          getSceneDurationFrames: (seconds?: number, fps?: number, speed?: number) => {
            const sec = Number(seconds);
            const framesPerSecond = Number(fps);
            const playback = Number(speed);
            const safeSec = Number.isFinite(sec) && sec > 0 ? sec : 5;
            const safeFps = Number.isFinite(framesPerSecond) && framesPerSecond > 0 ? framesPerSecond : 30;
            const safePlayback = Number.isFinite(playback) && playback > 0 ? playback : 1;
            return Math.max(1, Math.round((safeSec * safeFps) / safePlayback));
          },
        };
      }
      if (spec.toLowerCase().includes("logooverlay")) {
        return {
          __esModule: true,
          default: RuntimeLogoOverlay,
          LogoOverlay: RuntimeLogoOverlay,
        };
      }
      if (spec.toLowerCase().includes("socialicons")) {
        return {
          __esModule: true,
          default: noOpComponent,
          SocialIcons: noOpComponent,
        };
      }
      // Captions: crafted compositions (e.g. fj_research) import "../CaptionTrack",
      // a shared component not shipped inside the bundle. Provide the real one so
      // captions render in the editor preview, matching the final render.
      if (spec.toLowerCase().includes("captiontrack")) {
        return {
          __esModule: true,
          default: CaptionTrack,
          CaptionTrack,
        };
      }
      // Background music: crafted compositions import "../BackgroundMusic", another
      // shared component not shipped inside the bundle. Provide the real one so BGM
      // plays in the editor preview, matching the final render.
      if (spec.toLowerCase().includes("backgroundmusic")) {
        return {
          __esModule: true,
          default: BackgroundMusic,
          BackgroundMusic,
        };
      }
      if (spec === "react/jsx-runtime" || spec === "react/jsx-dev-runtime") {
        const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => {
          const { children, ...rest } = (props || {}) as { children?: unknown };
          if (key !== undefined) (rest as Record<string, unknown>).key = key;
          return React.createElement(
            type as React.ElementType,
            rest as React.Attributes,
            children as React.ReactNode,
          );
        };
        return {
          __esModule: true,
          jsx,
          jsxs: jsx,
          jsxDEV: jsx,
          Fragment: React.Fragment,
        };
      }
      // Generic fallback for optional side-effect/shared imports (fonts, style helpers, etc.).
      return new Proxy(
        { __esModule: true, default: noOpComponent },
        {
          get(target, prop) {
            if (prop in target) return (target as Record<string, unknown>)[String(prop)];
            return noOpFn;
          },
        }
      ) as Record<string, unknown>;
    };

    const loadModule = (modulePath: string): Record<string, unknown> => {
      const normPath = normalizeRelPath(modulePath);
      if (moduleCache.has(normPath)) return moduleCache.get(normPath)!;
      if (compiling.has(normPath)) {
        return {};
      }
      const source = files.get(normPath);
      if (source == null) {
        throw new Error(`Missing module: ${normPath}`);
      }
      compiling.add(normPath);
      const transformed = Babel.transform(source, {
        presets: ["react", "typescript"],
        plugins: ["transform-modules-commonjs"],
        filename: normPath,
      });
      if (!transformed?.code) {
        throw new Error(`Babel transform failed for ${normPath}`);
      }

      const module = { exports: {} as Record<string, unknown> };
      const localRequire = (specifier: string): unknown => {
        const spec = String(specifier || "").trim();
        if (!spec) return {};
        if (spec.startsWith(".")) {
          const resolved = resolveRelativeModule(normPath, spec, files);
          if (!resolved) {
            return makeMissingModuleStub(spec);
          }
          return loadModule(resolved);
        }
        if (spec === "react") {
          return React;
        }
        if (spec === "react/jsx-runtime" || spec === "react/jsx-dev-runtime") {
          return makeMissingModuleStub(spec);
        }
        if (spec === "remotion") {
          return remotionRuntime;
        }
        if (spec === "recharts") {
          return Recharts;
        }
        if (spec === "@remotion/transitions") {
          return RemotionTransitions;
        }
        // Tolerate side-effect-only externals (fonts/styles/aliases) in browser preview runtime.
        return {};
      };

      // React is injected as a free variable so files that use JSX without
      // an explicit `import React from "react"` (the modern style supported by
      // the Vite/SWC build) still compile under Babel's classic JSX transform.
      // eslint-disable-next-line no-new-func
      const factory = new Function("exports", "require", "module", "React", transformed.code);
      factory(module.exports, localRequire, module, React);
      compiling.delete(normPath);
      moduleCache.set(normPath, module.exports);
      return module.exports;
    };

    const exportsObj = loadModule(entry);
    const component = pickComponentExport(exportsObj);
    if (!component) {
      return { success: false, error: "No React component export found in frontend entry module." };
    }
    return { success: true, component, exports: exportsObj };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
