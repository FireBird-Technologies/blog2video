import React from "react";
import { interpolate } from "remotion";

interface MosaicTiledTextProps {
  text: string;
  revealProgress: number;
  style?: React.CSSProperties;
  fontFamily?: string;
  /** Speed factor: higher = faster reveal. Default 1.0 */
  speed?: number;
}

/**
 * Renders text that reveals character-by-character in sync with mosaic tile sweep.
 * Characters appear with a slight tile-like fade and scale effect.
 */
export const MosaicTiledText: React.FC<MosaicTiledTextProps> = ({
  text,
  revealProgress,
  style = {},
  fontFamily,
  speed = 1.0,
}) => {
  // Plain-text mode: custom font selected → simple fade-in, no pixel tiling
  if (fontFamily) {
    const opacity = interpolate(revealProgress, [0.05, 0.5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <span style={{ ...style, display: "inline-block", fontFamily, opacity }}>
        {text}
      </span>
    );
  }

  const chars = text.split("");
  const totalChars = chars.length;

  return (
    <span style={{ ...style, display: "inline-block" }}>
      {chars.map((char, i) => {
        // Each character reveals based on its position
        const charStart = (i / totalChars) / speed;
        const charEnd = charStart + (0.3 / speed); // 30% overlap for smooth reveal
        
        const charReveal = interpolate(
          revealProgress,
          [charStart, charEnd],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // Tile-like entrance: scale + fade
        const opacity = charReveal;
        const scale = 0.8 + charReveal * 0.2;

        return (
          <span
            key={`char-${i}`}
            style={{
              display: "inline-block",
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "center bottom",
              // Preserve spaces
              whiteSpace: char === " " ? "pre" : "normal",
              minWidth: char === " " ? "0.25em" : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
};
