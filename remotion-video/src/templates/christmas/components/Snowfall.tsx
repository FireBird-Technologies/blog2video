/**
 * Falling snow — one frame-sized SVG, deterministic and cheap per frame.
 *
 * Same structure as Sakura's PetalRain: every flake's parameters are computed once
 * (useMemo), each frame only does a little trig; flakes are recycled with a modulo
 * and faded at the frame edges, and near-invisible ones are culled.
 *
 * Visibility on a BRIGHT sky: every flake carries a thin blue-grey stroke instead of
 * a per-flake blur filter (much cheaper to render), and the near layer shares one
 * soft drop-shadow on its group.
 *
 * Modes
 *  - drift   gentle snowfall (default)
 *  - flurry  heavier, faster, more sideways
 *  - settle  flakes ease down and rest in a band near the ground
 *
 * `gust` (0→1) thickens, speeds up and blows the snow sideways — SnowGustExit
 * drives it and adds the white veil.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { christmasRand, clamp, FESTIVE } from "../christmasStyle";
import { useSceneLook } from "./SceneLook";

export type SnowMode = "drift" | "flurry" | "settle";

type Flake = {
  x0: number;
  y0: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  r: number;
  rot0: number;
  rotSpeed: number;
  crystal: boolean;
  opacity: number;
  restY: number;
};

const TAU = Math.PI * 2;

/** A six-armed crystal of radius r centred on 0,0. */
const crystalPath = (r: number): string => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    d += `M0 0L${(cx * r).toFixed(2)} ${(cy * r).toFixed(2)}`;
    // two little barbs per arm
    const bx = cx * r * 0.55;
    const by = cy * r * 0.55;
    const b = r * 0.28;
    const a1 = a + 0.75;
    const a2 = a - 0.75;
    d += `M${bx.toFixed(2)} ${by.toFixed(2)}L${(bx + Math.cos(a1) * b).toFixed(2)} ${(by + Math.sin(a1) * b).toFixed(2)}`;
    d += `M${bx.toFixed(2)} ${by.toFixed(2)}L${(bx + Math.cos(a2) * b).toFixed(2)} ${(by + Math.sin(a2) * b).toFixed(2)}`;
  }
  return d;
};

export const Snowfall: React.FC<{
  /** Flakes in this layer (portrait should pass fewer). */
  count: number;
  seed?: number;
  mode?: SnowMode;
  /** Size multiplier — use > 1 for a near/foreground layer. */
  scale?: number;
  /** 0 → 1 exit whiteout (thicker, faster, sideways snow + white veil). */
  gust?: number;
  /** Flake shading — defaults to the festive snow shade. */
  shade?: string;
  /** Overall layer opacity. */
  opacity?: number;
  /** Draw a few flakes as six-armed crystals (near layers). */
  crystals?: boolean;
  style?: React.CSSProperties;
}> = ({ count, seed = 7, mode = "drift", scale = 1, gust = 0, shade = FESTIVE.snowShade, opacity = 1, crystals = false, style }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const span = height + 120;
  // This scene's snow: speed, flake size and a constant sideways drift.
  const look = useSceneLook();
  const lookSpeed = look.snow.speed;
  const lookFlake = look.snow.flake;

  const flakes = React.useMemo<Flake[]>(() => {
    const out: Flake[] = [];
    const speed = mode === "flurry" ? 1.8 : 1;
    for (let i = 0; i < count; i++) {
      const s = seed + i * 31.7;
      const far = i % 3 === 0; // a third of the layer sits further back
      const r = (far ? 3 + christmasRand(s, 2) * 3 : 5 + christmasRand(s, 2) * 6) * scale * lookFlake;
      out.push({
        x0: christmasRand(s, 1) * width,
        y0: christmasRand(s, 8) * span,
        vy: ((far ? 1.0 : 1.6) + christmasRand(s, 3) * (far ? 0.8 : 1.4)) * speed * lookSpeed * unit * Math.sqrt(scale),
        swayAmp: (12 + christmasRand(s, 4) * 28) * unit * (mode === "flurry" ? 1.6 : 1),
        swayFreq: 0.006 + christmasRand(s, 5) * 0.012,
        phase: christmasRand(s, 6) * TAU,
        r: r * unit,
        rot0: christmasRand(s, 9) * 60,
        rotSpeed: (christmasRand(s, 10) - 0.5) * 1.6,
        crystal: crystals && !far && christmasRand(s, 11) > 0.45,
        opacity: far ? 0.6 + christmasRand(s, 7) * 0.2 : 0.85 + christmasRand(s, 7) * 0.15,
        restY: height * (0.8 + christmasRand(s, 12) * 0.14),
      });
    }
    return out;
  }, [count, seed, mode, scale, width, height, span, unit, crystals, lookSpeed, lookFlake]);

  const g = Math.max(0, Math.min(1, gust));
  // During a gust the visible share grows (extra flakes come in), speed + wind pick up.
  const visibleShare = interpolate(g, [0, 1], [mode === "flurry" ? 1 : 0.8, 1], clamp);
  const windX = g * g * width * 0.45;
  const drift = frame * look.snow.wind * unit;
  const strokeW = Math.max(0.8, 1.2 * unit);

  const crystalCache = React.useMemo(() => new Map<number, string>(), []);
  const crystalFor = (r: number) => {
    const key = Math.round(r * 2) / 2;
    let d = crystalCache.get(key);
    if (!d) {
      d = crystalPath(key);
      crystalCache.set(key, d);
    }
    return d;
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity, overflow: "visible", ...style }}
    >
      <g style={{ filter: scale > 1 ? `drop-shadow(0 ${2 * unit}px ${3 * unit}px rgba(60,90,120,0.28))` : undefined }}>
        {flakes.map((f, i) => {
          if (i / count > visibleShare) return null;
          const t = frame * (1 + g * 2.2);
          let y = ((f.y0 + t * f.vy) % span) - 60;
          if (mode === "settle" && f.y0 + t * f.vy > f.restY + 60) y = f.restY; // rests once it reaches the ground
          const x =
            ((f.x0 + Math.sin(frame * f.swayFreq * TAU + f.phase) * f.swayAmp + windX * (0.6 + (i % 5) * 0.1) + drift * (i % 3 === 0 ? 0.6 : 1)) %
              (width + 40) +
              (width + 40)) %
              (width + 40) -
            20;
          const edge = interpolate(y, [-40, 20, height - 10, height + 40], [0, 1, 1, 0], clamp);
          const o = f.opacity * edge;
          if (o < 0.03) return null;
          if (f.crystal) {
            return (
              <path
                key={i}
                d={crystalFor(f.r * 1.6)}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(f.rot0 + frame * f.rotSpeed).toFixed(1)})`}
                stroke={FESTIVE.snow}
                strokeWidth={Math.max(1.4, f.r * 0.32)}
                strokeLinecap="round"
                fill="none"
                opacity={o}
              />
            );
          }
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={f.r}
              fill={FESTIVE.snow}
              stroke={shade}
              strokeWidth={strokeW}
              strokeOpacity={0.55}
              opacity={o}
            />
          );
        })}
      </g>
    </svg>
  );
};

/**
 * The standard two-layer snowfall: a far layer of small dots (behind content) and a
 * near layer of bigger flakes + crystals (in front of content), sized for the
 * orientation. `density` scales the count (text-heavy layouts pass < 1).
 */
export const LayeredSnow: React.FC<{
  portrait: boolean;
  seed: number;
  density?: number;
  mode?: SnowMode;
  /** "back" = far layer only, "front" = near layer only. */
  layer?: "back" | "front" | "both";
}> = ({ portrait, seed, density = 1, mode = "drift", layer = "both" }) => {
  // Scene look scales the intensity on top of the layout's own density.
  const look = useSceneLook();
  const far = Math.round((portrait ? 26 : 38) * density * look.snow.density);
  const near = Math.round((portrait ? 12 : 18) * density * look.snow.density);
  return (
    <>
      {layer !== "front" ? <Snowfall count={far} seed={seed + 11} mode={mode} scale={0.8} opacity={0.9} /> : null}
      {layer !== "back" ? <Snowfall count={near} seed={seed + 97} mode={mode} scale={1.45} crystals /> : null}
    </>
  );
};
