import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * ChronicleChrome — persistent ambient frame around every Chronicle scene.
 *
 * Intentionally minimal motion so scene-to-scene transitions don't read as
 * a repeating "book opens" animation. The dramatic opening lives inside
 * the BookOpen layout; the chrome is just warm parchment + candlelight.
 *
 * Provides:
 *   - Layered parchment background (base gradient + noise + warm stains)
 *   - Soft amber candle glow with gentle pulse (±3%)
 *   - Slow-drifting dust motes (18 particles)
 *   - Subtle open-book page edge shadows on both sides
 *   - A very short content fade-in (~6 frames) — no rotation, no page flip
 *
 * The `disablePageTurn` prop is kept for API compatibility; it used to
 * toggle a 3D rotate that we've since removed.
 */
interface ChronicleChromeProps {
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  /** Reserved — no longer drives a rotation. Kept so callers don't break. */
  disablePageTurn?: boolean;
  /** When true, overlay the illuminated-manuscript scripture texture in addition to parchment. */
  showScripture?: boolean;
  children?: React.ReactNode;
}

const PARCHMENT_TEXTURE = "old-parchment.jpg";
const SCRIPTURE_TEXTURE = "old-scripture.jpg";

const DUST_MOTES = Array.from({ length: 18 }).map((_, i) => {
  const rng = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  return {
    x: rng(i + 1) * 100,
    y: rng(i + 17) * 100,
    size: 2 + rng(i + 31) * 4,
    speed: 0.3 + rng(i + 47) * 0.5,
    drift: (rng(i + 53) - 0.5) * 20,
    phase: rng(i + 61) * Math.PI * 2,
  };
});

export const ChronicleChrome: React.FC<ChronicleChromeProps> = ({
  bgColor = "#F1E4C9",
  disablePageTurn = false,
  showScripture = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  // Candle pulse (±3%, slow sine + tiny flicker)
  const candlePulse =
    1 +
    Math.sin((frame / 30) * Math.PI * 0.6) * 0.03 +
    Math.sin((frame / 7) * Math.PI * 0.8) * 0.008;

  // Subtle fade-in over the first 6 frames. No transform, no rotation.
  // BookOpen owns the big dramatic opening; every other scene just
  // eases in so cuts don't feel hard.
  const contentOpacity = disablePageTurn
    ? 1
    : interpolate(frame, [0, 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill style={{ backgroundColor: "#2A1810", overflow: "hidden" }}>
      {/* Parchment base */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 25%, ${lighten(bgColor, 0.06)} 0%, ${bgColor} 45%, ${darken(bgColor, 0.08)} 100%),
            ${bgColor}
          `,
        }}
      />

      {/* SVG grain for aged paper */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.35,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="chronicle-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.16
                      0 0 0 0 0.09
                      0 0 0 0 0.06
                      0 0 0 0.22 0"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#chronicle-grain)" />
      </svg>

      {/* Parchment photo texture — always on, very subtle so it reads as paper grain not content */}
      <img
        src={staticFile(PARCHMENT_TEXTURE)}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 50%",
          opacity: 0.10,
          filter: "sepia(0.55) contrast(1.05) saturate(0.55) blur(1.5px)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Scripture (illuminated manuscript) — only on hero/quote scenes */}
      {showScripture && (
        <img
          src={staticFile(SCRIPTURE_TEXTURE)}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 50%",
            opacity: 0.14,
            filter: "sepia(0.55) contrast(1.05) saturate(0.6)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Warm stain patches */}
      {[
        { x: "12%", y: "18%", size: isPortrait ? "45%" : "28%" },
        { x: "75%", y: "68%", size: isPortrait ? "55%" : "35%" },
        { x: "45%", y: "85%", size: isPortrait ? "35%" : "22%" },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(120,80,40,0.12) 0%, rgba(120,80,40,0) 70%)`,
            filter: "blur(40px)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Candle glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 15% 10%, rgba(255, 190, 100, ${0.22 * candlePulse}) 0%, rgba(255, 160, 60, 0.08) 25%, transparent 55%)`,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 45%, rgba(40, 25, 12, 0.35) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Open-book spread — three-layer shading at zIndex 1, BEHIND content
          at zIndex 10 so it can never interfere with layouts.
            1. Left page  — soft inner-shadow extending right from the spine
            2. Right page — mirror, extending left from the spine
            3. The fold itself — very thin deeper shadow at exact center
          Together these give the eye two distinct page surfaces with a
          gentle crease, without ever drawing a hard vertical seam. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "50%",
          background: `linear-gradient(to right,
            transparent 0%,
            transparent 75%,
            rgba(40,25,12,0.10) 90%,
            rgba(40,25,12,0.18) 100%)`,
          pointerEvents: "none",
          zIndex: 1,
          mixBlendMode: "multiply",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "50%",
          background: `linear-gradient(to left,
            transparent 0%,
            transparent 75%,
            rgba(40,25,12,0.10) 90%,
            rgba(40,25,12,0.18) 100%)`,
          pointerEvents: "none",
          zIndex: 1,
          mixBlendMode: "multiply",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "1.5%",
          background: `linear-gradient(to right,
            transparent 0%,
            rgba(20,10,4,0.22) 50%,
            transparent 100%)`,
          pointerEvents: "none",
          zIndex: 1,
          mixBlendMode: "multiply",
        }}
      />

      {/* Scene content — sits above all chrome textures, below spine shadows + dust. */}
      <AbsoluteFill style={{ opacity: contentOpacity, zIndex: 10 }}>
        {children}
      </AbsoluteFill>

      {/* Dust motes */}
      {DUST_MOTES.map((m, i) => {
        const travelY = ((frame * m.speed) % 140) - 20;
        const y = (m.y - travelY + 100) % 100;
        const xDrift = m.drift * Math.sin((frame / 40) * Math.PI + m.phase);
        const opacity = 0.25 + 0.2 * Math.sin((frame / 25) * Math.PI + m.phase);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${m.x}% + ${xDrift}px)`,
              top: `${y}%`,
              width: m.size,
              height: m.size,
              borderRadius: "50%",
              background: "rgba(255, 220, 160, 0.9)",
              boxShadow: `0 0 ${m.size * 2}px rgba(255, 200, 120, 0.6)`,
              opacity,
              pointerEvents: "none",
              zIndex: 40,
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
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
export const lighten = (hex: string, amt: number) => shiftColor(hex, amt);
export const darken = (hex: string, amt: number) => shiftColor(hex, -amt);
