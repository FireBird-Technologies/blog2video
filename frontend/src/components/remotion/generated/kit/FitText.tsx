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
  /**
   * Target size in px. Text is fitted AROUND this, in both directions: long copy
   * shrinks, and short copy is allowed to grow up to `maxFontSize` so a
   * six-word headline does not sit tiny in a box built for thirty.
   */
  fontSize?: number;
  /** Floor — never shrink below this (keeps headlines legible). */
  minFontSize?: number;
  /**
   * Ceiling for the grow direction. Defaults to 1.6x the target, clamped so a
   * one-word headline cannot balloon past what the frame can hold.
   */
  maxFontSize?: number;
  /**
   * Fraction of the canvas width this text box may occupy (0–1). Used to estimate
   * how many characters fit per line before we must shrink. Default 0.86.
   *
   * Only consulted when `containerWidth` is not given. Prefer `containerWidth`:
   * this fraction is measured against the FULL CANVAS, so a headline sitting in
   * a 40%-wide column is sized as if it owned 86% of a 1920px frame — a ~2x
   * overestimate, and the direct cause of headlines breaking mid-word inside
   * narrow columns.
   */
  widthFraction?: number;
  /**
   * Actual width in px of the box this text renders into. Pass this whenever the
   * text is inside a column, card or split rather than spanning the frame —
   * e.g. a 40% column of a 1920px canvas is `containerWidth={1920 * 0.4}`.
   */
  containerWidth?: number;
  /**
   * Height budget in px for the text block. When set, the estimate also shrinks
   * to keep `lines * lineHeight * size` within it — without this, an
   * underestimated line count silently overflows DOWNWARD, which no amount of
   * width fitting can catch.
   */
  maxHeight?: number;
  /** Max lines the text is allowed to wrap to before shrinking further. Default 3. */
  maxLines?: number;
  /** Line height multiplier, used for the height budget. Default 1.15. */
  lineHeight?: number;
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
  style?: React.CSSProperties;
}

/** Average glyph advance as a fraction of font size (empirical for typical UI/serif faces).
 *
 * Deliberately pessimistic: display serifs, heavy weights, uppercase settings and
 * positive letter-spacing all push real advance above this, and underestimating
 * width is what lets text overflow. Being wrong in the "shrink slightly too much"
 * direction is invisible; being wrong the other way breaks the frame. */
const AVG_CHAR_WIDTH_RATIO = 0.58;

/** Character count of the longest single word — a word cannot be split across
 * lines without breaking mid-word, so it sets its own width ceiling. */
function longestWordLength(text: string): number {
  let longest = 0;
  for (const word of (text || "").trim().split(/\s+/)) {
    if (word.length > longest) longest = word.length;
  }
  return longest;
}

/**
 * Deterministically solve for the font size at which `text` FILLS `maxLines`
 * lines of a `boxWidth` box, clamped to [floor, ceiling].
 *
 * Fits in both directions: short text grows toward the ceiling, long text
 * shrinks toward the floor. A shrink-only version left short headlines tiny.
 */
function estimateFitSize(
  text: string,
  boxWidth: number,
  desired: number,
  floor: number,
  ceiling: number,
  maxLines: number,
  maxHeight?: number,
  lineHeight = 1.15,
): number {
  const longestWord = longestWordLength(text);
  const len = (text || "").trim().length;
  if (len === 0) return desired;

  // Solve for the size that FILLS the box, then clamp — rather than starting at
  // `desired` and only ever shrinking.
  //
  // Shrink-only sizing is why short headlines looked tiny: "Growth" rendered at
  // the same 70px as a 90-character sentence and filled about 5% of the space
  // reserved for it. Both the too-small and the too-large complaints come from
  // the same omission — the size was never a function of how much text there is.
  //
  // Target: fill `maxLines` lines of the box. size = boxWidth * maxLines /
  // (len * ratio) is the size at which the text exactly consumes that area.
  const fillSize = (boxWidth * maxLines) / Math.max(1, len * AVG_CHAR_WIDTH_RATIO);

  // Short text may grow toward the ceiling; long text shrinks below the target.
  let size = Math.min(ceiling, fillSize);

  // A single unbreakable word must still fit on one line, or it breaks mid-word.
  if (longestWord > 0) {
    size = Math.min(size, boxWidth / (longestWord * AVG_CHAR_WIDTH_RATIO));
  }

  // ── Height fit ──
  // The width solve assumes the text uses exactly maxLines. A long word or an
  // unlucky break can produce more, so cap against the real height budget too.
  if (maxHeight && maxHeight > 0) {
    const linesAt = (s: number) =>
      Math.max(1, Math.ceil(len / Math.max(1, boxWidth / (s * AVG_CHAR_WIDTH_RATIO))));
    while (size > floor && linesAt(size) * size * lineHeight > maxHeight) {
      size -= 1;
    }
  }

  return Math.max(floor, Math.min(ceiling, size));
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
  maxFontSize,
  widthFraction = 0.86,
  containerWidth,
  maxHeight,
  maxLines = 3,
  lineHeight = 1.15,
  as = "div",
  style,
}) => {
  const { width, height } = useVideoConfig();
  const { type } = useKit();
  const Tag = as as React.ElementType;

  const desired = fontSize ?? type.title;
  // Floor at 40% of desired rather than 50%. A caller passing minFontSize={48}
  // for a title that genuinely needs 30px cannot shrink far enough, so it
  // overflows at 48 instead — a floor that blocks fitting defeats the component.
  const floor = minFontSize ?? Math.max(16, Math.round(desired * 0.4));
  // Grow ceiling. Short text may exceed the target — otherwise a two-word
  // headline sits at the size chosen for a full sentence — but never past what
  // the frame can hold, so it is capped against the canvas height too.
  const ceiling = maxFontSize ?? Math.min(Math.round(desired * 1.6), Math.round(height * 0.18));
  // Prefer the real container width; fall back to the canvas estimate.
  const boxWidth = containerWidth && containerWidth > 0 ? containerWidth : width * widthFraction;
  const size = estimateFitSize(
    textOf(children),
    boxWidth,
    desired,
    floor,
    Math.max(floor, ceiling),
    maxLines,
    maxHeight,
    lineHeight,
  );

  return (
    <Tag
      style={{
        fontSize: size,
        lineHeight,
        // `break-word` (not `break-all`) breaks INSIDE a word only when that word
        // cannot fit a line on its own. Combined with the sizing above, a normal
        // headline now shrinks to fit rather than splitting as "Britan/nica".
        overflowWrap: "break-word",
        ...style,
        // Structural overflow guards — the same patterns the built-in templates
        // use so text wraps/shrinks instead of escaping the frame.
        //
        // These sit AFTER `...style` so a caller cannot switch them off.
        // `...style` is an escape hatch for typography (family, weight, color,
        // tracking), but generated scenes routinely pass `whiteSpace: 'nowrap'`
        // alongside `maxLines={2}` — a direct contradiction, since nowrap forces
        // one line and long copy then runs straight off the canvas. That is the
        // exact failure FitText exists to prevent, so opting out of it must not
        // be possible.
        //
        // Pinned rather than merged because the sizing math above already
        // assumes text may occupy `maxLines` lines; honoring nowrap would make
        // the computed size wrong, not merely differently styled.
        whiteSpace: "normal",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      {children}
    </Tag>
  );
};
