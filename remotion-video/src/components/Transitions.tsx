import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Scan bars: five staggered horizontal sweeps
const SCAN_BARS = [
  { top: "9%",  h: 18, delay: 3  },
  { top: "26%", h: 13, delay: 6  },
  { top: "46%", h: 20, delay: 9  },
  { top: "63%", h: 13, delay: 12 },
  { top: "81%", h: 15, delay: 15 },
];

// Total duration: 30 frames.  Callers in DefaultVideo.tsx must match.
const TRANS_FRAMES = 30;

/**
 * Returns the plane position on the bezier arc at a given frame number.
 * Used for both the live position and motion-trail ghost copies.
 */
function planeAtFrame(f: number, w: number, h: number) {
  const t = interpolate(f, [2, TRANS_FRAMES - 3], [0, 1], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });
  // Quadratic bezier: top-right → centre arc → bottom-left
  const sx = w *  1.14, sy = h * -0.12;
  const ex = w * -0.12, ey = h *  1.14;
  const cx = w *  0.44, cy = h *  0.44;
  const mt = 1 - t;
  const px = mt * mt * sx + 2 * mt * t * cx + t * t * ex;
  const py = mt * mt * sy + 2 * mt * t * cy + t * t * ey;
  // Tangent for rotation
  const tdx = 2 * mt * (cx - sx) + 2 * t * (ex - cx);
  const tdy = 2 * mt * (cy - sy) + 2 * t * (ey - cy);
  const angle = Math.atan2(tdy, tdx) * (180 / Math.PI);
  // Scale: biggest near the diagonal centre
  const distFromCentre = Math.hypot(px / w - 0.5, py / h - 0.5);
  const scale = interpolate(distFromCentre, [0, 0.55], [5.0, 2.8], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });
  return { px, py, angle, scale, t };
}

/**
 * Newscast-style impact transition — 30 frames:
 *
 *  Phase 1  (0–6)   : Accent-tinted thunderclap flash
 *  Phase 2  (3–27)  : Paper plane sweeps diagonally TR→BL with three
 *                     motion-trail ghost copies + radial glow halo
 *  Phase 3  (3–27)  : Five horizontal scan bars sweep left→right, staggered
 *  Phase 4  (0–30)  : Dark vignette overlay adds cinematic depth
 *  Finale   (24–30) : White veil for a clean handoff to the next scene
 */
export const TransitionWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ── Live plane + 3 motion-trail ghosts ──────────────────────────────────
  const p0 = planeAtFrame(frame,      width, height);
  const p1 = planeAtFrame(frame -  5, width, height);
  const p2 = planeAtFrame(frame - 10, width, height);
  const p3 = planeAtFrame(frame - 15, width, height);

  // Plane visible from frame 2 to TRANS_FRAMES - 3
  const planeOpacity = interpolate(
    frame,
    [2, 6, TRANS_FRAMES - 7, TRANS_FRAMES - 2],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Phase 1: thunderclap flash (accent-coloured + white) ────────────────
  const flashOpacity = interpolate(frame, [0, 2, 6], [0, 1, 0], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase 4: dark vignette ────────────────────────────────────────────────
  // Rises quickly then fades — creates a "moment of impact" depth cue
  const vigOpacity = interpolate(
    frame,
    [0, 4, 16, TRANS_FRAMES],
    [0, 0.42, 0.38, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Finale: white veil ────────────────────────────────────────────────────
  const veilOpacity = interpolate(
    frame,
    [TRANS_FRAMES - 7, TRANS_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const PLANE_PATH =
    "M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z";

  const renderPlane = (
    { px, py, angle, scale }: ReturnType<typeof planeAtFrame>,
    opacity: number,
    key: string | number,
    fillColor = "white",
    glowColor = "rgba(255,255,255,0.85)"
  ) => (
    <g
      key={key}
      transform={`translate(${px}, ${py}) rotate(${angle + 90}) scale(${scale}) translate(-11.5, -11)`}
      opacity={opacity}
      style={{
        filter: `drop-shadow(0 0 16px ${glowColor}) drop-shadow(0 0 6px rgba(200,220,255,0.7))`,
      }}
    >
      <path d={PLANE_PATH} fill={fillColor} />
      <path d="M11.5,2 L13,9 L10,9 Z" fill="white" fillOpacity={0.5} />
    </g>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {/* Phase 4 — dark vignette (depth) */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)",
          opacity: vigOpacity,
        }}
      />

      {/* Phase 1 — thunderclap flash */}
      <AbsoluteFill
        style={{ backgroundColor: "#fff", opacity: flashOpacity }}
      />

      {/* Phase 3 — scan bars */}
      {SCAN_BARS.map((bar, i) => {
        const barX = interpolate(
          frame,
          [bar.delay, bar.delay + 9],
          [-100, 220],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const barAlpha = interpolate(
          frame,
          [bar.delay, bar.delay + 2, bar.delay + 7, bar.delay + 10],
          [0, 0.9, 0.9, 0],
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
              height: bar.h,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${barX}%`,
                width: "55%",
                height: "100%",
                background:
                  "linear-gradient(to right, transparent, rgba(255,255,255,0.95) 40%, transparent)",
                opacity: barAlpha,
              }}
            />
          </div>
        );
      })}

      {/* Phase 2 — plane sweep with motion-trail ghosts + radial glow halo */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        {/* Radial glow halo at the plane's current position */}
        {planeOpacity > 0.05 && (
          <>
            <radialGradient
              id="plane-halo"
              cx="50%"
              cy="50%"
              r="50%"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={width}
              y2={height}
            />
            <circle
              cx={p0.px}
              cy={p0.py}
              r={p0.scale * 28}
              fill="white"
              fillOpacity={planeOpacity * 0.22}
              style={{ filter: "blur(12px)" }}
            />
            {/* Speed streak: blurred line from oldest trail to current */}
            <line
              x1={p3.px} y1={p3.py}
              x2={p0.px} y2={p0.py}
              stroke="white"
              strokeWidth={p0.scale * 7}
              strokeOpacity={planeOpacity * 0.12}
              strokeLinecap="round"
              style={{ filter: "blur(5px)" }}
            />
          </>
        )}

        {/* Trail ghosts — progressively more transparent, slightly smaller */}
        {renderPlane(p3, planeOpacity * 0.08, "trail3")}
        {renderPlane(p2, planeOpacity * 0.16, "trail2")}
        {renderPlane(p1, planeOpacity * 0.30, "trail1")}

        {/* Live plane */}
        {renderPlane(p0, planeOpacity, "live")}
      </svg>

      {/* Finale — white veil */}
      <AbsoluteFill
        style={{ backgroundColor: "#FFFFFF", opacity: veilOpacity }}
      />
    </AbsoluteFill>
  );
};

export const TransitionFade: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity }} />;
};
