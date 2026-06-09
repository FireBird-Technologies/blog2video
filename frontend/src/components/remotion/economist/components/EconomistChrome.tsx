import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { ECONOMIST_COLORS, lighten, darken } from "../constants";

/**
 * EconomistChrome — the persistent ambient "paper" behind every scene.
 *
 * Deliberately atmospheric only (warm paper gradient + the faintest print grain
 * + a soft vignette), so it never competes with a layout's own furniture (each
 * scene owns its masthead / title / source line, exactly like a real spread).
 * Content eases in over ~6 frames unless `disableFade` (the cover owns its
 * opening). `sectionLabel` / `dateline` / `wordmark` / `minimal` are accepted
 * for API compatibility with the composition but are rendered by the layouts.
 */
interface EconomistChromeProps {
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  sectionLabel?: string;
  dateline?: string;
  wordmark?: string;
  minimal?: boolean;
  disableFade?: boolean;
  children?: React.ReactNode;
}

export const EconomistChrome: React.FC<EconomistChromeProps> = ({
  bgColor = ECONOMIST_COLORS.paper,
  disableFade = false,
  children,
}) => {
  const frame = useCurrentFrame();

  const contentOpacity = disableFade
    ? 1
    : interpolate(frame, [0, 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Warm paper base — soft top-left light, gently darker corners. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 28% 18%, ${lighten(
            bgColor,
            0.04,
          )} 0%, ${bgColor} 54%, ${darken(bgColor, 0.045)} 100%)`,
        }}
      />

      {/* Faint print grain — keeps the flat paper from looking digital. */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.035,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="economist-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#economist-grain)" />
      </svg>

      {/* Soft vignette for depth. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 58%, rgba(40,34,22,0.06) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Scene content. */}
      <AbsoluteFill style={{ opacity: contentOpacity, zIndex: 10 }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
