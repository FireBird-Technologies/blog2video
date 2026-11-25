/**
 * The bright winter-day world behind every scene: sky gradient with a soft sun
 * haze, distant snowy hills, two depths of pine silhouettes and snowy ground with
 * blue-shaded drifts. Pure SVG in a frame-sized viewBox; filter / gradient ids come
 * from useId() so several backdrops can coexist.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { christmasRand, FESTIVE, TREE_SLOTS, withOpacity, type WinterPalette } from "../christmasStyle";
import { useSceneLook } from "./SceneLook";

/** A simple three-tier pine silhouette, trunk base at (x, y), height h. */
export const pinePath = (x: number, y: number, h: number): string => {
  const w = h * 0.42;
  const t = (k: number) => y - h * k;
  return [
    `M${x} ${t(1)}`,
    `L${x + w * 0.42} ${t(0.62)} L${x + w * 0.24} ${t(0.64)}`,
    `L${x + w * 0.72} ${t(0.3)} L${x + w * 0.36} ${t(0.32)}`,
    `L${x + w} ${t(0.06)} L${x - w} ${t(0.06)}`,
    `L${x - w * 0.36} ${t(0.32)} L${x - w * 0.72} ${t(0.3)}`,
    `L${x - w * 0.24} ${t(0.64)} L${x - w * 0.42} ${t(0.62)} Z`,
  ].join(" ");
};

/** Snow caps sitting on a pine's tiers. */
const pineSnowPath = (x: number, y: number, h: number): string => {
  const w = h * 0.42;
  const t = (k: number) => y - h * k;
  const cap = (k: number, half: number) =>
    `M${x - half} ${t(k) + h * 0.02} Q${x} ${t(k) - h * 0.05} ${x + half} ${t(k) + h * 0.02} Q${x} ${t(k) + h * 0.035} ${x - half} ${t(k) + h * 0.02} Z`;
  return [cap(0.92, w * 0.14), cap(0.6, w * 0.3), cap(0.28, w * 0.55)].join(" ");
};

const ridge = (width: number, baseY: number, amp: number, seed: number, steps = 7): string => {
  let d = `M0 ${baseY}`;
  const seg = width / steps;
  for (let i = 0; i <= steps; i++) {
    const x = i * seg;
    const y = baseY - amp * (0.4 + christmasRand(seed, i) * 0.6);
    d += ` Q${x - seg / 2} ${y - amp * 0.25} ${x} ${y}`;
  }
  return d;
};

export const WinterBackdrop: React.FC<{
  pal: WinterPalette;
  seed?: number;
  /** Where the snowy ground starts, as a share of the height (0.7 = lower 30%). */
  horizon?: number;
  /** Draw the near pine treeline. */
  trees?: boolean;
  /** Draw the distant hills. */
  hills?: boolean;
  /** Slow parallax drift of the far layers (px per frame at 1080p). */
  drift?: number;
}> = ({ pal, seed = 3, horizon = 0.74, trees = true, hills = true, drift = 0.15 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const id = React.useId().replace(/:/g, "");
  const unit = Math.min(width, height) / 1080;
  const groundY = height * horizon;
  const shift = frame * drift * unit;
  // This scene's look: pine arrangement / heights, far-pine density, hill height.
  const look = useSceneLook();
  const portrait = height > width;

  const farPines = React.useMemo(() => {
    const n = Math.max(4, Math.round((width / (70 * unit)) * look.trees.farDensity));
    return Array.from({ length: n }, (_, i) => ({
      x: (i + christmasRand(seed, i) * 0.8) * (width / n),
      h: (70 + christmasRand(seed + 5, i) * 70) * unit,
    }));
  }, [seed, width, unit, look]);

  const nearPines = React.useMemo(() => {
    // Slots from the scene's arrangement (all within the outer ~22% so the middle
    // stays clear); portrait keeps at most 2 per side.
    let slots = TREE_SLOTS[look.trees.arrangement];
    if (portrait) {
      const left = slots.filter(([x]) => x < 0.5).slice(0, 2);
      const right = slots.filter(([x]) => x >= 0.5).slice(-2);
      slots = [...left, ...right];
    }
    return slots.map(([fx, rel], i) => ({
      x: fx * width + (christmasRand(seed + 9, i) - 0.5) * 30 * unit,
      h: 230 * unit * look.trees.scale * rel * (0.92 + christmasRand(seed + 13, i) * 0.16),
    }));
  }, [seed, width, unit, look, portrait]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.skyTop} />
          <stop offset={String(horizon * 0.85)} stopColor={pal.sky} />
          <stop offset="1" stopColor={pal.skyLow} />
        </linearGradient>
        <radialGradient id={`sun-${id}`} cx="0.78" cy="0.16" r="0.42">
          <stop offset="0" stopColor={withOpacity(FESTIVE.goldLight, 0.55)} />
          <stop offset="0.35" stopColor={withOpacity(FESTIVE.goldLight, 0.18)} />
          <stop offset="1" stopColor={withOpacity(FESTIVE.goldLight, 0)} />
        </radialGradient>
        <linearGradient id={`ground-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FESTIVE.snow} />
          <stop offset="1" stopColor={pal.snowShade} />
        </linearGradient>
      </defs>

      <rect width={width} height={height} fill={`url(#sky-${id})`} />
      <rect width={width} height={height} fill={`url(#sun-${id})`} />

      {hills ? (
        <g transform={`translate(${-(shift * 0.4) % (width / 7)} 0)`}>
          <path
            d={`${ridge(width + width / 7, groundY - 40 * unit, 150 * unit * look.hillHeight, seed)} L${width + width / 7} ${height} L0 ${height} Z`}
            fill={pal.farHill}
            opacity={0.7}
          />
          {farPines.map((p, i) => (
            <path key={i} d={pinePath(p.x, groundY - 10 * unit, p.h)} fill={pal.farPine} opacity={0.55} />
          ))}
        </g>
      ) : null}

      {/* Snowy ground with soft drifts. */}
      <path
        d={`${ridge(width, groundY + 20 * unit, 40 * unit, seed + 3, 5)} L${width} ${height} L0 ${height} Z`}
        fill={`url(#ground-${id})`}
      />
      <path
        d={`${ridge(width, groundY + 90 * unit, 30 * unit, seed + 4, 4)} L${width} ${height} L0 ${height} Z`}
        fill={FESTIVE.snow}
        opacity={0.85}
      />

      {trees
        ? nearPines.map((p, i) => (
            <g key={i}>
              <path d={pinePath(p.x, groundY + 40 * unit, p.h)} fill={pal.nearPine} />
              <path d={pineSnowPath(p.x, groundY + 40 * unit, p.h)} fill={FESTIVE.snow} />
              <ellipse cx={p.x} cy={groundY + 42 * unit} rx={p.h * 0.36} ry={p.h * 0.05} fill={withOpacity(pal.snowShade, 0.6)} />
            </g>
          ))
        : null}
    </svg>
  );
};
