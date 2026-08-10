import React from "react";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT } from "../../../../fonts/economist-defaults";

/**
 * EconomistMasthead — the red flag wordmark. An *homage* to the famous logo
 * (red rectangle, white high-contrast serif, two words stacked), NOT a vectored
 * copy. The wordmark text is a prop (default "The Economist") and editable.
 *
 * Sizing: pass `width` (the flag width in px). The wordmark's second line is
 * sized to fill that width, the first line sits above at ~half size — so any
 * wordmark (one or more words) lays out cleanly.
 */
interface EconomistMastheadProps {
  wordmark?: string;
  /** Flag width in px. Height is derived from the text. */
  width: number;
  accentColor?: string;
  /** Wordmark colour (white on the red flag by default). */
  textColor?: string;
  /** Force the whole wordmark onto a single line. */
  singleLine?: boolean;
  /** A light diagonal sweep across the wordmark; 0..1 progress, or undefined for none. */
  sweep?: number;
  fontFamily?: string;
  style?: React.CSSProperties;
}

export const EconomistMasthead: React.FC<EconomistMastheadProps> = ({
  wordmark = "",
  width,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = "#FFFFFF",
  singleLine = false,
  sweep,
  fontFamily,
  style,
}) => {
  // No brand wordmark → hide the flag entirely rather than print the homage
  // ("The Economist") or an empty red box.
  if (!wordmark.trim()) return null;
  const words = wordmark.trim().split(/\s+/).filter(Boolean);
  const twoLine = !singleLine && words.length > 1;
  const line1 = twoLine ? words[0] : "";
  const line2 = twoLine ? words.slice(1).join(" ") : wordmark.trim();

  const padX = width * 0.055;
  const avail = width - padX * 2;
  // Approx glyph advance for Source Serif 4 @600 ≈ 0.56em; size the second line
  // to ~0.6em-per-char so it fills the flag with a safe margin (no clipping).
  const line2Font = Math.min(avail / Math.max(line2.length * 0.6, 1), width * 0.24);
  const line1Font = line2Font * 0.5;
  const padY = line2Font * 0.34;

  return (
    <div
      style={{
        position: "relative",
        width,
        background: accentColor,
        padding: `${padY}px ${padX}px`,
        boxSizing: "border-box",
        overflow: "hidden",
        ...style,
      }}
    >
      {twoLine && (
        <div
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
            fontWeight: 600,
            fontSize: line1Font,
            lineHeight: 1,
            color: textColor,
            letterSpacing: line1Font * 0.005,
          }}
        >
          {line1}
        </div>
      )}
      <div
        style={{
          fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
          fontWeight: 600,
          fontSize: line2Font,
          lineHeight: 1.02,
          color: textColor,
          letterSpacing: -line2Font * 0.01,
          marginTop: twoLine ? line1Font * 0.04 : 0,
        }}
      >
        {line2}
      </div>

      {/* Optional light sweep across the wordmark. */}
      {sweep !== undefined && sweep > 0 && sweep < 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${-30 + sweep * 130}%`,
            width: "28%",
            background:
              "linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
            transform: "skewX(-12deg)",
          }}
        />
      )}
    </div>
  );
};
