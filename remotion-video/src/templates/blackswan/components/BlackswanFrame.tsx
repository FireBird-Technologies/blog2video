import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

type Props = {
  accentColor: string;
  textColor: string;
  children: React.ReactNode;
};

/**
 * BlackswanFrame — pure black stage with subtle pulsing background ellipses.
 * Matches the HTML reference: background #000000, animated ellipses at bottom,
 * small swan path icon as atmosphere.
 */
export const BlackswanFrame: React.FC<Props> = ({
  accentColor,
  textColor,
  children,
}) => {
  const frame = useCurrentFrame();
  // Slow pulse — sin wave breathe matching HTML ellipse-breathe keyframe
  const pulse = 0.45 + Math.sin(frame / 18) * 0.08;
  const expand = (frame % 120) * 0.06;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        color: textColor,
        overflow: "hidden",
      }}
    >
      {/* ── Ambient background ellipses — bottom water ripple atmosphere ── */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="bsf-neon" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Three expanding ambient rings — matches HTML: cx=50, cy=80-82 */}
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx="50"
            cy={80 - i * 1.5}
            rx={18 + i * 9 + expand * 0.08}
            ry={5 + i * 1.8 + expand * 0.02}
            fill="none"
            stroke={accentColor}
            strokeDasharray="10 6"
            strokeWidth={0.14 + i * 0.07}
            opacity={(0.25 - i * 0.055) * pulse}
            filter="url(#bsf-neon)"
          />
        ))}

        {/* ── Atmospheric swan icon — matches HTML accent path ─────────── */}
        <path
          d="M50 18 C56 23, 58 31, 54 36 C59 34, 60 40, 55 43 C50 46, 41 43, 39 36 C37 29, 42 21, 50 18 Z"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.22"
          opacity={0.65 + pulse * 0.18}
          filter="url(#bsf-neon)"
        />
      </svg>

      {children}
    </AbsoluteFill>
  );
};