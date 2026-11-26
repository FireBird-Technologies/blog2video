/**
 * Readable text on snow: the snow-foam cushion that sits behind a point, the lumpy
 * snow underline, and the white snowflake bullet. Shared by snow_compare and
 * snowball_steps.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { christmasRand, FESTIVE, mix, withOpacity, type WinterPalette } from "../christmasStyle";

/**
 * A small six-armed WHITE snowflake used as a bullet, drawn twice: a blue-grey
 * outline underneath keeps it crisp on the white snow foam.
 */
export const SnowflakeBullet: React.FC<{ size: number; outline: string }> = ({ size, outline }) => {
  const arms = (stroke: string, main: number, barb: number) =>
    [0, 60, 120].map((a) => (
      <g key={`${stroke}-${a}`} transform={`rotate(${a})`}>
        <line x1={-10} y1={0} x2={10} y2={0} stroke={stroke} strokeWidth={main} strokeLinecap="round" />
        <path d="M6 0 l3 -3 M6 0 l3 3 M-6 0 l-3 -3 M-6 0 l-3 3" stroke={stroke} strokeWidth={barb} strokeLinecap="round" />
      </g>
    ));
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ flex: "0 0 auto", overflow: "visible" }}>
      {arms(outline, 4.6, 3.8)}
      {arms(FESTIVE.snow, 2.6, 2)}
    </svg>
  );
};

/**
 * A lumpy strip of snow under a point: it "draws" left → right with `progress`,
 * shaded blue-grey underneath so it reads on the bright snow, with a few sparkles.
 */
export const SnowUnderline: React.FC<{ width: number; progress: number; pal: WinterPalette; seed: number; frame: number }> = ({
  width,
  progress,
  pal,
  seed,
  frame,
}) => {
  const h = 22;
  const bumps = Math.max(5, Math.round(width / 70));
  const seg = width / bumps;
  let top = `M0 ${h * 0.7}`;
  for (let b = 0; b < bumps; b++) {
    const peak = h * (0.15 + christmasRand(seed, b) * 0.3);
    top += ` Q${seg * b + seg / 2} ${peak} ${seg * (b + 1)} ${h * (0.55 + christmasRand(seed + 1, b) * 0.2)}`;
  }
  const d = `${top} Q${width + 4} ${h * 0.85} ${width} ${h} L0 ${h} Q-4 ${h * 0.85} 0 ${h * 0.7} Z`;
  const shown = Math.max(0, Math.min(1, progress));
  // Unique clip id per instance (never shared across scenes / previews on one page).
  const clipId = `uline-${React.useId().replace(/:/g, "")}`;
  return (
    <svg width={width} height={h + 6} viewBox={`0 0 ${width} ${h + 6}`} style={{ marginTop: 8, overflow: "visible" }}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={-10} width={width * shown} height={h + 20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={d} transform="translate(0 4)" fill={withOpacity(pal.snowShade, 0.9)} />
        <path d={d} fill={FESTIVE.snow} stroke={withOpacity(mix(pal.snowShade, "#5d7891", 0.2), 0.8)} strokeWidth={1.5} />
        {[0.18, 0.5, 0.82].map((x, k) => {
          const tw = Math.max(0, Math.sin(frame / 7 + k * 2 + seed));
          return tw > 0.2 ? <circle key={k} cx={width * x} cy={h * 0.45} r={1.6 + tw * 1.6} fill="#ffffff" opacity={tw} /> : null;
        })}
      </g>
    </svg>
  );
};

/**
 * A fluffy cushion of snow foam behind a point: a soft white cloud with bubbly top
 * and bottom edges, a blue-grey shade underneath and a couple of twinkles. `puff`
 * 0→1 swells it in.
 */
export const SnowFoam: React.FC<{
  width: number;
  height: number;
  top?: number;
  left?: number;
  seed: number;
  pal: WinterPalette;
  frame: number;
  puff: number;
}> = ({
  width,
  height,
  top: offsetTop = 0,
  left: offsetLeft = 0,
  seed,
  pal,
  frame,
  puff,
}) => {
  const bump = Math.max(16, height * 0.2);
  const inset = bump * 0.9;
  const n = Math.max(4, Math.round((width - inset * 2) / (bump * 1.7)));
  const seg = (width - inset * 2) / n;
  const top = inset * 0.8;
  const bottom = height - inset * 0.8;
  let d = `M${inset} ${top}`;
  for (let b = 0; b < n; b++) {
    const lift = bump * (0.55 + christmasRand(seed, b) * 0.6);
    d += ` Q${inset + seg * (b + 0.5)} ${top - lift} ${inset + seg * (b + 1)} ${top}`;
  }
  d += ` Q${width + inset * 0.2} ${height / 2} ${width - inset} ${bottom}`;
  for (let b = n - 1; b >= 0; b--) {
    const drop = bump * (0.4 + christmasRand(seed + 3, b) * 0.5);
    d += ` Q${inset + seg * (b + 0.5)} ${bottom + drop} ${inset + seg * b} ${bottom}`;
  }
  d += ` Q${-inset * 0.2} ${height / 2} ${inset} ${top} Z`;
  const s = 0.85 + 0.15 * Math.max(0, Math.min(1, puff));
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", left: offsetLeft, top: offsetTop, overflow: "visible", transform: `scale(${s})`, opacity: Math.min(1, puff * 1.5) }}
    >
      <path d={d} transform="translate(0 7)" fill={withOpacity(pal.snowShade, 0.55)} />
      <path d={d} fill={withOpacity(FESTIVE.snow, 0.9)} stroke={withOpacity(mix(pal.snowShade, "#5d7891", 0.2), 0.45)} strokeWidth={1.5} />
      {[0.12, 0.88].map((x, k) => {
        const tw = Math.max(0, Math.sin(frame / 9 + k * 2.4 + seed));
        return tw > 0.25 ? (
          <path
            key={k}
            d={`M${width * x} ${top - 4 - 7 * tw} L${width * x + 2.4} ${top - 4} L${width * x} ${top - 4 + 7 * tw} L${width * x - 2.4} ${top - 4} Z`}
            fill="#ffffff"
            opacity={tw}
          />
        ) : null;
      })}
    </svg>
  );
};
