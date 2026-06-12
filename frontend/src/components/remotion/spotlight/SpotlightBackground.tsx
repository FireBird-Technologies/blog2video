import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * SpotlightBackground — the animated dark stage.
 *
 * A layered, deterministic (frame-driven, render-safe) backdrop that sits behind
 * every Spotlight scene so the black stage feels alive without competing with the
 * bold type:
 *   1. base fill (bgColor)
 *   2. a faint broadcast-grid texture (very low alpha)
 *   3. ONE pair of large accent-red glows that slowly drift (Nightfall-style sin/cos)
 *   4. a soft vignette so the centre stage reads brighter than the corners
 *
 * Pure function of useCurrentFrame() — no timers, no Math.random at render time —
 * so headless renders match the preview frame-for-frame.
 */

/** "#EF4444" + alpha → "rgba(239,68,68,a)". Falls back to red on a bad hex. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return `rgba(239,68,68,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const SpotlightBackground: React.FC<{
  bgColor?: string;
  accentColor?: string;
  /** 0 = off, 1 = default bold. Scales the drifting glow strength. */
  intensity?: number;
}> = ({ bgColor = "#000000", accentColor = "#EF4444", intensity = 1 }) => {
  const frame = useCurrentFrame();

  // Slow drift over a 360-frame (12s) cycle — sin/cos so it loops smoothly and is
  // fully deterministic.
  const t = (frame / 360) % 1;
  const gx = 32 + Math.sin(t * Math.PI * 2) * 14;
  const gy = 28 + Math.cos(t * Math.PI * 2) * 10;
  const gx2 = 78 + Math.cos(t * Math.PI * 2 + 1.2) * 12;
  const gy2 = 74 + Math.sin(t * Math.PI * 2 + 1.2) * 9;

  // Glow alphas — bold for a dark stage, but still a whisper behind the type.
  const glow1 = hexToRgba(accentColor, 0.1 * intensity);
  const glow2 = hexToRgba(accentColor, 0.06 * intensity);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Drifting accent-red glows */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            radial-gradient(ellipse ${120 + 30 * t}% 90% at ${gx}% ${gy}%, ${glow1} 0%, transparent 55%),
            radial-gradient(ellipse 100% 100% at ${gx2}% ${gy2}%, ${glow2} 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />
      {/* Faint broadcast-grid texture */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          pointerEvents: "none",
        }}
      />
      {/* Vignette — darkens corners, focuses the centre stage */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 75% at 50% 48%, transparent 0%, transparent 55%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
