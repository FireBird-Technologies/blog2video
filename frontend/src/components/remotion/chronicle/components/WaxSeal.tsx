import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface WaxSealProps {
  size?: number;
  color?: string;
  /** Character / monogram to render inside the seal. */
  monogram?: string;
  /** Frame at which the seal should stamp down. */
  stampFrame?: number;
  /** If true, the seal does not animate (for static logo-like uses). */
  instant?: boolean;
  style?: React.CSSProperties;
}

/**
 * WaxSeal — red oxblood wax seal with drop + squash + dust puff stamp animation.
 * Rendered as pure SVG/CSS so it looks crisp at any resolution.
 */
export const WaxSeal: React.FC<WaxSealProps> = ({
  size = 140,
  color = "#8B2E1D",
  monogram = "C",
  stampFrame = 0,
  instant = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - stampFrame;

  // Drop in from above with spring squash
  const drop = instant
    ? 1
    : spring({
        frame: local,
        fps,
        config: { damping: 14, stiffness: 160, mass: 0.9 },
      });
  const translateY = interpolate(drop, [0, 1], [-60, 0]);
  // Squash Y on impact (small overshoot)
  const squashY = instant
    ? 1
    : interpolate(local, [0, 6, 9, 14, 20], [1.1, 1.1, 0.85, 1.06, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const squashX = instant
    ? 1
    : interpolate(local, [0, 6, 9, 14, 20], [0.9, 0.9, 1.15, 0.95, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const opacity = instant
    ? 1
    : interpolate(local, [0, 3], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Dust puff (expands after impact)
  const dustStart = 7;
  const dustProgress = instant
    ? 1
    : interpolate(local, [dustStart, dustStart + 18], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const dustScale = 0.4 + dustProgress * 1.4;
  const dustOpacity = instant ? 0 : (1 - dustProgress) * 0.5;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {/* Dust puff */}
      {dustOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 1.4,
            height: size * 1.4,
            marginLeft: -size * 0.7,
            marginTop: -size * 0.7,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,200,160,0.55) 0%, rgba(220,200,160,0) 60%)",
            transform: `scale(${dustScale})`,
            opacity: dustOpacity,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Seal body */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          position: "relative",
          transform: `scale(${squashX}, ${squashY})`,
          filter: "drop-shadow(0 4px 8px rgba(40,15,10,0.55))",
          zIndex: 1,
        }}
      >
        <defs>
          <radialGradient id={`wax-${color.replace("#", "")}`} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor={lighten(color, 0.18)} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={darken(color, 0.22)} />
          </radialGradient>
          <filter id="wax-emboss">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* Irregular splat outline */}
        <path
          d="M50,5 C62,3 68,12 78,10 C88,8 94,22 92,34 C98,44 94,56 88,62 C94,74 82,90 70,88 C60,96 46,94 38,88 C26,96 8,84 12,70 C2,60 4,44 14,38 C8,26 20,6 32,10 C38,2 46,6 50,5 Z"
          fill={`url(#wax-${color.replace("#", "")})`}
        />

        {/* Outer ridge (engraved look) */}
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke={darken(color, 0.3)}
          strokeWidth="1.2"
          opacity="0.7"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke={darken(color, 0.35)}
          strokeWidth="0.8"
          opacity="0.6"
        />

        {/* Center monogram */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontFamily="'Cinzel Decorative', serif"
          fontWeight="900"
          fontSize="34"
          fill={darken(color, 0.3)}
          filter="url(#wax-emboss)"
        >
          {monogram}
        </text>

        {/* Highlight glossy spot */}
        <ellipse
          cx="38"
          cy="30"
          rx="12"
          ry="6"
          fill="rgba(255,255,255,0.28)"
        />
      </svg>
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
