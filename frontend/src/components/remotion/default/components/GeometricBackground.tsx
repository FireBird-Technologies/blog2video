import React from "react";
import { interpolate, useVideoConfig } from "remotion";

interface GeometricBackgroundProps {
  /** Brand accent colour — all shapes are drawn at low opacity with this colour */
  accentColor: string;
  /** Current frame — drives the slow parallax drift */
  frame: number;
}

/**
 * Full-bleed geometric SVG background for the Geometric Explainer template.
 *
 * Layers (back → front):
 *  1. Grid of outlined rectangles tiling the frame
 *  2. Two sets of diagonal lines (+45° and −45°) forming a criss-cross hatch
 *  3. Thick corner-cross marks (newscast lower-third style) in each corner
 *
 * The whole SVG layer drifts a few pixels over the scene duration for a
 * subtle parallax feel. All strokes use the brand accentColor at very low
 * opacity so the background never competes with content.
 */
export const GeometricBackground: React.FC<GeometricBackgroundProps> = ({
  accentColor,
  frame,
}) => {
  const { width, height, durationInFrames } = useVideoConfig();

  // Slow parallax drift — the svg shifts slightly as the scene plays
  const driftX = interpolate(frame, [0, durationInFrames], [-6, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, durationInFrames], [-4, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid dimensions
  const COLS = 6;
  const ROWS = 5;
  const cellW = width / COLS;
  const cellH = height / ROWS;
  const PAD = 14; // inset from cell edge

  // Diagonal criss-cross — spacing between parallel diagonal lines
  const DIAG_SPACING = 110;
  const numDiags = Math.ceil((width + height) / DIAG_SPACING) + 4;

  // Corner cross arm half-length and weight
  const ARM = 32;
  const CROSS_WEIGHT = 3.5;
  const CORNER_INSET = 58;
  const corners = [
    { cx: CORNER_INSET,         cy: CORNER_INSET },
    { cx: width - CORNER_INSET, cy: CORNER_INSET },
    { cx: CORNER_INSET,         cy: height - CORNER_INSET },
    { cx: width - CORNER_INSET, cy: height - CORNER_INSET },
  ];

  // We render the SVG slightly oversized (+ 20px on each side) so the drift
  // never reveals a raw edge.
  const BLEED = 20;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <svg
        width={width + BLEED * 2}
        height={height + BLEED * 2}
        viewBox={`${-BLEED} ${-BLEED} ${width + BLEED * 2} ${height + BLEED * 2}`}
        style={{
          position: "absolute",
          top: -BLEED,
          left: -BLEED,
          transform: `translate(${driftX}px, ${driftY}px)`,
        }}
      >
        {/* ── Layer 1: Grid of outlined rectangles ──────────────────────── */}
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => (
            <rect
              key={`box-${row}-${col}`}
              x={col * cellW + PAD}
              y={row * cellH + PAD}
              width={cellW - PAD * 2}
              height={cellH - PAD * 2}
              fill="none"
              stroke={accentColor}
              strokeOpacity={0.07}
              strokeWidth={1.5}
              rx={5}
            />
          ))
        )}

        {/* ── Layer 2a: Diagonal lines at +45° ─────────────────────────── */}
        {Array.from({ length: numDiags }, (_, i) => {
          const offset = (i - 3) * DIAG_SPACING;
          return (
            <line
              key={`dp-${i}`}
              x1={offset}
              y1={0}
              x2={offset + height}
              y2={height}
              stroke={accentColor}
              strokeOpacity={0.045}
              strokeWidth={1}
            />
          );
        })}

        {/* ── Layer 2b: Diagonal lines at −45° (criss-cross pair) ───────── */}
        {Array.from({ length: numDiags }, (_, i) => {
          const offset = (i - 3) * DIAG_SPACING;
          return (
            <line
              key={`dn-${i}`}
              x1={width - offset}
              y1={0}
              x2={-offset}
              y2={height}
              stroke={accentColor}
              strokeOpacity={0.045}
              strokeWidth={1}
            />
          );
        })}

        {/* ── Layer 3: Corner accent crosses ────────────────────────────── */}
        {corners.map(({ cx, cy }, i) => (
          <g key={`cross-${i}`}>
            {/* Horizontal arm */}
            <line
              x1={cx - ARM}
              y1={cy}
              x2={cx + ARM}
              y2={cy}
              stroke={accentColor}
              strokeOpacity={0.22}
              strokeWidth={CROSS_WEIGHT}
              strokeLinecap="round"
            />
            {/* Vertical arm */}
            <line
              x1={cx}
              y1={cy - ARM}
              x2={cx}
              y2={cy + ARM}
              stroke={accentColor}
              strokeOpacity={0.22}
              strokeWidth={CROSS_WEIGHT}
              strokeLinecap="round"
            />
            {/* Centre dot — slightly more opaque for a sharp anchor point */}
            <circle
              cx={cx}
              cy={cy}
              r={4}
              fill={accentColor}
              fillOpacity={0.3}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
