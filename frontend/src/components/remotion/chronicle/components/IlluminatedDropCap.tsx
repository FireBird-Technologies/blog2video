import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CHRONICLE_HEADING_FONT } from "../../../../fonts/chronicle-defaults";

interface IlluminatedDropCapProps {
  letter: string;
  size?: number;
  accentColor?: string;
  textColor?: string;
  /** Frame to start the paint-in animation. */
  startFrame?: number;
  style?: React.CSSProperties;
}

/**
 * IlluminatedDropCap — medieval illuminated manuscript capital.
 *
 * - Square gold-leaf background panel with vermillion vine ornaments
 * - Large serif letter in burnt umber ink
 * - Paints in via a left-to-right mask reveal (ink spreads)
 */
export const IlluminatedDropCap: React.FC<IlluminatedDropCapProps> = ({
  letter,
  size = 160,
  accentColor = "#B8860B",
  textColor = "#2A1810",
  startFrame = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const reveal = interpolate(local, [0, 25], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-block",
        verticalAlign: "top",
        clipPath: `inset(0 ${100 - reveal}% 0 0)`,
        ...style,
      }}
    >
      {/* Gold leaf background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${lighten(accentColor, 0.18)} 0%, ${accentColor} 50%, ${darken(accentColor, 0.15)} 100%)`,
          boxShadow:
            "inset 0 0 0 2px rgba(40,25,12,0.6), inset 0 0 0 4px rgba(250,230,170,0.7), inset 0 0 0 5px rgba(40,25,12,0.5)",
        }}
      />

      {/* Vermillion vine ornaments — four corners */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Top-left curl */}
        <path
          d="M4,18 Q10,4 20,6 Q12,12 10,20 Q8,14 4,18 Z"
          fill="#8B2E1D"
          opacity="0.85"
        />
        {/* Top-right curl */}
        <path
          d="M96,18 Q90,4 80,6 Q88,12 90,20 Q92,14 96,18 Z"
          fill="#8B2E1D"
          opacity="0.85"
        />
        {/* Bottom-left curl */}
        <path
          d="M4,82 Q10,96 20,94 Q12,88 10,80 Q8,86 4,82 Z"
          fill="#8B2E1D"
          opacity="0.85"
        />
        {/* Bottom-right curl */}
        <path
          d="M96,82 Q90,96 80,94 Q88,88 90,80 Q92,86 96,82 Z"
          fill="#8B2E1D"
          opacity="0.85"
        />
        {/* Central dot accents */}
        <circle cx="50" cy="8" r="1.6" fill="#8B2E1D" opacity="0.7" />
        <circle cx="50" cy="92" r="1.6" fill="#8B2E1D" opacity="0.7" />
        <circle cx="8" cy="50" r="1.6" fill="#8B2E1D" opacity="0.7" />
        <circle cx="92" cy="50" r="1.6" fill="#8B2E1D" opacity="0.7" />
      </svg>

      {/* Letter */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: CHRONICLE_HEADING_FONT,
          fontWeight: 900,
          fontSize: size * 0.72,
          lineHeight: 1,
          color: textColor,
          textShadow:
            "1px 1px 0 rgba(255,230,180,0.4), -1px -1px 0 rgba(40,25,12,0.3)",
        }}
      >
        {letter}
      </div>
    </div>
  );
};

function shiftColor(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const lighten = (hex: string, amt: number) => shiftColor(hex, amt);
const darken = (hex: string, amt: number) => shiftColor(hex, -amt);
