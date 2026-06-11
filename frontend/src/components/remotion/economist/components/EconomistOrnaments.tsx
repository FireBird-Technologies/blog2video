import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ECONOMIST_COLORS } from "../constants";

/**
 * EconomistOrnaments — real-SVG editorial decoration for the Economist template.
 *
 * Three families, all vector and all tuned to the warm-paper / one-red palette:
 *   1. EditorialDivider — an engraved centre-diamond rule that draws on.
 *   2. CornerFlourish   — a small L-bracket + diamond for card corners.
 *   3. EngravingTexture — a very low-opacity diagonal hairline field that fills
 *                         dead whitespace behind dividers / quotes.
 *   4. TrendGlyph       — an inline up/down/flat arrow glyph (replaces ▲▼ unicode).
 *   5. SparkLine        — a tiny SVG trend line for KPI cells, drawn from data.
 *
 * Animations follow the template convention (interpolate fades / scale-ins,
 * clamped both ends) so they compose with each layout's own timeline.
 */

// ── 1. Editorial divider ─────────────────────────────────────────────────────
export const EditorialDivider: React.FC<{
  width: number;
  color?: string;
  accentColor?: string;
  /** 0..1 draw-on progress. Defaults to a self-driven [8,28] frame reveal. */
  progress?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({
  width,
  color = ECONOMIST_COLORS.rule,
  accentColor = ECONOMIST_COLORS.accent,
  progress,
  height = 18,
  style,
}) => {
  const frame = useCurrentFrame();
  const p =
    progress ??
    interpolate(frame, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cx = width / 2;
  const cy = height / 2;
  const half = (width / 2) * p;
  const d = 5; // diamond half-size
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style}>
      <line x1={cx - half} y1={cy} x2={cx - d - 4} y2={cy} stroke={color} strokeWidth={1.5} />
      <line x1={cx + d + 4} y1={cy} x2={cx + half} y2={cy} stroke={color} strokeWidth={1.5} />
      <rect
        x={cx - d}
        y={cy - d}
        width={d * 2}
        height={d * 2}
        fill={accentColor}
        transform={`rotate(45 ${cx} ${cy}) scale(${p})`}
        style={{ transformOrigin: `${cx}px ${cy}px` } as React.CSSProperties}
      />
    </svg>
  );
};

// ── 2. Corner flourish ───────────────────────────────────────────────────────
export const CornerFlourish: React.FC<{
  size?: number;
  color?: string;
  accentColor?: string;
  /** Which corner the bracket hugs. */
  corner?: "tl" | "tr" | "bl" | "br";
  progress?: number;
  style?: React.CSSProperties;
}> = ({
  size = 40,
  color = ECONOMIST_COLORS.rule,
  accentColor = ECONOMIST_COLORS.accent,
  corner = "tl",
  progress,
  style,
}) => {
  const frame = useCurrentFrame();
  const p =
    progress ??
    interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const len = size * p;
  // Base bracket drawn for "tl"; flip via SVG transform for the other corners.
  const flip =
    corner === "tr"
      ? `scale(-1 1) translate(${-size} 0)`
      : corner === "bl"
        ? `scale(1 -1) translate(0 ${-size})`
        : corner === "br"
          ? `scale(-1 -1) translate(${-size} ${-size})`
          : undefined;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      <g transform={flip}>
        <line x1={0} y1={0} x2={len} y2={0} stroke={color} strokeWidth={1.5} />
        <line x1={0} y1={0} x2={0} y2={len} stroke={color} strokeWidth={1.5} />
        <rect
          x={-3.5}
          y={-3.5}
          width={7}
          height={7}
          fill={accentColor}
          transform="rotate(45 0 0)"
          opacity={p}
        />
      </g>
    </svg>
  );
};

// ── 3. Engraving texture ─────────────────────────────────────────────────────
let _engraveSeq = 0;
export const EngravingTexture: React.FC<{
  color?: string;
  opacity?: number;
  /** Spacing between hairlines (px). */
  gap?: number;
  angle?: number;
  style?: React.CSSProperties;
}> = ({ color = ECONOMIST_COLORS.ink, opacity = 0.04, gap = 9, angle = -45, style }) => {
  // Stable per-instance id so multiple textures don't collide in one document.
  const id = React.useMemo(() => `econ-engrave-${_engraveSeq++}`, []);
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, ...style }}>
      <defs>
        <pattern
          id={id}
          width={gap}
          height={gap}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={0.75} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
};

// ── 3b. Concentric rings (cover-motif backdrop) ──────────────────────────────
// The signature Economist cover motif — a set of concentric hairline arcs — as a
// reusable ambient backdrop. Each ring draws on with a small stagger and the
// whole field drifts on a slow deterministic orbit so it breathes without ever
// distracting from the type in front of it. Pure function of the current frame
// (no randomness / Date) so headless renders match the preview frame-for-frame.
export const ConcentricRings: React.FC<{
  /** Centre in viewBox (0–100) units. */
  cx?: number;
  cy?: number;
  /** Ring radii in viewBox units (outermost last is fine — order is cosmetic). */
  radii?: number[];
  color?: string;
  /** Opacity of the whole field. */
  opacity?: number;
  strokeWidth?: number;
  /** When false, the rings are static (no draw-on / drift). */
  animate?: boolean;
  style?: React.CSSProperties;
}> = ({
  cx = 82,
  cy = 26,
  radii = [22, 36, 50, 64, 78],
  color = ECONOMIST_COLORS.rule,
  opacity = 0.6,
  strokeWidth = 0.16,
  animate = true,
  style,
}) => {
  const frame = useCurrentFrame();
  // Slow breathing drift of the whole field (tiny amplitude in viewBox units).
  const a = (frame / 540) * Math.PI * 2;
  const driftX = animate ? Math.sin(a) * 0.9 : 0;
  const driftY = animate ? Math.cos(a * 0.7) * 0.6 : 0;
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, ...style }}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      {radii.map((r, i) => {
        // Each ring draws on with a small stagger; the circumference is the
        // dash length so strokeDashoffset → 0 sweeps the stroke into place.
        const circ = 2 * Math.PI * r;
        const draw = animate
          ? interpolate(frame, [6 + i * 6, 6 + i * 6 + 26], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1;
        return (
          <circle
            key={i}
            cx={cx + driftX}
            cy={cy + driftY}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={animate ? circ : undefined}
            strokeDashoffset={animate ? circ * (1 - draw) : undefined}
          />
        );
      })}
    </svg>
  );
};

// ── 4. Trend glyph (inline up/down/flat arrow) ───────────────────────────────
export const TrendGlyph: React.FC<{
  direction: "up" | "down" | "flat";
  size?: number;
  color: string;
  style?: React.CSSProperties;
}> = ({ direction, size = 16, color, style }) => {
  const s = size;
  const path =
    direction === "up"
      ? `M${s / 2} 1 L${s - 1} ${s - 2} L1 ${s - 2} Z`
      : direction === "down"
        ? `M${s / 2} ${s - 1} L${s - 1} 2 L1 2 Z`
        : `M1 ${s / 2} L${s - 1} ${s / 2}`;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ display: "inline-block", verticalAlign: "baseline", ...style }}
    >
      {direction === "flat" ? (
        <line x1={1} y1={s / 2} x2={s - 1} y2={s / 2} stroke={color} strokeWidth={2.5} />
      ) : (
        <path d={path} fill={color} />
      )}
    </svg>
  );
};

// ── 5. Spark line (tiny KPI trend) ───────────────────────────────────────────
export const SparkLine: React.FC<{
  values: number[];
  width?: number;
  height?: number;
  color: string;
  /** 0..1 draw-on progress; defaults to a self-driven [16,40] reveal. */
  progress?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}> = ({ values, width = 96, height = 28, color, progress, strokeWidth = 2.5, style }) => {
  const frame = useCurrentFrame();
  const p =
    progress ??
    interpolate(frame, [16, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const pad = strokeWidth;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const pts = finite.map((v, i) => {
    const x = pad + (i / (finite.length - 1)) * innerW;
    const y = pad + (1 - (v - min) / span) * innerH;
    return { x, y };
  });
  // Reveal a leading fraction of the polyline.
  const frontier = p * (pts.length - 1);
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    if (i <= frontier) {
      d += `${i === 0 ? "M" : "L"}${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} `;
    } else {
      const prev = pts[i - 1];
      const frac = frontier - (i - 1);
      const hx = prev.x + (pts[i].x - prev.x) * frac;
      const hy = prev.y + (pts[i].y - prev.y) * frac;
      d += `L${hx.toFixed(1)},${hy.toFixed(1)} `;
      break;
    }
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style}>
      <path d={d.trim()} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
