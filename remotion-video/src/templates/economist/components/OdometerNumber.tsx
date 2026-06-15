import React from "react";
import { clamp01, easeOutQuint } from "../layouts/motion";

/**
 * OdometerNumber — a figure whose digits roll into place like a mechanical
 * counter. Each digit is an overflow-hidden 1em-tall window over a 0–9 strip
 * translated by easeOutQuint; columns settle right→left with a small stagger.
 * Non-digit characters (currency, commas, decimal points, unit suffixes)
 * render static so "$1.9trn" keeps its furniture while 1 and 9 roll.
 *
 * Pure function of `frame` (fonts passed as props, no template imports) so the
 * file stays byte-identical across the render + frontend trees.
 */
export const OdometerNumber: React.FC<{
  value: string | number;
  frame: number;
  start?: number;
  dur?: number;
  /** Frames between adjacent digit columns settling, rolling right→left. */
  digitStagger?: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight?: number;
  letterSpacing?: number;
  style?: React.CSSProperties;
}> = ({
  value,
  frame,
  start = 0,
  dur = 26,
  digitStagger = 3,
  fontSize,
  color,
  fontFamily,
  fontWeight = 900,
  letterSpacing = 0,
  style,
}) => {
  const chars = String(value ?? "").split("");
  const digitCount = chars.filter((c) => /\d/.test(c)).length;

  let digitsSeen = 0;
  return (
    <span
      style={{
        // flex-end over uniform 1em boxes — an overflow-hidden inline-block's
        // baseline is its bottom edge, so baseline alignment would misalign
        // digit windows against the static characters.
        display: "inline-flex",
        alignItems: "flex-end",
        fontSize,
        color,
        fontFamily,
        fontWeight,
        letterSpacing,
        lineHeight: 1,
        ...style,
      }}
    >
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={i} style={{ display: "inline-block", height: "1em" }}>
              {ch}
            </span>
          );
        }
        // Rightmost digit settles first; columns to the left follow.
        const colFromRight = digitCount - 1 - digitsSeen;
        digitsSeen += 1;
        const p = easeOutQuint(
          clamp01((frame - start - colFromRight * digitStagger) / dur),
        );
        const target = Number(ch);
        const shift = target * p;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              height: "1em",
              verticalAlign: "baseline",
            }}
          >
            <span
              style={{
                display: "block",
                transform: `translateY(${(-shift).toFixed(4)}em)`,
              }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} style={{ display: "block", height: "1em" }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};
