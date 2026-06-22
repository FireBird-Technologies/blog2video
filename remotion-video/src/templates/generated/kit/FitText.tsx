/**
 * Custom-template craft kit — FitText.
 *
 * A deterministic, render-safe auto-fit text block. AI-generated scenes use this
 * for headlines, big numerals and any text that must not overshoot its box, so a
 * long title in landscape OR a narrow portrait canvas can never spill or clip.
 *
 * Why not @remotion/layout-utils fitText()? That needs imports + a loaded-font
 * measurement pass, neither of which is available in the sandboxed eval scope
 * that runs generated scene code. Instead we estimate a safe size deterministically
 * from the character count and the available width (canvas-derived), then back it
 * up with structural overflow guards (minWidth:0 + overflowWrap). Same frame =
 * same output, no async, identical in preview and headless render.
 */

import React from "react";
import { useVideoConfig } from "remotion";
import { useKit } from "./context";

export interface FitTextProps {
  /** Text to render. */
  children: React.ReactNode;
  /** Ideal/maximum font size in px. The component only ever scales DOWN from this. */
  fontSize?: number;
  /** Floor — never shrink below this (keeps headlines legible). */
  minFontSize?: number;
  /**
   * Fraction of the canvas width this text box may occupy (0–1). Used to estimate
   * how many characters fit per line before we must shrink. Default 0.86.
   */
  widthFraction?: number;
  /** Max lines the text is allowed to wrap to before shrinking further. Default 3. */
  maxLines?: number;
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
  style?: React.CSSProperties;
}

/** Average glyph advance as a fraction of font size (empirical for typical UI/serif faces). */
const AVG_CHAR_WIDTH_RATIO = 0.52;

/**
 * Deterministically estimate the largest font size (≤ fontSize, ≥ minFontSize)
 * at which `text` fits within `maxLines` lines across a box of `boxWidth` px.
 */
function estimateFitSize(
  text: string,
  boxWidth: number,
  desired: number,
  floor: number,
  maxLines: number,
): number {
  const len = (text || "").trim().length;
  if (len === 0) return desired;
  // Characters that fit on one line at the desired size.
  const perLineAtDesired = Math.max(1, boxWidth / (desired * AVG_CHAR_WIDTH_RATIO));
  const linesAtDesired = len / perLineAtDesired;
  if (linesAtDesired <= maxLines) return desired;
  // Need to shrink so total lines ≤ maxLines:
  //   perLineNeeded = len / maxLines  → size = boxWidth / (perLineNeeded * ratio)
  const perLineNeeded = len / maxLines;
  const fitted = boxWidth / (perLineNeeded * AVG_CHAR_WIDTH_RATIO);
  return Math.max(floor, Math.min(desired, fitted));
}

/** Extract a plain-text length estimate from children (string or simple nodes). */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

export const FitText: React.FC<FitTextProps> = ({
  children,
  fontSize,
  minFontSize,
  widthFraction = 0.86,
  maxLines = 3,
  as = "div",
  style,
}) => {
  const { width } = useVideoConfig();
  const { type } = useKit();
  const Tag = as as React.ElementType;

  const desired = fontSize ?? type.title;
  const floor = minFontSize ?? Math.min(desired, Math.round(desired * 0.5));
  const boxWidth = width * widthFraction;
  const size = estimateFitSize(textOf(children), boxWidth, desired, floor, maxLines);

  return (
    <Tag
      style={{
        fontSize: size,
        // Structural overflow guards — the same patterns the built-in templates
        // use so text wraps/shrinks instead of escaping the frame.
        minWidth: 0,
        maxWidth: "100%",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};
