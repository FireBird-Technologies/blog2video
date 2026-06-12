import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";

interface GeometricBackgroundProps {
  /** Brand accent colour — contour lines and glow use this colour. */
  accentColor: string;
  /** Current frame — drives the gentle wave drift. */
  frame: number;
  /** Scene index — varies the background slide-in/out direction. */
  sceneIndex?: number;
}

const DIRECTIONS = [
  { x: -1, y:  0 },
  { x:  1, y:  0 },
  { x:  0, y: -1 },
  { x:  0, y:  1 },
] as const;

/**
 * Full-bleed background for the Geometric Explainer template.
 *
 * Renders 4 very subtle, slowly-drifting sine contour lines as a
 * barely-visible depth layer.  The whole layer slides in from a
 * per-scene direction and exits toward the opposite side.
 *
 * NO plane here — there is exactly one plane on screen (in ScenePlane)
 * and only during scene-entry / scene-exit.
 */
export const GeometricBackground: React.FC<GeometricBackgroundProps> = ({
  accentColor,
  frame,
  sceneIndex = 0,
}) => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const BLEED = 80;
  const vbW = width  + BLEED * 2;
  const vbH = height + BLEED * 2;

  // ── Background slide-in / slide-out ───────────────────────────────────────
  const dir     = DIRECTIONS[Math.abs(sceneIndex) % 4];
  const exitDir = DIRECTIONS[(Math.abs(sceneIndex) + 2) % 4];
  const TRAVEL  = 140;

  const enter = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 70, mass: 1.2 },
  });
  const EXIT_DUR  = 22;
  const exitStart = Math.max(0, durationInFrames - EXIT_DUR);
  const exit = spring({
    frame: frame - exitStart,
    fps,
    config: { damping: 200, stiffness: 110 },
    durationInFrames: EXIT_DUR,
  });

  const bgSlideX =
    interpolate(enter, [0, 1], [dir.x * TRAVEL, 0]) +
    interpolate(exit,  [0, 1], [0, exitDir.x * TRAVEL]);
  const bgSlideY =
    interpolate(enter, [0, 1], [dir.y * TRAVEL, 0]) +
    interpolate(exit,  [0, 1], [0, exitDir.y * TRAVEL]);
  const bgOpacity = enter * (1 - exit);

  // ── Subtle contour waves ───────────────────────────────────────────────────
  // 4 lines, very low amplitude, low opacity — purely atmospheric depth.
  const NUM_LINES = 4;
  const SAMPLES   = 80;            // more samples → smoother curve
  const flow = frame / fps;

  const buildPath = (i: number): string => {
    const t      = i / (NUM_LINES - 1);
    const baseY  = BLEED * 0.3 + t * (height + BLEED * 0.4);
    // Amplitude 2–5 px — barely visible; scales with bgOpacity so it unfurls
    const amp    = (2 + 3 * Math.abs(Math.sin(i * 1.2 + 1.0))) * bgOpacity;
    // Long wavelength — one or two humps across the whole canvas
    const freq   = (Math.PI * 2) / vbW * (0.40 + 0.07 * i);
    // Very slow drift
    const phase  = i * 1.6 + flow * (0.08 + 0.015 * i);

    // Blend two harmonics for a more organic, flowing (less mechanical) shape
    const harm2amp = amp * 0.30;
    const harm2freq = freq * 2.1;

    let d = "";
    for (let s = 0; s <= SAMPLES; s++) {
      const x = -BLEED + (s / SAMPLES) * vbW;
      const y = baseY
        + amp      * Math.sin(x * freq   + phase)
        + harm2amp * Math.sin(x * harm2freq + phase * 1.4);
      d += s === 0
        ? `M ${x.toFixed(1)} ${y.toFixed(1)}`
        : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  const glowId = `geo-glow-s${Math.abs(sceneIndex)}`;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ opacity: bgOpacity }}>
        <svg
          width={vbW}
          height={vbH}
          viewBox={`${-BLEED} ${-BLEED} ${vbW} ${vbH}`}
          style={{
            position: "absolute",
            top: -BLEED,
            left: -BLEED,
            transform: `translate(${bgSlideX}px, ${bgSlideY}px)`,
          }}
        >
          <defs>
            <radialGradient id={glowId} cx="50%" cy="40%" r="52%">
              <stop offset="0%"   stopColor={accentColor} stopOpacity={0.07} />
              <stop offset="60%"  stopColor={accentColor} stopOpacity={0.02} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* Very faint central glow */}
          <rect
            x={-BLEED} y={-BLEED}
            width={vbW} height={vbH}
            fill={`url(#${glowId})`}
          />
          {/* Subtle wavy contour lines */}
          {Array.from({ length: NUM_LINES }, (_, i) => (
            <path
              key={i}
              d={buildPath(i)}
              fill="none"
              stroke={accentColor}
              strokeOpacity={0.07}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
};
