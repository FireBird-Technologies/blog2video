/**
 * Pencil primitives for Crumpled Paper.
 *
 * <PencilLayer> is a full-canvas SVG carrying one wobble filter (STATIC turbulence +
 * displacement — never animated). <PencilStroke> draws a path on with
 * strokeDashoffset, double-struck like a real pencil. The *Path helpers build
 * deterministic, slightly imperfect shapes (underline, scribbled circle, arrow,
 * sketchy box, tick, hatching, doodle star).
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React, { createContext, useContext, useId } from "react";
import { useVideoConfig } from "remotion";
import { rand } from "../crumpledStyle";

const PencilFilterContext = createContext<string>("");

export const PencilLayer: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Wobble strength in px. */
  wobble?: number;
  /** Explicit size for an inline (in-flow) layer; defaults to the full canvas, absolutely positioned. */
  width?: number;
  height?: number;
}> = ({ children, style, wobble = 2.6, width: w, height: h }) => {
  const video = useVideoConfig();
  const inline = w !== undefined && h !== undefined;
  const width = w ?? video.width;
  const height = h ?? video.height;
  const id = `pencil-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        ...(inline ? { display: "block", flexShrink: 0 } : { position: "absolute", inset: 0 }),
        overflow: "visible",
        pointerEvents: "none",
        ...style,
      }}
    >
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="wob" />
          <feDisplacementMap in="SourceGraphic" in2="wob" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="9" result="tooth" />
          <feComponentTransfer in="tooth" result="toothA">
            <feFuncA type="linear" slope="1.6" intercept="-0.25" />
          </feComponentTransfer>
          <feComposite in="d" in2="toothA" operator="in" />
        </filter>
      </defs>
      <PencilFilterContext.Provider value={id}>{children}</PencilFilterContext.Provider>
    </svg>
  );
};

/** A pencil line that draws itself on as `progress` goes 0 → 1. */
export const PencilStroke: React.FC<{
  d: string;
  progress?: number;
  color: string;
  width?: number;
  opacity?: number;
  /** Second, slightly offset pass — reads as a real pencil going over the line twice. */
  double?: boolean;
  fill?: string;
}> = ({ d, progress = 1, color, width = 4, opacity = 0.92, double = true, fill = "none" }) => {
  const filterId = useContext(PencilFilterContext);
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return null;
  const dash = { strokeDasharray: 1, strokeDashoffset: 1 - p } as const;
  return (
    <g filter={filterId ? `url(#${filterId})` : undefined} opacity={opacity}>
      {fill !== "none" ? <path d={d} fill={fill} stroke="none" opacity={p} /> : null}
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={dash} />
      {double ? (
        <path
          d={d}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth={width * 0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
          transform="translate(1.6 -1.2)"
          style={dash}
        />
      ) : null}
    </g>
  );
};

const f = (n: number) => n.toFixed(1);

/** Slightly wavy underline with a little overshoot hook at the end. */
export const underlinePath = (x: number, y: number, w: number, seed = 1): string => {
  const segs = 5;
  let d = `M${f(x)} ${f(y + (rand(seed) - 0.5) * 4)}`;
  for (let i = 1; i <= segs; i++) {
    const px = x + (w * i) / segs;
    const py = y + (rand(seed + i * 3.1) - 0.5) * 7;
    const cx = x + (w * (i - 0.5)) / segs;
    const cy = y + (rand(seed + i * 5.7) - 0.5) * 10;
    d += ` Q${f(cx)} ${f(cy)} ${f(px)} ${f(py)}`;
  }
  return d + ` q${f(-w * 0.04)} ${f(6)} ${f(-w * 0.09)} ${f(9)}`;
};

/** Hand-drawn ellipse that overshoots its start, like a quick pencil circle. */
export const scribbleCirclePath = (cx: number, cy: number, rx: number, ry: number, seed = 1, turns = 1.18): string => {
  const steps = 48;
  const start = -Math.PI * 0.62 + rand(seed) * 0.4;
  let d = "";
  for (let i = 0; i <= steps * turns; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const k = 1 + (rand(seed + Math.floor(i / 6) * 2.3) - 0.5) * 0.06 + (i / steps) * 0.04;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    d += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)} `;
  }
  return d.trim();
};

/** Curved arrow from (x1,y1) to (x2,y2) with a hand-drawn head. Returns shaft + head separately. */
export const arrowPaths = (x1: number, y1: number, x2: number, y2: number, bend = 0.25, seed = 1) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * len * bend;
  const cy = my + ny * len * bend;
  const shaft = `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
  const ang = Math.atan2(y2 - cy, x2 - cx);
  const head = Math.min(34, len * 0.22) * (0.9 + rand(seed) * 0.2);
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.8;
  const headPath = `M${f(x2 + Math.cos(a1) * head)} ${f(y2 + Math.sin(a1) * head)} L${f(x2)} ${f(y2)} L${f(x2 + Math.cos(a2) * head)} ${f(y2 + Math.sin(a2) * head)}`;
  return { shaft, head: headPath };
};

/** Sketchy rectangle — each side a separate stroke with overshooting corners. */
export const sketchBoxPath = (x: number, y: number, w: number, h: number, seed = 1): string => {
  const o = Math.min(14, Math.min(w, h) * 0.06);
  const j = (k: number) => (rand(seed + k) - 0.5) * o;
  return [
    `M${f(x - o + j(1))} ${f(y + j(2))} L${f(x + w + o + j(3))} ${f(y + j(4))}`,
    `M${f(x + w + j(5))} ${f(y - o + j(6))} L${f(x + w + j(7))} ${f(y + h + o + j(8))}`,
    `M${f(x + w + o + j(9))} ${f(y + h + j(10))} L${f(x - o + j(11))} ${f(y + h + j(12))}`,
    `M${f(x + j(13))} ${f(y + h + o + j(14))} L${f(x + j(15))} ${f(y - o + j(16))}`,
  ].join(" ");
};

/** A quick check mark sized `s` with its bottom-left at (x, y). */
export const tickPath = (x: number, y: number, s: number): string =>
  `M${f(x)} ${f(y - s * 0.45)} L${f(x + s * 0.36)} ${f(y)} L${f(x + s)} ${f(y - s * 0.95)}`;

/** Diagonal hatching inside a rectangle (one path). */
export const hatchPath = (x: number, y: number, w: number, h: number, gap = 14): string => {
  let d = "";
  for (let k = -h; k < w; k += gap) {
    // 45° line: (px - x) - (y + h - py) = k, clipped to the rectangle.
    const x1 = x + Math.max(0, k);
    const y1 = y + h - (x1 - x - k);
    const x2 = x + Math.min(w, k + h);
    const y2 = y + h - (x2 - x - k);
    if (x2 > x1) d += `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} `;
  }
  return d.trim();
};

/** Five-point doodle star. */
export const doodleStarPath = (cx: number, cy: number, r: number, seed = 1): string => {
  let d = "";
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const k = 1 + (rand(seed + i) - 0.5) * 0.12;
    d += `${i === 0 ? "M" : "L"}${f(cx + Math.cos(a) * r * k)} ${f(cy + Math.sin(a) * r * k)} `;
  }
  return d.trim();
};

/** Big scribbled double quote mark (“) — two commas with tails. */
export const quoteMarkPath = (x: number, y: number, s: number): string => {
  const one = (ox: number) =>
    `M${f(ox + s * 0.42)} ${f(y)} C${f(ox + s * 0.05)} ${f(y + s * 0.18)} ${f(ox - s * 0.02)} ${f(y + s * 0.62)} ${f(ox + s * 0.22)} ${f(y + s * 0.78)} ` +
    `C${f(ox + s * 0.42)} ${f(y + s * 0.92)} ${f(ox + s * 0.5)} ${f(y + s * 0.58)} ${f(ox + s * 0.28)} ${f(y + s * 0.5)} ` +
    `C${f(ox + s * 0.14)} ${f(y + s * 0.46)} ${f(ox + s * 0.1)} ${f(y + s * 0.6)} ${f(ox + s * 0.16)} ${f(y + s * 0.66)}`;
  return `${one(x)} ${one(x + s * 0.62)}`;
};
