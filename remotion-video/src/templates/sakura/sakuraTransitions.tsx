/**
 * Sakura scene-boundary transitions — a varied vocabulary of petal, Japanese-craft,
 * and directional/geometric wipes. Each overlay is nested blackswan-style in the
 * last SAKURA_TRANSITION_FRAMES of the OUTGOING scene, so only one scene paints
 * per frame. Transform / opacity / clip-path only (GPU-friendly); ink edges use a
 * STATIC turbulence mask animated via clip-path — never animated baseFrequency.
 *
 * Mirror byte-identical in both trees:
 *   remotion-video/src/templates/sakura/sakuraTransitions.tsx
 *   frontend/src/components/remotion/sakura/sakuraTransitions.tsx
 */
import React, { useId, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SAKURA, SoftPetal, hexToRgba, sakuraRand } from "./sakuraStyle";

export const SAKURA_TRANSITION_FRAMES = 34;

export type SakuraTransition =
  | "petal_vortex"
  | "petal_swarm"
  | "bloom_unfurl"
  | "petal_scatter"
  | "shoji_slide"
  | "iris_wipe"
  | "ink_bleed"
  | "brush_swipe"
  | "diagonal_panel"
  | "vertical_shutter"
  | "rack_bloom";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Master transition clock: eased 0→1 over the window so motion glides in and
// settles out (smoother + reads slower than a linear ramp at the same length).
const useT = () => {
  const frame = useCurrentFrame();
  const lin = interpolate(frame, [0, SAKURA_TRANSITION_FRAMES], [0, 1], clamp);
  return easeInOut(lin);
};

// ─── Petal-based ─────────────────────────────────────────────────────────────

/** Petals spiral inward toward center, then burst outward as the veil peaks. */
const PetalVortex: React.FC<{ seed: number }> = ({ seed }) => {
  const t = useT();
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
const PetalSwarm: React.FC<{ seed: number }> = ({ seed }) => {
  const t = useT();
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

/** A single giant blossom opens from center, its petals expanding to wipe the frame. */
const BloomUnfurl: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(width, height) * 0.62;
  const grow = easeOut(interpolate(t, [0, 0.7], [0, 1], clamp));
  const fade = interpolate(t, [0.7, 1], [1, 0], clamp);
  // 5 big petals rotating open + a filling center disc
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: fade }}>
        <g transform={`translate(${cx},${cy}) rotate(${grow * 40})`}>
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
                opacity={0.9}
              />
            );
          })}
          <circle r={maxR * 0.22 * grow} fill={SAKURA.crimson} opacity={0.85} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Petals accumulate at the bottom, then a gust blows them up and away. */
const PetalScatter: React.FC<{ seed: number }> = ({ seed }) => {
  const t = useT();
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
          // accumulate (fall to rest) first half, blow up + away second half
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

// ─── Japanese-craft ──────────────────────────────────────────────────────────

/** Two washi panels slide in from left+right to meet at center, then part. */
const ShojiSlide: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  // close over first 55%, part over the rest
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
  // faint shoji lattice
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

/** Circle iris closing to center then opening — via clip-path. */
const IrisWipe: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const maxR = Math.hypot(width, height) * 0.55;
  // veil disc closes in (radius large->0 as inverse clip) then opens
  const close = interpolate(t, [0, 0.55], [maxR, 0], { ...clamp, easing: easeInOut });
  const open = interpolate(t, [0.55, 1], [0, maxR], { ...clamp, easing: easeInOut });
  const r = t < 0.55 ? close : open;
  // A filled plum veil with a hole (the iris) — using an inverse circle clip
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
const InkBleed: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const grow = easeOut(interpolate(t, [0, 0.7], [0, 1], clamp));
  const fade = interpolate(t, [0.72, 1], [1, 0], clamp);
  const maxR = Math.hypot(width, height) * 0.62;
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
          <circle cx={width / 2} cy={height / 2} r={maxR * grow} fill={hexToRgba(SAKURA.plum, 0.95)} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A thick crimson brush stroke sweeps across the frame. */
const BrushSwipe: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  // brush band travels left->right; reveal is via its own width covering then leaving
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
          {/* ragged brush edge */}
          <rect x={-30} y={-40} width={40} height={height + 80} fill={hexToRgba(SAKURA.crimson, 0.5)} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ─── Directional / geometric ─────────────────────────────────────────────────

/** Plum panel wipes across on a diagonal (clip-path), then off. */
const DiagonalPanel: React.FC = () => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const cover = easeInOut(interpolate(t, [0, 0.5], [0, 1], clamp));
  const leave = easeInOut(interpolate(t, [0.5, 1], [0, 1], clamp));
  // panel enters from the left, diagonal leading edge
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
const VerticalShutter: React.FC = () => {
  const t = useT();
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

/** Soft rack-focus bloom: a blush wash blooms with blur+scale, then clears. */
const RackBloom: React.FC = () => {
  const t = useT();
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

// ─── Registry + picker ───────────────────────────────────────────────────────

const RENDERERS: Record<SakuraTransition, React.FC<{ seed: number }>> = {
  petal_vortex: ({ seed }) => <PetalVortex seed={seed} />,
  petal_swarm: ({ seed }) => <PetalSwarm seed={seed} />,
  bloom_unfurl: () => <BloomUnfurl />,
  petal_scatter: ({ seed }) => <PetalScatter seed={seed} />,
  shoji_slide: () => <ShojiSlide />,
  iris_wipe: () => <IrisWipe />,
  ink_bleed: () => <InkBleed />,
  brush_swipe: () => <BrushSwipe />,
  diagonal_panel: () => <DiagonalPanel />,
  vertical_shutter: () => <VerticalShutter />,
  rack_bloom: () => <RackBloom />,
};

/** Signature transition for the scene being ENTERED (keyed by its layout). */
const ENTER_SIGNATURE: Record<string, SakuraTransition> = {
  sakura_intro: "petal_vortex",
  sakura_section: "ink_bleed",
  sakura_quote: "iris_wipe",
  sakura_two_column_detail: "vertical_shutter",
  sakura_stat_highlight: "bloom_unfurl",
  sakura_list_scene: "diagonal_panel",
  sakura_text_narration: "rack_bloom",
  sakura_image_focus: "brush_swipe",
  sakura_chapter_transition: "shoji_slide",
  sakura_ending_socials: "petal_vortex",
};

// Fallback rotation guaranteeing no adjacent repeat.
const ROTATION: SakuraTransition[] = [
  "petal_swarm",
  "diagonal_panel",
  "iris_wipe",
  "petal_scatter",
  "vertical_shutter",
  "rack_bloom",
  "ink_bleed",
];

/**
 * Choose a transition for the boundary that ENTERS `enteringLayout`.
 * `prev` is the transition used at the previous boundary, so we never repeat
 * two boundaries in a row.
 */
export const pickSakuraTransition = (
  enteringLayout: string | undefined,
  boundaryIndex: number,
  prev?: SakuraTransition,
): SakuraTransition => {
  const sig = ENTER_SIGNATURE[enteringLayout ?? ""];
  if (sig && sig !== prev) return sig;
  // pick from rotation, offset by boundaryIndex, skipping prev
  for (let k = 0; k < ROTATION.length; k++) {
    const cand = ROTATION[(boundaryIndex + k) % ROTATION.length];
    if (cand !== prev) return cand;
  }
  return "petal_swarm";
};

/** Renders the chosen transition overlay. */
export const SakuraTransitionOverlay: React.FC<{
  transition: SakuraTransition;
  seed?: number;
}> = ({ transition, seed = 5 }) => {
  const R = RENDERERS[transition] ?? RENDERERS.petal_swarm;
  return <R seed={seed} />;
};
