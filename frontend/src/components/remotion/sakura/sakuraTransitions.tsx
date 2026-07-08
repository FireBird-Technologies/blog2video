/**
 * Sakura scene-boundary transitions — Chronicle-style.
 *
 * Each boundary is a REAL two-scene @remotion/transitions `TransitionPresentation`
 * (the outgoing scene fades out; the incoming scene reveals underneath a petal /
 * Japanese-craft / geometric flower overlay). Selection is DETERMINISTIC: the hero
 * handoff (leaving `sakura_intro`, or entering `sakura_ending_socials`) is a plain
 * petal-FREE fade; every other boundary cycles POOL[boundaryIndex % POOL.length]
 * so adjacent boundaries always differ and the same input renders identically.
 *
 * The petal/veil DRAWING (petals grids, SoftPetal, gradients, static-turbulence ink)
 * is reused from the previous overlay implementation — only the clock changed: each
 * effect now reads the transition's `presentationProgress` (0→1) via a `t` prop
 * instead of `useCurrentFrame()`. Transform / opacity / clip-path only (GPU-friendly);
 * ink edges use a STATIC turbulence mask animated via scale — never animated
 * baseFrequency.
 *
 * Mirror byte-identical in both trees:
 *   remotion-video/src/templates/sakura/sakuraTransitions.tsx
 *   frontend/src/components/remotion/sakura/sakuraTransitions.tsx
 */
import React, { useId, useMemo } from "react";
import { AbsoluteFill, useVideoConfig, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { SAKURA, SoftPetal, hexToRgba, sakuraRand, deriveDarkWash } from "./sakuraStyle";

// Overlap length (frames) of every Sakura boundary. The two composition wrappers
// reuse this to size the TransitionSeries overlap and subtract it from the total
// duration, so Player and render agree. Lengthened ~25% (55→69) in step with the
// SAKURA_TEMPO slow-mo so the between-scene transitions read as unhurried too.
export const SAKURA_TRANSITION_FRAMES = 69;

// The signature petal-curtain (the "flower wall" that builds, holds, then glides
// DOWN off-screen) gets a longer budget so its descent reads as slow and
// luxurious rather than a quick swipe. Capped at 75 — the practical ceiling that
// still fits under boundaryFrames' 25%-of-neighbour clamp for ~10s scenes.
export const PETAL_CURTAIN_FRAMES = 75;

/** Frame budget for a given effect — the petal-curtain runs longer than the rest. */
const framesForEffect = (effect: SakuraTransition): number =>
  effect === "petal_curtain" ? PETAL_CURTAIN_FRAMES : SAKURA_TRANSITION_FRAMES;

export type SakuraTransition =
  | "fade"
  | "petal_vortex"
  | "petal_swarm"
  | "petal_curtain"
  | "bloom_unfurl"
  | "petal_scatter"
  | "petal_drift"
  | "petal_gust"
  | "shoji_slide"
  | "iris_wipe"
  | "ink_bleed"
  | "brush_swipe"
  | "diagonal_panel"
  | "vertical_shutter"
  | "rack_bloom"
  | "soft_blur";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Deterministic seed per boundary so the same input renders identically (no random).
const seedFor = (index: number) => (index % 7) + 3;

// ─── Petal-based overlays (t: 0→1 transition progress) ───────────────────────

/** Petals spiral inward toward center, then burst outward as the veil peaks. */
const PetalVortex: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const veil = interpolate(t, [0, 0.55, 1], [0, 0.2, 0.34], clamp);
  const petals = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const s = seed + i * 13.1;
        return {
          a0: sakuraRand(s, 1) * Math.PI * 2,
          rStart: (0.5 + sakuraRand(s, 2) * 0.55) * Math.min(width, height),
          r: 14 + sakuraRand(s, 3) * 22,
          spin: (sakuraRand(s, 4) - 0.5) * 40,
          color: i % 3 === 0 ? SAKURA.deepBlush : i % 3 === 1 ? SAKURA.blush : SAKURA.mist,
        };
      }),
    [seed, width, height],
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${hexToRgba(SAKURA.blush, 0.5)}, ${hexToRgba(SAKURA.plum, 0.35)})`, opacity: veil }} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {petals.map((p, i) => {
          // spiral in for first 60%, fling out after
          const inward = interpolate(t, [0, 0.6], [1, 0], clamp);
          const outward = interpolate(t, [0.6, 1], [0, 1.4], clamp);
          const radius = p.rStart * inward + p.rStart * outward;
          const angle = p.a0 + t * Math.PI * 2.2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const op = interpolate(t, [0, 0.15, 0.85, 1], [0, 0.9, 0.9, 0], clamp);
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${p.spin * t * 10})`} opacity={op}>
              <SoftPetal cx={0} cy={0} r={p.r} color={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Dense diagonal sweep of petals across a soft blush veil. */
const PetalSwarm: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  const veil = interpolate(t, [0, 0.6, 1], [0, 0.16, 0.3], clamp);
  const petals = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => {
        const s = seed + i * 17.3;
        return {
          y0: sakuraRand(s, 1) * height,
          drift: (sakuraRand(s, 2) - 0.3) * height * 0.35,
          r: 18 + sakuraRand(s, 3) * 26,
          rot0: sakuraRand(s, 4) * 360,
          rotSpeed: (sakuraRand(s, 5) - 0.5) * 24,
          delay: sakuraRand(s, 6) * 0.25,
          color: i % 3 === 0 ? SAKURA.deepBlush : i % 3 === 1 ? SAKURA.blush : SAKURA.mist,
          wobble: sakuraRand(s, 7) * Math.PI * 2,
        };
      }),
    [seed, height],
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, ${hexToRgba(SAKURA.blush, 0.55)} 0%, ${hexToRgba(SAKURA.mist, 0.35)} 55%, ${hexToRgba(SAKURA.blush, 0.5)} 100%)`, opacity: veil }} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {petals.map((p, i) => {
          const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
          const eased = easeInOut(local);
          const x = width * 1.15 - eased * width * 1.35;
          const y = p.y0 + eased * p.drift + Math.sin(local * Math.PI * 2 + p.wobble) * 24;
          const op = interpolate(local, [0, 0.12, 1], [0, 0.9, 0.7], clamp);
          if (local <= 0) return null;
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${p.rot0 + local * p.rotSpeed * 10})`} opacity={op}>
              <SoftPetal cx={0} cy={0} r={p.r} color={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * A dense SPRINKLE of many small cherry petals drifts slowly DOWN across the
 * whole frame — like a soft petal-fall (hanafubuki) rather than a solid wall.
 * Each petal falls on its own slow path with a gentle horizontal sway and tumble,
 * so together they read as a light, continuous flurry passing over the crossfade,
 * then thin out at the end to reveal the new scene beneath.
 *
 * NOTE: the outgoing scene already fades out via the TransitionSeries crossfade,
 * so this needs no opaque panel — only a very faint blush dusting sits behind the
 * petals so the flurry reads warm, never a flat color field.
 */
const PetalCurtain: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  // Group envelope: petals rush in over the first third, PEAK into a thick blanket
  // through the middle, then thin out so the new scene shows through.
  const groupOp = interpolate(t, [0, 0.18, 0.72, 1], [0, 1, 1, 0], clamp);
  // Warm dusting behind the flurry — swells at the peak so the blanket reads thick
  // and cohesive, then drops away.
  const veil = interpolate(t, [0.08, 0.42, 0.5, 0.72, 1], [0, 0.42, 0.42, 0.34, 0], clamp);
  // Density/coverage envelope: 0 → 1 as the blanket gathers to its thickest around
  // t≈0.45, then eases back as petals fall away. Drives fill + a slight swell.
  const blanket = interpolate(t, [0.1, 0.45, 0.6, 1], [0, 1, 1, 0.15], clamp);

  // A THICK blanket of small petals: very many, packed close, converging to near
  // full-frame coverage at the peak, then falling away.
  const COUNT = 620;
  const petals = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const s = seed + i * 12.3;
        const far = i % 5 < 2; // ~40% far layer: smaller, slower, paler
        return {
          x: sakuraRand(s, 1) * width,
          // Target Y where the petal sits when the blanket is at full thickness —
          // scattered across the WHOLE frame so at peak the coverage is even+dense.
          ry: sakuraRand(s, 2) * height,
          // Small petals: far layer tiny, near layer still modest.
          r: far ? 8 + sakuraRand(s, 3) * 6 : 12 + sakuraRand(s, 4) * 10,
          // Extra vertical travel it continues to fall past its target as it thins.
          fall: (far ? 0.6 : 0.9) * height * (0.85 + sakuraRand(s, 5) * 0.5),
          swayAmp: (12 + sakuraRand(s, 6) * 30) * (far ? 0.6 : 1),
          swayFreq: 1.4 + sakuraRand(s, 7) * 2.2,
          phase: sakuraRand(s, 8) * Math.PI * 2,
          rot0: sakuraRand(s, 9) * 360,
          rotSpeed: (sakuraRand(s, 10) - 0.5) * 200,
          delay: sakuraRand(s, 11) * 0.12, // slight stagger into the fall
          baseOp: far ? 0.5 + sakuraRand(s, 12) * 0.2 : 0.7 + sakuraRand(s, 13) * 0.3,
          color: far ? SAKURA.mist : sakuraRand(s, 14) > 0.5 ? SAKURA.blush : SAKURA.deepBlush,
        };
      }),
    [seed, width, height],
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 40%, ${hexToRgba(SAKURA.blush, 0.85)}, ${hexToRgba(SAKURA.deepBlush, 0.65)} 60%, ${hexToRgba(SAKURA.crimson, 0.4)} 100%)`,
          opacity: veil,
        }}
      />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: groupOp }}>
        {petals.map((p, i) => {
          // Per-petal progress over the transition (for sway/rotation/fade).
          const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
          // Gathers from above its target into place as the blanket thickens, then
          // continues falling down and away as `blanket` recedes past its peak.
          const gatherY = p.ry - (1 - blanket) * height * 1.15;
          const fallAway = local > 0.6 ? (local - 0.6) / 0.4 * p.fall : 0;
          const y = gatherY + fallAway;
          const x = p.x + Math.sin(local * Math.PI * 2 * p.swayFreq + p.phase) * p.swayAmp;
          const rot = p.rot0 + local * p.rotSpeed;
          // Slight swell at peak thickness so overlapping petals knit into a blanket.
          const scale = 0.85 + 0.25 * blanket;
          // Petals fade in fast, then out over the last stretch as the blanket thins.
          const op = p.baseOp * interpolate(local, [0, 0.08, 0.82, 1], [0, 1, 1, 0.25], clamp);
          if (op < 0.02) return null;
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={op}>
              <SoftPetal cx={0} cy={0} r={p.r} color={p.color} centerColor={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** A single giant blossom opens from center, its petals expanding to wipe the frame. */
const BloomUnfurl: React.FC<{ t: number }> = ({ t }) => {
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(width, height) * 0.62;
  // Slower + gentler: opens over most of the transition with an ease that softens
  // both the start and the finish, then a long eased fade-out.
  const grow = easeInOut(interpolate(t, [0, 0.85], [0, 1], clamp));
  const fade = easeInOut(interpolate(t, [0.72, 1], [1, 0], clamp));
  // Soft, diffuse petal edges so the bloom reads as mist rather than hard ellipses.
  const blur = Math.min(width, height) * 0.02;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: fade }}>
        <defs>
          <filter id={`bloom-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        <g transform={`translate(${cx},${cy}) rotate(${grow * 24})`} filter={`url(#bloom-${uid})`}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i * 72 - 90) * (Math.PI / 180);
            const px = Math.cos(a) * maxR * grow * 0.5;
            const py = Math.sin(a) * maxR * grow * 0.5;
            return (
              <ellipse
                key={i}
                cx={px}
                cy={py}
                rx={maxR * 0.55 * grow}
                ry={maxR * 0.35 * grow}
                transform={`rotate(${i * 72 - 90}, ${px}, ${py})`}
                fill={i % 2 === 0 ? SAKURA.blush : SAKURA.deepBlush}
                opacity={0.7}
              />
            );
          })}
          <circle r={maxR * 0.22 * grow} fill={SAKURA.crimson} opacity={0.6} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Petals accumulate at the bottom, then a gust blows them up and away. */
const PetalScatter: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  const veil = interpolate(t, [0, 0.5, 1], [0, 0.22, 0.32], clamp);
  const petals = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const s = seed + i * 11.7;
        return {
          x: sakuraRand(s, 1) * width,
          rest: height - sakuraRand(s, 2) * height * 0.28,
          r: 12 + sakuraRand(s, 3) * 20,
          blow: (sakuraRand(s, 4) - 0.5) * width * 0.7,
          rot: sakuraRand(s, 5) * 360,
          color: i % 3 === 0 ? SAKURA.deepBlush : i % 3 === 1 ? SAKURA.blush : SAKURA.mist,
        };
      }),
    [seed, width, height],
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `linear-gradient(0deg, ${hexToRgba(SAKURA.blush, 0.45)}, transparent 60%)`, opacity: veil }} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {petals.map((p, i) => {
          const fall = interpolate(t, [0, 0.5], [-60, p.rest], { ...clamp, easing: easeOut });
          const lift = interpolate(t, [0.5, 1], [0, -height * 1.2], { ...clamp, easing: easeInOut });
          const y = fall + lift;
          const x = p.x + interpolate(t, [0.5, 1], [0, p.blow], clamp);
          const op = interpolate(t, [0, 0.12, 0.9, 1], [0, 0.9, 0.85, 0], clamp);
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${p.rot + t * 200})`} opacity={op}>
              <SoftPetal cx={0} cy={0} r={p.r} color={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Hanafubuki — a calm cherry-blossom SNOWFALL with bokeh depth. Petals fall and
 * drift diagonally across the whole frame in THREE depth layers: far petals are
 * small, slow and softly blurred (a dreamy out-of-focus haze); near petals are
 * large, fast and sharp. Each petal sways as it falls (sine wobble) for an organic,
 * wind-borne feel. A soft blush depth-haze swells to mid then clears. This is the
 * gentlest, most "sakura" transition — a serene drift rather than a burst or wipe.
 *
 * Blur is applied ONCE per layer via a STATIC SVG blur filter on the group (never
 * animated), so it stays cheap to paint.
 */
const PetalDrift: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const haze = interpolate(t, [0, 0.5, 1], [0, 0.28, 0], clamp);

  // Three depth layers: [countPerLayer, sizeScale, fallScale, blurPx, opacity]
  const LAYERS = useMemo(
    () => [
      { key: "far", count: 12, size: 0.5, fall: 0.75, blur: 5, op: 0.55 },
      { key: "mid", count: 9, size: 0.85, fall: 1.0, blur: 2, op: 0.8 },
      { key: "near", count: 6, size: 1.35, fall: 1.35, blur: 0, op: 1 },
    ],
    [],
  );

  const layerPetals = useMemo(
    () =>
      LAYERS.map((layer, li) =>
        Array.from({ length: layer.count }, (_, i) => {
          const s = seed + li * 53.7 + i * 7.9;
          return {
            x0: sakuraRand(s, 1) * width * 1.1 - width * 0.05,
            drift: (0.12 + sakuraRand(s, 2) * 0.18) * width, // diagonal wind drift
            r: (14 + sakuraRand(s, 3) * 20) * layer.size,
            rot0: sakuraRand(s, 4) * 360,
            rotSpeed: (sakuraRand(s, 5) - 0.5) * 220,
            delay: sakuraRand(s, 6) * 0.3,
            swayAmp: (24 + sakuraRand(s, 7) * 34) * layer.size,
            swayPhase: sakuraRand(s, 1) * Math.PI * 2,
            color: i % 3 === 0 ? SAKURA.deepBlush : i % 3 === 1 ? SAKURA.blush : SAKURA.mist,
          };
        }),
      ),
    [LAYERS, seed, width, height],
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Soft blush depth-haze — swells at mid, clears by the end. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 90% at 50% 35%, ${hexToRgba(SAKURA.blush, 0.6)}, ${hexToRgba(SAKURA.mist, 0.3)} 55%, transparent)`,
          opacity: haze,
        }}
      />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {LAYERS.map((layer) =>
            layer.blur > 0 ? (
              <filter key={layer.key} id={`drift-${uid}-${layer.key}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={layer.blur} />
              </filter>
            ) : null,
          )}
        </defs>
        {LAYERS.map((layer, li) => (
          <g
            key={layer.key}
            filter={layer.blur > 0 ? `url(#drift-${uid}-${layer.key})` : undefined}
            opacity={layer.op}
          >
            {layerPetals[li].map((p, i) => {
              const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
              // fall from above the frame to below it, scaled by depth
              const y = interpolate(local, [0, 1], [-height * 0.15, height * (1.15 * layer.fall)], clamp);
              const sway = Math.sin(local * Math.PI * 3 + p.swayPhase) * p.swayAmp;
              const x = p.x0 + local * p.drift + sway;
              // fade in quickly, gently out at the tail so the layer never pops
              const op = interpolate(local, [0, 0.15, 0.85, 1], [0, 1, 1, 0], clamp);
              if (local <= 0) return null;
              return (
                <g key={i} transform={`translate(${x},${y}) rotate(${p.rot0 + local * p.rotSpeed})`} opacity={op}>
                  <SoftPetal cx={0} cy={0} r={p.r} color={p.color} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * A warm wind-GUST sweeps a dense stream of blossoms across the frame, left→right,
 * in staggered trailing waves — the petals stretch slightly along their travel like
 * they're being carried fast on the wind. A soft blush wind-veil rides just behind
 * the leading edge and clears as the gust passes. This is the DIRECTIONAL petal
 * transition (a flurry blown across), distinct from the falling drift, the upward
 * scatter, and the spiralling vortex.
 */
const PetalGust: React.FC<{ seed: number; t: number }> = ({ seed, t }) => {
  const { width, height } = useVideoConfig();
  // A soft blush veil that sweeps across with the gust. It rides behind the leading
  // edge via a GPU-composited translateX — NOT an animated clip-path. (An animated
  // clip-path polygon over a full-frame gradient re-rasterises the whole layer every
  // frame, which made this transition hang/stutter in the Player.)
  const shift = interpolate(t, [0, 0.68], [-1.2, 1.1], { ...clamp, easing: easeInOut });
  const veilOp = interpolate(t, [0, 0.28, 0.7, 1], [0, 0.32, 0.32, 0], { ...clamp, easing: easeInOut });

  const petals = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const s = seed + i * 6.3;
        return {
          y0: sakuraRand(s, 1) * height,
          rise: (sakuraRand(s, 2) - 0.5) * height * 0.4, // slight vertical drift
          r: 12 + sakuraRand(s, 3) * 24,
          rot0: sakuraRand(s, 4) * 360,
          rotSpeed: (sakuraRand(s, 5) - 0.3) * 260, // gentler tumble so it reads soft, not frantic
          delay: sakuraRand(s, 6) * 0.28, // shorter stagger → trailing petals still have runway to glide
          wobble: sakuraRand(s, 7) * Math.PI * 2,
          stretch: 1.15 + sakuraRand(s, 1) * 0.5, // wind-stretched along travel
          color: i % 3 === 0 ? SAKURA.deepBlush : i % 3 === 1 ? SAKURA.blush : SAKURA.mist,
        };
      }),
    [seed, width, height],
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          // Wider-than-frame soft band; only its opacity + translateX change (both
          // GPU-composited), so the browser never re-rasterises the gradient.
          left: "-30%",
          width: "160%",
          background: `linear-gradient(100deg, transparent 0%, ${hexToRgba(SAKURA.blush, 0.6)} 35%, ${hexToRgba(SAKURA.mist, 0.35)} 60%, transparent 85%)`,
          opacity: veilOp,
          transform: `translateX(${shift * 100}%)`,
          willChange: "transform, opacity",
        }}
      />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {petals.map((p, i) => {
          const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
          if (local <= 0) return null;
          // easeOut: petals start drifting immediately and decelerate — no per-petal
          // "slow then snap across" that read as glitchy.
          const eased = easeOut(local);
          const x = -width * 0.15 + eased * width * 1.35; // stream across from left to right
          const y = p.y0 + eased * p.rise + Math.sin(local * Math.PI * 2 + p.wobble) * 30;
          const op = interpolate(local, [0, 0.18, 0.7, 1], [0, 0.95, 0.9, 0], clamp);
          return (
            <g
              key={i}
              transform={`translate(${x},${y}) rotate(${p.rot0 + local * p.rotSpeed}) scale(${p.stretch},1)`}
              opacity={op}
            >
              <SoftPetal cx={0} cy={0} r={p.r} color={p.color} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── Japanese-craft ──────────────────────────────────────────────────────────

/** Two washi panels slide in from left+right to meet at center, then part. */
const ShojiSlide: React.FC<{ t: number }> = ({ t }) => {
  const { width, height } = useVideoConfig();
  const close = interpolate(t, [0, 0.55], [0, 1], { ...clamp, easing: easeInOut });
  const part = interpolate(t, [0.6, 1], [0, 1], { ...clamp, easing: easeInOut });
  const panelW = width / 2;
  const leftX = -panelW + panelW * close - panelW * part;
  const rightX = width - panelW * close + panelW * part;
  const panelStyle = (x: number, borderSide: "right" | "left"): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    left: x,
    width: panelW,
    height,
    background: `linear-gradient(${borderSide === "right" ? "90deg" : "270deg"}, ${hexToRgba(SAKURA.washi, 0.97)}, ${hexToRgba(SAKURA.mist, 0.9)})`,
    [borderSide === "right" ? "borderRight" : "borderLeft"]: `3px solid ${hexToRgba(SAKURA.crimson, 0.6)}`,
    boxSizing: "border-box",
  });
  const lattice = (
    <svg width={panelW} height={height} viewBox={`0 0 ${panelW} ${height}`} style={{ position: "absolute", inset: 0, opacity: 0.12 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`v${i}`} x1={(panelW / 5) * (i + 1)} y1={0} x2={(panelW / 5) * (i + 1)} y2={height} stroke={SAKURA.ink} strokeWidth={2} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(height / 8) * (i + 1)} x2={panelW} y2={(height / 8) * (i + 1)} stroke={SAKURA.ink} strokeWidth={2} />
      ))}
    </svg>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={panelStyle(leftX, "right")}>{lattice}</div>
      <div style={panelStyle(rightX, "left")}>{lattice}</div>
    </AbsoluteFill>
  );
};

/** Circle iris closing to center then opening — via mask. */
const IrisWipe: React.FC<{ t: number }> = ({ t }) => {
  const { width, height } = useVideoConfig();
  const maxR = Math.hypot(width, height) * 0.55;
  const close = interpolate(t, [0, 0.55], [maxR, 0], { ...clamp, easing: easeInOut });
  const open = interpolate(t, [0.55, 1], [0, maxR], { ...clamp, easing: easeInOut });
  const r = t < 0.55 ? close : open;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <mask id="iris-mask">
            <rect width={width} height={height} fill="white" />
            <circle cx={width / 2} cy={height / 2} r={r} fill="black" />
          </mask>
        </defs>
        <rect width={width} height={height} fill={hexToRgba(SAKURA.plum, 0.92)} mask="url(#iris-mask)" />
        <circle cx={width / 2} cy={height / 2} r={r} fill="none" stroke={hexToRgba(SAKURA.blush, 0.5)} strokeWidth={3} />
      </svg>
    </AbsoluteFill>
  );
};

/** Organic sumi ink dissolve: a STATIC turbulence-displaced blob grows via scale. */
const InkBleed: React.FC<{ t: number; accentColor?: string }> = ({ t, accentColor }) => {
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const grow = easeOut(interpolate(t, [0, 0.7], [0, 1], clamp));
  const fade = interpolate(t, [0.72, 1], [1, 0], clamp);
  const maxR = Math.hypot(width, height) * 0.62;
  // Ink tints from the accent's hue but renders dark (same wash the scene grounds
  // use); a missing accent falls back to exactly the reference plum.
  const ink = deriveDarkWash(accentColor).center;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: fade }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* STATIC turbulence — no animated baseFrequency */}
          <filter id={`ink-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={7} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={90} />
          </filter>
        </defs>
        <g filter={`url(#ink-${uid})`}>
          <circle cx={width / 2} cy={height / 2} r={maxR * grow} fill={hexToRgba(ink, 0.95)} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A thick crimson brush stroke sweeps across the frame. */
const BrushSwipe: React.FC<{ t: number }> = ({ t }) => {
  const { width, height } = useVideoConfig();
  const cover = interpolate(t, [0, 0.5], [0, 1], { ...clamp, easing: easeInOut });
  const leave = interpolate(t, [0.5, 1], [0, 1], { ...clamp, easing: easeInOut });
  const bandW = width * 1.25;
  const x = -bandW + (width + bandW) * (t < 0.5 ? cover : 1) - width * 1.2 * leave;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${x},0) skewX(-8)`}>
          <rect x={0} y={-40} width={bandW} height={height + 80} fill={SAKURA.crimson} opacity={0.96} />
          <rect x={bandW} y={-40} width={60} height={height + 80} fill={SAKURA.deepBlush} opacity={0.7} />
          <rect x={-30} y={-40} width={40} height={height + 80} fill={hexToRgba(SAKURA.crimson, 0.5)} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ─── Directional / geometric ─────────────────────────────────────────────────

/** Plum panel wipes across on a diagonal (clip-path), then off. */
const DiagonalPanel: React.FC<{ t: number }> = ({ t }) => {
  const cover = easeInOut(interpolate(t, [0, 0.5], [0, 1], clamp));
  const leave = easeInOut(interpolate(t, [0.5, 1], [0, 1], clamp));
  const shift = t < 0.5 ? (1 - cover) * -120 : leave * 120;
  const clip =
    t < 0.5
      ? `polygon(${-20 + shift}% 0, ${100 + shift}% 0, ${80 + shift}% 100%, ${-40 + shift}% 100%)`
      : `polygon(${shift}% 0, ${120 + shift}% 0, ${100 + shift}% 100%, ${-20 + shift}% 100%)`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(120deg, ${SAKURA.crimson}, ${SAKURA.plum})`,
          clipPath: clip,
          WebkitClipPath: clip,
        }}
      />
    </AbsoluteFill>
  );
};

/** Vertical washi bands close like a folding screen, then open. */
const VerticalShutter: React.FC<{ t: number }> = ({ t }) => {
  const { width, height } = useVideoConfig();
  const bands = 6;
  const close = interpolate(t, [0, 0.55], [0, 1], { ...clamp, easing: easeInOut });
  const open = interpolate(t, [0.55, 1], [0, 1], { ...clamp, easing: easeInOut });
  const scaleY = t < 0.55 ? close : 1 - open;
  const bandW = width / bands;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: bands }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: i * bandW,
            top: 0,
            width: bandW + 1,
            height,
            transformOrigin: i % 2 === 0 ? "top" : "bottom",
            transform: `scaleY(${scaleY})`,
            background: `linear-gradient(${i % 2 === 0 ? "180deg" : "0deg"}, ${hexToRgba(SAKURA.washi, 0.96)}, ${hexToRgba(SAKURA.mist, 0.92)})`,
            borderLeft: `1px solid ${hexToRgba(SAKURA.crimson, 0.25)}`,
            boxSizing: "border-box",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Soft rack-focus bloom: a blush wash blooms with scale, then clears. */
const RackBloom: React.FC<{ t: number }> = ({ t }) => {
  const veil = interpolate(t, [0, 0.5, 1], [0, 0.32, 0], clamp);
  const scale = interpolate(t, [0, 1], [1.04, 1.12], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${hexToRgba(SAKURA.blush, 0.7)}, ${hexToRgba(SAKURA.mist, 0.3)} 60%, transparent)`,
          opacity: veil,
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Soft blur dissolve: a dreamy blush mist blooms with a slow zoom, holds soft,
 * then clears. (backdrop-filter is unreliable across a TransitionSeries composite,
 * so this variant leans on a blush mist + zoom rather than blurring the scene.)
 */
const SoftBlur: React.FC<{ t: number }> = ({ t }) => {
  const mist = interpolate(t, [0, 0.5, 1], [0, 0.4, 0.14], clamp);
  const zoom = interpolate(t, [0, 1], [1, 1.06], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", transform: `scale(${zoom})` }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${hexToRgba(SAKURA.blush, 0.78)}, ${hexToRgba(SAKURA.mist, 0.4)} 55%, ${hexToRgba(SAKURA.washi, 0.15)})`,
          opacity: mist,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Effect overlay registry (progress-driven) ───────────────────────────────

/** Paints the chosen petal/craft/geometric overlay for the given effect + progress. */
const EffectOverlay: React.FC<{
  effect: SakuraTransition;
  seed: number;
  t: number;
  accentColor?: string;
}> = ({ effect, seed, t, accentColor }) => {
  switch (effect) {
    case "petal_vortex":
      return <PetalVortex seed={seed} t={t} />;
    case "petal_swarm":
      return <PetalSwarm seed={seed} t={t} />;
    case "petal_curtain":
      return <PetalCurtain seed={seed} t={t} />;
    case "bloom_unfurl":
      return <BloomUnfurl t={t} />;
    case "petal_scatter":
      return <PetalScatter seed={seed} t={t} />;
    case "petal_drift":
      return <PetalDrift seed={seed} t={t} />;
    case "petal_gust":
      return <PetalGust seed={seed} t={t} />;
    case "shoji_slide":
      return <ShojiSlide t={t} />;
    case "iris_wipe":
      return <IrisWipe t={t} />;
    case "ink_bleed":
      return <InkBleed t={t} accentColor={accentColor} />;
    case "brush_swipe":
      return <BrushSwipe t={t} />;
    case "diagonal_panel":
      return <DiagonalPanel t={t} />;
    case "vertical_shutter":
      return <VerticalShutter t={t} />;
    case "rack_bloom":
      return <RackBloom t={t} />;
    case "soft_blur":
      return <SoftBlur t={t} />;
    case "fade":
    default:
      return null; // plain fade → no overlay
  }
};

// ─── TransitionPresentation factory ──────────────────────────────────────────

interface SakuraPresentationProps extends Record<string, unknown> {
  effect: SakuraTransition;
  seed: number;
  accentColor?: string;
}

/**
 * One presentation component drives every Sakura boundary. The OUTGOING scene
 * fades out; the INCOMING scene reveals underneath the chosen flower overlay.
 * For `effect: "fade"` there is no overlay — a clean petal-free crossfade
 * (used for the hero handoff).
 */
const SakuraPresentationComponent: React.FC<
  TransitionPresentationComponentProps<SakuraPresentationProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const t = easeInOut(presentationProgress);
  const { effect, seed, accentColor } = passedProps;

  if (presentationDirection === "exiting") {
    // Outgoing scene fades out — gone a touch before the overlay peaks.
    const opacity = effect === "fade" ? 1 - t : Math.max(0, 1 - t / 0.7);
    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
  }

  // Incoming reveals underneath the overlay.
  const reveal = effect === "fade" ? t : Math.max(0, Math.min(1, (t - 0.3) / 0.7));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>
      {/* Overlay runs on the SAME eased clock (`t`) as the scene crossfade above,
          so petals and the fade stay locked together — a raw-progress overlay
          desynced from an eased fade was what read as broken/glitchy. */}
      <EffectOverlay effect={effect} seed={seed} t={t} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

const makeSakuraPresentation = (
  effect: SakuraTransition,
  seed: number,
  accentColor?: string,
): TransitionPresentation<SakuraPresentationProps> => ({
  component: SakuraPresentationComponent,
  props: { effect, seed, accentColor },
});

// ─── Selection (Chronicle-style, deterministic) ──────────────────────────────

export interface SakuraTransitionChoice {
  presentation: TransitionPresentation<SakuraPresentationProps>;
  frames: number;
}

// The hero (leaving the intro) exits with the signature petal_curtain — the flower
// curtain sweeps in as the intro hands off. Entering the ending still hands off with
// a clean petal-FREE fade.
const HERO_LAYOUTS_FROM = new Set<string>(["sakura_intro"]);
// Accept both the Sakura-prefixed id and the canonical "ending_socials" id the
// backend emits for the appended ending scene, so the clean petal-free fade fires
// either way.
const HERO_LAYOUTS_TO = new Set<string>(["sakura_ending_socials", "ending_socials"]);

// Flower-transition pool, cycled by boundary index. Ordered so adjacent picks
// read as clearly different families (petal / craft / geometric).
const POOL: SakuraTransition[] = [
  "petal_curtain",
  "rack_bloom",
  "ink_bleed",
  "petal_vortex",
  "petal_drift",
  "soft_blur",
  "bloom_unfurl",
  "petal_swarm",
  "shoji_slide",
  "petal_scatter",
];

/**
 * Choose the transition for the boundary that LEAVES scene `fromIdx`.
 * Deterministic: leaving the hero (intro) → signature petal_curtain; entering the
 * ending → plain fade; otherwise POOL[fromIdx % POOL.length].
 * `fromLayout` / `toLayout` are used only for these special-cases.
 */
export const pickSakuraTransition = (
  fromIdx: number,
  fromLayout: string | undefined,
  toLayout: string | undefined,
  accentColor?: string,
): SakuraTransitionChoice => {
  const seed = seedFor(fromIdx);
  if (HERO_LAYOUTS_FROM.has(fromLayout ?? "")) {
    return { presentation: makeSakuraPresentation("petal_curtain", seed, accentColor), frames: framesForEffect("petal_curtain") };
  }
  if (HERO_LAYOUTS_TO.has(toLayout ?? "")) {
    return { presentation: makeSakuraPresentation("fade", seed, accentColor), frames: framesForEffect("fade") };
  }
  const effect = POOL[fromIdx % POOL.length];
  return { presentation: makeSakuraPresentation(effect, seed, accentColor), frames: framesForEffect(effect) };
};
