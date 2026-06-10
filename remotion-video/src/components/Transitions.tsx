import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Five scan bars at different vertical positions with staggered entry delays
const SCAN_BARS = [
  { top: "8%",  height: 14, delay: 3 },
  { top: "26%", height: 10, delay: 5 },
  { top: "46%", height: 16, delay: 7 },
  { top: "64%", height: 10, delay: 9 },
  { top: "82%", height: 12, delay: 11 },
];

/**
 * Newscast-style "thunder" transition — 3 phases over 20 frames:
 *   Phase 1 (0–5):   Instant white thunderclap flash that spikes then partially recedes
 *   Phase 2 (3–19):  Five horizontal scan bars sweep left → right, staggered 2 frames apart
 *   Phase 3 (8–18):  Lightning bolt SVG materialises at centre and burns out
 *   Finale  (16–20): Final white veil covers the frame, handing off cleanly to the next scene
 */
export const TransitionWipe: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Phase 1: thunderclap flash ──────────────────────────────────────────
  const flashOpacity = interpolate(frame, [0, 2, 5], [0, 1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase 3: lightning bolt ──────────────────────────────────────────────
  const boltOpacity = interpolate(frame, [8, 11, 15, 18], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const boltScale = interpolate(frame, [8, 12], [0.3, 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Finale: clean white veil for seamless scene handoff ─────────────────
  const veilOpacity = interpolate(frame, [16, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {/* Phase 1 — thunderclap flash */}
      <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: flashOpacity }} />

      {/* Phase 2 — scan bars */}
      {SCAN_BARS.map((bar, i) => {
        const barX = interpolate(
          frame,
          [bar.delay, bar.delay + 8],
          [-100, 200],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const barAlpha = interpolate(
          frame,
          [bar.delay, bar.delay + 2, bar.delay + 6, bar.delay + 8],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: bar.top,
              left: 0,
              right: 0,
              height: bar.height,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${barX}%`,
                width: "50%",
                height: "100%",
                background:
                  "linear-gradient(to right, transparent, rgba(255,255,255,0.92), transparent)",
                opacity: barAlpha,
              }}
            />
          </div>
        );
      })}

      {/* Phase 3 — lightning bolt */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: boltOpacity,
        }}
      >
        <svg
          width="110"
          height="180"
          viewBox="0 0 55 90"
          style={{
            transform: `scale(${boltScale})`,
            filter:
              "drop-shadow(0 0 18px rgba(255,255,200,0.95)) drop-shadow(0 0 6px rgba(255,220,60,0.8))",
          }}
        >
          {/* Outer glow fill */}
          <path
            d="M33 2 L8 46 L26 46 L18 88 L50 38 L30 38 Z"
            fill="rgba(255,240,120,0.35)"
            stroke="none"
          />
          {/* Main bolt */}
          <path
            d="M33 2 L8 46 L26 46 L18 88 L50 38 L30 38 Z"
            fill="white"
            stroke="rgba(255,220,60,0.7)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </AbsoluteFill>

      {/* Finale — white veil for clean handoff */}
      <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: veilOpacity }} />
    </AbsoluteFill>
  );
};

export const TransitionFade: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity,
      }}
    />
  );
};
