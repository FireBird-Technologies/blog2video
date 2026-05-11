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

export interface SceneProps {
  displayText: string;
  narrationText: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  sceneIndex: number;
  totalScenes: number;
  logoUrl?: string;
  brandImages?: string[];
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  aspectRatio: "landscape" | "portrait";
  /** Structured content fields — populated when blog content contains lists, stats, quotes, etc. */
  contentType?: "plain" | "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps";
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
  titleFontSize?: number;
  descriptionFontSize?: number;
  headingFont?: string;
  bodyFont?: string;
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
      const safe = (inputRange as number[]).map((v, i) =>
        i === 0 ? v : Math.max(v, (inputRange as number[])[i - 1] + 1)
      ) as typeof inputRange;
      return interpolate(frame, safe, outputRange, options);
    };

    // Create factory function that receives Remotion APIs as parameters
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
      random
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
 * rules: default-export a component, accept `{ thumbnailMode?: boolean }`,
 * and only import from "react".
 *
 * Imports/exports are stripped and the file is run through Babel with the
 * react + typescript presets. React is injected as a free variable.
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
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      "React",
      "useState",
      "useEffect",
      "useRef",
      "useMemo",
      "useCallback",
      transformed.code + "\nreturn typeof __PreviewComponent__ !== 'undefined' ? __PreviewComponent__ : null;",
    );
    const component = factory(
      React,
      React.useState,
      React.useEffect,
      React.useRef,
      React.useMemo,
      React.useCallback,
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
    const remotionRuntime =
      staticFileOverrides && Object.keys(staticFileOverrides).length > 0
        ? ({
            ...Remotion,
            staticFile: (filePath: string) => {
              const key = String(filePath || "")
                .replace(/\\/g, "/")
                .replace(/^\.+\//, "")
                .replace(/^\/+/, "");
              const mapped = staticFileOverrides[key];
              if (mapped) return mapped;
              return Remotion.staticFile(filePath);
            },
          } as typeof Remotion)
        : Remotion;
    const moduleCache = new Map<string, Record<string, unknown>>();
    const compiling = new Set<string>();
    const makeMissingModuleStub = (specifier: string): Record<string, unknown> => {
      const noOpComponent = () => null;
      const noOpFn = () => undefined;
      const spec = String(specifier || "");
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
          default: noOpComponent,
          LogoOverlay: noOpComponent,
        };
      }
      if (spec.toLowerCase().includes("socialicons")) {
        return {
          __esModule: true,
          default: noOpComponent,
          SocialIcons: noOpComponent,
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
