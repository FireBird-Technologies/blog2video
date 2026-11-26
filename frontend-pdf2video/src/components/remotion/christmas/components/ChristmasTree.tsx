/**
 * A decorated Christmas tree in a local 400 × 580 box (trunk base at 200,580).
 *
 *  - `grow` 0→1: the four tiers pop in from the bottom up, then their snow caps.
 *  - `garland` 0→1: a gold garland draws itself on (strokeDashoffset).
 *  - `lights` 0→1: ornaments + fairy bulbs switch on one after another and twinkle.
 *  - `star` 0→1: the star pops on top and starts to glow.
 *
 * `treeAnchors(n)` returns n hanging points (local units) down alternate sides of
 * the tree so a layout can hang tags from them.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { Easing, interpolate } from "remotion";
import { christmasRand, clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";

const popOut = Easing.out(Easing.back(1.6));

const TIERS = [
  // [topY, bottomY, halfWidth at bottom]
  [70, 210, 110],
  [150, 320, 150],
  [250, 430, 185],
  [350, 530, 200],
] as const;

const tierPath = (top: number, bottom: number, half: number): string => {
  const cx = 200;
  const scallops = 5;
  let d = `M${cx} ${top} L${cx + half} ${bottom}`;
  for (let i = scallops; i > 0; i--) {
    const x1 = cx - half + ((i - 1) * 2 * half) / scallops;
    const xm = (x1 + cx - half + (i * 2 * half) / scallops) / 2;
    d += ` Q${xm} ${bottom + 16} ${x1} ${bottom}`;
  }
  return `${d} Z`;
};

const snowPath = (top: number, bottom: number, half: number): string => {
  const cx = 200;
  const y = top + (bottom - top) * 0.06;
  const w = half * 0.22;
  return `M${cx - w} ${y + 18} Q${cx} ${y - 14} ${cx + w} ${y + 18} Q${cx + w * 0.4} ${y + 30} ${cx} ${y + 22} Q${cx - w * 0.4} ${y + 30} ${cx - w} ${y + 18} Z`;
};

const tierSnowEdge = (bottom: number, half: number): string => {
  const cx = 200;
  return `M${cx - half + 6} ${bottom - 4} Q${cx - half * 0.5} ${bottom - 18} ${cx} ${bottom - 8} Q${cx + half * 0.5} ${bottom - 20} ${cx + half - 6} ${bottom - 4} Q${cx} ${bottom + 6} ${cx - half + 6} ${bottom - 4} Z`;
};

/** A five-pointed star centred on (cx, cy). */
export const starPath = (cx: number, cy: number, outer: number, inner = outer * 0.45): string => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i === 0 ? "M" : "L"}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  }
  return `${d}Z`;
};

/** Hanging points down alternate sides of the tree (local units). */
export const treeAnchors = (n: number): Array<{ x: number; y: number; side: -1 | 1 }> =>
  Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const y = 190 + t * 320;
    const half = 80 + t * 115; // tree half-width at that height
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    return { x: 200 + side * half * 0.82, y, side };
  });

const ORNAMENTS = Array.from({ length: 16 }, (_, i) => {
  const tier = TIERS[i % 4];
  const t = 0.35 + christmasRand(41, i) * 0.55;
  const y = tier[0] + (tier[1] - tier[0]) * t;
  const half = ((y - tier[0]) / (tier[1] - tier[0])) * tier[2] * 0.78;
  return { x: 200 + (christmasRand(43, i) * 2 - 1) * half, y, r: 10 + christmasRand(47, i) * 6 };
}).sort((a, b) => b.y - a.y);

export const ChristmasTree: React.FC<{
  frame: number;
  accent: string;
  grow?: number;
  garland?: number;
  lights?: number;
  star?: number;
  /** Rendered height in px. */
  height: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ frame, accent, grow = 1, garland = 1, lights = 1, star = 1, height, style, children }) => {
  const id = React.useId().replace(/:/g, "");
  const bulbColors = [accent, FESTIVE.gold, "#3FA7E0", "#F4F4F4"];
  const starPulse = 0.75 + 0.25 * Math.sin(frame / 7);
  const garlandPaths = [
    "M110 200 Q200 240 290 190",
    "M82 300 Q200 350 330 290",
    "M52 410 Q200 470 365 400",
  ];
  return (
    <svg width={(400 * height) / 580} height={height} viewBox="0 0 400 580" style={{ overflow: "visible", ...style }}>
      <defs>
        <radialGradient id={`glow-${id}`}>
          <stop offset="0" stopColor={withOpacity(FESTIVE.goldLight, 0.9)} />
          <stop offset="1" stopColor={withOpacity(FESTIVE.goldLight, 0)} />
        </radialGradient>
        <linearGradient id={`pine-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={FESTIVE.pineDark} />
          <stop offset="0.5" stopColor={FESTIVE.pine} />
          <stop offset="1" stopColor={mix(FESTIVE.pineDark, "#000", 0.1)} />
        </linearGradient>
      </defs>

      {/* trunk + snow mound */}
      <rect x={180} y={520} width={40} height={50} fill={FESTIVE.woodDark} opacity={interpolate(grow, [0, 0.15], [0, 1], clamp)} />
      <ellipse cx={200} cy={572} rx={150} ry={16} fill={withOpacity(FESTIVE.snowShade, 0.55)} />

      {[...TIERS].reverse().map(([top, bottom, half], ri) => {
        const i = TIERS.length - 1 - ri;
        // bottom tier first
        const k = interpolate(grow, [ri * 0.18, ri * 0.18 + 0.36], [0, 1], clamp);
        const s = popOut(k);
        return (
          <g key={i} transform={`translate(200 ${bottom}) scale(${Math.max(0, s).toFixed(3)}) translate(-200 ${-bottom})`} opacity={k > 0 ? 1 : 0}>
            <path d={tierPath(top, bottom, half)} fill={`url(#pine-${id})`} />
            <path d={tierSnowEdge(bottom, half)} fill={FESTIVE.snow} opacity={interpolate(grow, [0.7, 1], [0, 0.95], clamp)} />
            <path d={snowPath(top, bottom, half)} fill={FESTIVE.snow} opacity={interpolate(grow, [0.7, 1], [0, 1], clamp)} />
          </g>
        );
      })}

      {/* garland */}
      {garlandPaths.map((d, i) => {
        const k = interpolate(garland, [i / 3, (i + 1) / 3], [0, 1], clamp);
        return k > 0 ? (
          <path key={i} d={d} stroke={FESTIVE.gold} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} />
        ) : null;
      })}

      {/* ornaments + bulbs */}
      {ORNAMENTS.map((o, i) => {
        const on = interpolate(lights, [i / ORNAMENTS.length, (i + 1) / ORNAMENTS.length], [0, 1], clamp);
        if (on <= 0) return null;
        const tw = 0.7 + 0.3 * Math.sin(frame / 6 + i * 1.7);
        const color = bulbColors[i % bulbColors.length];
        return (
          <g key={i} opacity={on}>
            <circle cx={o.x} cy={o.y} r={o.r * 2.2} fill={withOpacity(color, 0.22 * tw)} />
            <circle cx={o.x} cy={o.y} r={o.r * on} fill={color} />
            <circle cx={o.x - o.r * 0.35} cy={o.y - o.r * 0.35} r={o.r * 0.3} fill="#fff" opacity={0.7} />
          </g>
        );
      })}

      {/* star */}
      {star > 0 ? (
        <g transform={`translate(200 62) scale(${interpolate(star, [0, 0.6, 1], [0, 1.25, 1], clamp).toFixed(3)}) rotate(${((1 - star) * -90).toFixed(1)})`}>
          <circle r={70 * starPulse} fill={`url(#glow-${id})`} opacity={star} />
          <path d={starPath(0, 0, 40)} fill={FESTIVE.gold} stroke={mix(FESTIVE.gold, "#7a5a10", 0.4)} strokeWidth={3} strokeLinejoin="round" />
          <path d={starPath(-4, -4, 16)} fill={FESTIVE.goldLight} opacity={0.8} />
        </g>
      ) : null}
      {children}
    </svg>
  );
};
