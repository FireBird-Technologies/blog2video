import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * ChronicleArtifacts — deterministic, render-safe manuscript ornaments that
 * individual Chronicle layouts compose on top of ChronicleChrome to enrich the
 * candlelit-scriptorium world without competing with the type. Every piece is a
 * pure function of useCurrentFrame() (seeded randomness only — never Math.random
 * at render time). Warm gold/amber palette to match the parchment chrome.
 */

const GOLD = "#B8860B";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ─── EmberSparks ─────────────────────────────────────────────────────────────
// Warm cinders that rise and sway from the bottom edge, glowing then fading —
// the breath of nearby candles/hearth. Richer + warmer than the tiny ambient
// dust motes in ChronicleChrome. Seeded so every render is identical.

export const EmberSparks: React.FC<{
  count?: number;
  seed?: number;
  /** Confine embers to a horizontal band (percent): [from, to]. */
  xRange?: [number, number];
  intensity?: number;
}> = ({ count = 16, seed = 5, xRange = [0, 100], intensity = 1 }) => {
  const frame = useCurrentFrame();
  const [x0, x1] = xRange;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", zIndex: 41 }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seededRandom(seed + i * 3.3);
        const r2 = seededRandom(seed + i * 7.9);
        const r3 = seededRandom(seed + i * 11.1);
        const x = x0 + r1 * (x1 - x0);
        const speed = 0.18 + r2 * 0.26;
        const size = 2 + r3 * 3.5;
        // Rise from below the frame, loop over ~120% height.
        const rise = (frame * speed + r2 * 120) % 120;
        const y = 102 - rise;
        const sway = Math.sin(frame * 0.04 + r1 * Math.PI * 2) * 2.2;
        // Each ember brightens mid-flight then dies near the top.
        const life = rise / 120;
        const glow = Math.sin(life * Math.PI); // 0→1→0
        const op = glow * (0.35 + r3 * 0.35) * intensity;
        // Warm color drifts from orange to pale gold as it cools.
        const color = `rgba(255, ${Math.round(170 + r2 * 50)}, ${Math.round(70 + r3 * 40)}, 1)`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${x}% + ${sway}px)`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: op,
              boxShadow: `0 0 ${size * 2.5}px rgba(255, 150, 60, ${0.7 * op})`,
              filter: "blur(0.3px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── InkFlourish ─────────────────────────────────────────────────────────────
// A calligraphic filigree flourish that "quill-writes" in via stroke-dashoffset
// then sits as a hand-drawn ornament. Anchored to a corner/edge so it frames the
// page without crossing the text. Pure manuscript decoration.

const FLOURISH_PATHS = {
  // A sweeping vine with a curled terminal + small leaf — drawn in one stroke.
  corner:
    "M4 92 C 4 60, 20 40, 52 40 C 80 40, 92 24, 92 4 M52 40 C 60 56, 78 58, 88 50 M30 50 C 26 62, 30 74, 42 76",
  // A horizontal divider flourish (centered), symmetric scrollwork.
  divider:
    "M2 12 C 30 12, 30 4, 60 12 C 70 15, 76 6, 84 12 C 92 17, 104 17, 118 12 C 132 7, 144 7, 158 12 C 172 17, 178 8, 188 12 C 218 20, 218 12, 246 12",
};

export const InkFlourish: React.FC<{
  variant?: "corner" | "divider";
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "bottom-center" | "top-center";
  color?: string;
  size?: number;
  startFrame?: number;
  durationFrames?: number;
}> = ({
  variant = "corner",
  position = "top-left",
  color = GOLD,
  size = 150,
  startFrame = 0,
  durationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const draw = easeOutCubic(
    interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const dash = variant === "divider" ? 700 : 500;
  const offset = dash * (1 - draw);
  const fadeIn = interpolate(local, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const isDivider = variant === "divider";
  const right = position.endsWith("right");
  const bottom = position.startsWith("bottom");
  const center = position.endsWith("center");

  const wrap: React.CSSProperties = { position: "absolute", pointerEvents: "none", opacity: 0.75 * fadeIn };
  if (center) {
    wrap.left = "50%";
    wrap[bottom ? "bottom" : "top"] = "8%";
    wrap.transform = `translateX(-50%)`;
  } else {
    wrap[right ? "right" : "left"] = "4%";
    wrap[bottom ? "bottom" : "top"] = "5%";
    // Flip the corner motif to point inward from each corner.
    wrap.transform = `scale(${right ? -1 : 1}, ${bottom ? -1 : 1})`;
  }

  const w = isDivider ? size * 1.7 : size;
  const h = isDivider ? size * 0.18 : size;
  const viewBox = isDivider ? "0 0 248 24" : "0 0 96 96";

  return (
    <div style={wrap}>
      <svg width={w} height={h} viewBox={viewBox} fill="none">
        <path
          d={FLOURISH_PATHS[variant]}
          stroke={color}
          strokeWidth={isDivider ? 2 : 2.4}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 1px 1px rgba(60,40,8,0.4))` }}
        />
        {/* Small terminal dots that ink in once the stroke nears completion. */}
        {!isDivider && (
          <circle cx={92} cy={4} r={2.6} fill={color} opacity={draw > 0.9 ? (draw - 0.9) * 10 : 0} />
        )}
      </svg>
    </div>
  );
};
