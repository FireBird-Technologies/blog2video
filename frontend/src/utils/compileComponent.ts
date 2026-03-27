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

export interface SceneProps {
  displayText: string;
  narrationText: string;
  imageUrl?: string;
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
}

export type CompileResult =
  | { success: true; component: React.FC<SceneProps> }
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
  console.log("[F7-DEBUG] compileComponentCode called: code length =", code.length, "chars");
  try {
    const Babel = await loadBabel();
    console.log("[F7-DEBUG] Babel loaded successfully");

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
      interpolate,
      spring,
      Easing,
      AbsoluteFill,
      Sequence,
      Img,
      random
    );

    if (typeof SceneComponent !== "function") {
      console.error("[F7-DEBUG] SceneComponent is not a function, got:", typeof SceneComponent);
      return {
        success: false,
        error: "Generated code did not produce a valid SceneComponent function",
      };
    }

    console.log("[F7-DEBUG] Compilation SUCCESS — SceneComponent is a valid function");
    return { success: true, component: SceneComponent as React.FC<SceneProps> };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[F7-DEBUG] Compilation FAILED:", message);
    return { success: false, error: message };
  }
}
