import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette } from "./blackswanAccent";

/**
 * arc_features__v2 — "Rainfall Row".
 *
 * Mid-scene variant of `arc_features`. Same props, different composition:
 *
 *   image (top) → title → narration → feature ROW → water waves (bottom)
 *
 * and water drops fall continuously from the top of the frame onto the feature
 * points, splashing and sparkling where they land. One emitter per feature, so
 * every feature is struck repeatedly.
 *
 * ── The load-bearing detail: ONE expression owns the column x ────────────
 * The drops are SVG in a 1280×720 viewBox; the feature row is DOM. They can
 * only line up if BOTH derive from the same function — so `featureCX()` below
 * is the single source of truth, feeding the DOM cell's `left%` AND the SVG
 * emitter's `cx`. That works because `preserveAspectRatio="none"` makes a
 * viewBox-x fraction identical to a frame-width fraction in both aspect ratios.
 *
 * This is why the row is NOT a flex row. Flexbox decides column positions at
 * layout time, and the SVG has no way to read them back — the drops would fall
 * beside the features instead of onto them. Same reasoning on the vertical
 * axis: `sceneGeom()` returns every band in viewBox units, DOM converts to %.
 * If you refactor this into flexbox, the rain stops hitting anything.
 *
 * ── Why this code is copied rather than imported ────────────────────────
 * The wave field is copied from `droplet_intro__v2`, the droplet physics from
 * the base `DropletIntro`, and the seeded RNG from the spotlight template.
 * Copying is REQUIRED, not stylistic: the backend copies only
 * `src/templates/<id>/` into each per-project render workspace, so a
 * cross-template import compiles in the Player and then breaks the headless
 * render with an unresolved import. (Same reason `useFitText` is duplicated per
 * template — see its docblock.)
 *
 * Filter/uid suffix for this scene: `-afv2`. SVG filter, gradient and mask IDs
 * are document-global — every scene mounts into one AbsoluteFill — so
 * everything introduced here carries that suffix or it collides.
 */

const display = "'Righteous', cursive";

// ── Shared coordinate space ──────────────────────────────────────────────
// `preserveAspectRatio="none"` guarantees x=0 and x=VB_W land exactly on the
// frame edges in BOTH aspect ratios, which is what makes the viewBox-x ↔ DOM-%
// correspondence exact. A horizontally stretched sine is still a sine.
const VB_W = 1280;
const VB_H = 720;

/** Polyline resolution for the wave strands. */
const STEP = 4;

/** Portrait stretches wavelengths by a third — a 9:16 frame packs more crests. */
const PORTRAIT_FREQ_SCALE = 0.75;

const ICONS = ["◈", "↯", "⬡", "⟁", "◇", "⟐"];

/** Same derivation as the base arc_features, so both show identical items. */
function deriveItems(narration: string): string[] {
  return narration.split(/[.;•\n]/).map((s) => s.trim()).filter(Boolean);
}

// ── Column geometry — the single source of truth ─────────────────────────

/** Side inset of the feature row, in viewBox units. */
function colInset(portrait: boolean): number {
  return portrait ? 40 : 64;
}

/** Width of one feature column, in viewBox units. */
function featureColW(n: number, portrait: boolean): number {
  const inset = colInset(portrait);
  return (VB_W - inset * 2) / Math.max(1, n);
}

/**
 * Centre x of feature `i`, in viewBox units.
 *
 * Called by BOTH the DOM cell (converted to a left%) and the drop emitter
 * (used raw as an SVG cx). Do not duplicate this arithmetic anywhere.
 */
function featureCX(i: number, n: number, portrait: boolean): number {
  return colInset(portrait) + (i + 0.5) * featureColW(n, portrait);
}

// ── Vertical bands ───────────────────────────────────────────────────────

type BandGeom = { top: number; waterline: number; bottom: number };

type SceneGeom = {
  imgTop: number;
  imgBot: number;
  titleTop: number;
  narrTop: number;
  narrBot: number;
  rowTop: number;
  rowBot: number;
  band: BandGeom;
};

/**
 * Every band's position in viewBox units.
 *
 * The outer stack is four ABSOLUTELY positioned bands rather than one flex
 * column, because the drop emitters need the row's y as a number before layout
 * happens — a flex child's position is only knowable afterwards.
 *
 * With no image, the copy expands upward into the image band; the row and the
 * water deliberately do NOT move, so the rain and waves stay put either way.
 */
function sceneGeom(portrait: boolean, hasImage: boolean): SceneGeom {
  const f = (v: number) => v * VB_H;
  if (portrait) {
    return hasImage
      ? { imgTop: f(0.07), imgBot: f(0.40), titleTop: f(0.42), narrTop: f(0.56), narrBot: f(0.70), rowTop: f(0.775), rowBot: f(0.905), band: { top: f(0.87), waterline: f(0.915), bottom: VB_H } }
      : { imgTop: 0, imgBot: 0, titleTop: f(0.12), narrTop: f(0.36), narrBot: f(0.66), rowTop: f(0.775), rowBot: f(0.905), band: { top: f(0.87), waterline: f(0.915), bottom: VB_H } };
  }
  return hasImage
    ? { imgTop: f(0.05), imgBot: f(0.36), titleTop: f(0.38), narrTop: f(0.52), narrBot: f(0.66), rowTop: f(0.735), rowBot: f(0.855), band: { top: f(0.82), waterline: f(0.87), bottom: VB_H } }
    : { imgTop: 0, imgBot: 0, titleTop: f(0.10), narrTop: f(0.32), narrBot: f(0.62), rowTop: f(0.735), rowBot: f(0.855), band: { top: f(0.82), waterline: f(0.87), bottom: VB_H } };
}

/** viewBox units → CSS percentage of the frame. Exact under `none`. */
const pctX = (vb: number) => `${(vb / VB_W) * 100}%`;
const pctY = (vb: number) => `${(vb / VB_H) * 100}%`;

// ── Waves ────────────────────────────────────────────────────────────────

type WaveStrand = {
  yOff: number;
  amp: number;
  lambda: number;
  phase0: number;
  drift: number;
  wobblePeriodSec: number;
  wobbleAmp: number;
  sw: number;
  op: number;
  tone: "core" | "bright" | "vivid" | "mid" | "waterLo" | "deep";
};

/**
 * Six layers, fanning down from just above the waterline.
 *
 * ── The depth budget is tighter than it looks ───────────────────────────
 * The deepest strand reaches `waterline + yOff + amp`, and that must stay
 * inside VB_H (720). PORTRAIT is the binding case: its waterline sits at
 * 0.915 * 720 = 659, leaving only ~61 units. An earlier ladder ending at
 * yOff 74 / amp 19 put the last strand at 752 — 32 units off the bottom of
 * the frame. Hence the compressed tail below (deepest = 659 + 38 + 14 = 711).
 * Landscape has more room (waterline 626) and is not the constraint.
 *
 * Alternating drift directions keep the field from reading as one sliding
 * sheet, and opacity falls with depth so the front strand stays legible.
 */
const WAVE_STRANDS: WaveStrand[] = [
  { yOff: -12, amp:  9, lambda: 470, phase0: 0.00, drift:  30, wobblePeriodSec: 26, wobbleAmp: 3, sw: 1.7, op: 0.85, tone: "bright"  },
  { yOff:  -1, amp: 10, lambda: 410, phase0: 1.30, drift: -34, wobblePeriodSec: 31, wobbleAmp: 3, sw: 1.5, op: 0.66, tone: "core"    },
  { yOff:  10, amp: 11, lambda: 360, phase0: 2.60, drift:  40, wobblePeriodSec: 35, wobbleAmp: 3, sw: 1.3, op: 0.52, tone: "vivid"   },
  { yOff:  20, amp: 12, lambda: 315, phase0: 3.90, drift: -44, wobblePeriodSec: 39, wobbleAmp: 4, sw: 1.1, op: 0.40, tone: "mid"     },
  { yOff:  29, amp: 13, lambda: 275, phase0: 5.10, drift:  52, wobblePeriodSec: 44, wobbleAmp: 4, sw: 0.9, op: 0.30, tone: "waterLo" },
  { yOff:  38, amp: 14, lambda: 240, phase0: 1.80, drift: -58, wobblePeriodSec: 49, wobbleAmp: 4, sw: 0.8, op: 0.22, tone: "deep"    },
];

function waveStrands(portrait: boolean): WaveStrand[] {
  if (!portrait) return WAVE_STRANDS;
  return WAVE_STRANDS.map((s) => ({ ...s, lambda: s.lambda / PORTRAIT_FREQ_SCALE }));
}

/** Y of one strand's surface at a given x and time. */
function strandSurfaceY(s: WaveStrand, tSec: number, baseY: number, x: number): number {
  const k = (2 * Math.PI) / s.lambda;
  const driftTheta = k * tSec * s.drift;
  const wobbleY = s.wobbleAmp * Math.sin((tSec / s.wobblePeriodSec) * Math.PI * 2 + s.phase0 * 0.4);
  return baseY + s.yOff + wobbleY + s.amp * Math.sin(k * x - driftTheta + s.phase0);
}

/** Build one strand's `d`, extended a half wavelength past each edge. */
function buildWavePathD(s: WaveStrand, tSec: number, baseY: number): string {
  const margin = s.lambda * 0.5;
  const parts: string[] = [];
  for (let x = -margin; x <= VB_W + margin; x += STEP) {
    const y = strandSurfaceY(s, tSec, baseY, x);
    parts.push(`${parts.length === 0 ? "M" : "L"} ${x.toFixed(0)},${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

// ── Droplets ─────────────────────────────────────────────────────────────

/**
 * Fract hash. Remotion renders every frame in a fresh pass, so `Math.random()`
 * would make the CLI render disagree with the Player — every "random" value
 * here is a pure function of its seed.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Seconds between drops on ONE feature. */
const EVERY = 2.6;
/** Seconds of fall. */
const FALL = 1.05;
/** Seconds a splash lives after impact. */
const SPLASH = 1.35;
/**
 * Invariant: LIFE < EVERY, so an emitter never has two live bursts at once and
 * the node count stays bounded.
 */
const LIFE = FALL + SPLASH;
/** How far above its impact point a drop spawns, in viewBox units. */
const SPAWN_ABOVE = 300;

const DROP_SEED = 41.7;

/**
 * A teardrop outline: pointed at the top, circular at the bottom.
 *
 * `cx,cy` is the shape's CENTRE, so it drops in where an ellipse of the same
 * rx/ry would have sat. The apex is one ry above centre; two quadratic curves
 * bow out to the widest point at mid-height, then a bottom arc closes the
 * belly. Control points at ±rx*1.35 are what give the flanks their swell —
 * pull them in and it degenerates back into a leaf shape.
 */
function teardropPathD(cx: number, cy: number, rx: number, ry: number): string {
  const apexY = cy - ry;
  const midY = cy + ry * 0.15;
  const botY = cy + ry;
  return [
    `M ${cx.toFixed(2)},${apexY.toFixed(2)}`,
    `Q ${(cx + rx * 1.35).toFixed(2)},${(cy - ry * 0.25).toFixed(2)} ${(cx + rx).toFixed(2)},${midY.toFixed(2)}`,
    `A ${rx.toFixed(2)},${(ry * 0.85).toFixed(2)} 0 1 1 ${(cx - rx).toFixed(2)},${midY.toFixed(2)}`,
    `Q ${(cx - rx * 1.35).toFixed(2)},${(cy - ry * 0.25).toFixed(2)} ${cx.toFixed(2)},${apexY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Teardrop morph over the fall (copied from the base `DropletIntro`). */
function dropletOutline(u: number): { rx: number; ry: number; shapeOp: number } {
  const rx = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [7, 6, 5.5, 9, 11], { extrapolateRight: "clamp" });
  const ry = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [8, 13, 15, 9, 3], { extrapolateRight: "clamp" });
  let shapeOp = 1;
  if (u <= 0) shapeOp = 0;
  else if (u < 0.08) shapeOp = interpolate(u, [0, 0.08], [0, 1]);
  else if (u > 0.96) shapeOp = interpolate(u, [0.96, 1], [1, 0]);
  return { rx, ry, shapeOp };
}

/**
 * Fall easing (copied from the base, with its module constants lifted into
 * arguments so each emitter can run its own timeline).
 *
 * Keeps the base's overshoot: the drop travels 30 units PAST the impact point
 * while flattening, which is what sells penetration rather than a stop.
 */
function dropFallMotion(local: number, travel: number): { y: number; gOpacity: number; u: number } {
  const u = local / FALL;
  if (u <= 0) return { y: 0, gOpacity: 0, u: 0 };
  if (u >= 1) return { y: travel + 30, gOpacity: 0, u: 1 };
  const gOpacity = u < 0.08 ? interpolate(u, [0, 0.08], [0, 1]) : u > 0.96 ? interpolate(u, [0.96, 1], [1, 0]) : 1;
  const y = interpolate(u, [0, 0.84, 0.96, 1], [0, travel, travel + 26, travel + 30], {
    easing: Easing.bezier(0.38, 0.04, 0.52, 1),
    extrapolateRight: "clamp",
  });
  return { y, gOpacity, u };
}

/** Expanding shock ring sample (copied from the base `DropletIntro`). */
function shockRing(p: number, maxRx: number, maxRy: number) {
  const rx = interpolate(p, [0, 1], [8, maxRx], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const ry = interpolate(p, [0, 1], [3, maxRy], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const opacity = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [0.95, 0.88, 0.62, 0.28, 0], { extrapolateRight: "clamp" });
  const sw = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [3, 2.4, 1.6, 0.8, 0.25], { extrapolateRight: "clamp" });
  return { rx, ry, opacity, sw };
}

type BurstState = {
  /** Seconds since this burst's drop spawned. */
  local: number;
  /** Which repetition — folded into the seeds so each differs. */
  burst: number;
  /** Per-burst ring width scale. */
  rWide: number;
  /** Per-burst ray length / count jitter. */
  rRay: number;
};

/**
 * Which burst (if any) emitter `i` is currently running.
 *
 * Adapts the `FlashPop` slot idiom into seconds. `offset` is drawn once from
 * `i`, so the emitters start staggered; `jitter` is re-drawn every burst, which
 * is what stops them drifting into a single shared rhythm over a long scene.
 *
 * Both the SVG drop AND the DOM icon flash call this, so the two can never
 * disagree about when a hit lands.
 */
function burstState(i: number, tSec: number, emitStart: number): BurstState | null {
  const offset = seededRandom(DROP_SEED + i * 11.3) * EVERY;
  const tt = tSec - emitStart - offset;
  if (tt < 0) return null;
  const phase = tt % EVERY;
  const burst = Math.floor(tt / EVERY);
  const jitter = (seededRandom(DROP_SEED + i * 31.7 + burst * 97.1) - 0.5) * 0.34;
  const local = phase - jitter;
  if (local < 0 || local >= LIFE) return null;
  return {
    local,
    burst,
    rWide: seededRandom(DROP_SEED + i * 53.9 + burst * 41.3),
    rRay: seededRandom(DROP_SEED + i * 7.7 + burst * 13.1),
  };
}

/** 0→1 impact pulse, for the DOM icon flash. Shares `burstState` with the SVG. */
function impactPulse(i: number, tSec: number, emitStart: number): number {
  const b = burstState(i, tSec, emitStart);
  if (!b || b.local < FALL) return 0;
  return interpolate(b.local, [FALL, FALL + 0.22], [1, 0], { extrapolateRight: "clamp" });
}

/** One feature's falling drop and its splash. */
const FeatureDrop: React.FC<{
  i: number;
  cx: number;
  impactY: number;
  tSec: number;
  emitStart: number;
  pal: ReturnType<typeof blackswanNeonPalette>;
}> = ({ i, cx, impactY, tSec, emitStart, pal }) => {
  const b = burstState(i, tSec, emitStart);
  if (!b) return null;

  const spawnY = impactY - SPAWN_ABOVE;

  // ── Falling ──
  if (b.local < FALL) {
    const { y, gOpacity, u } = dropFallMotion(b.local, SPAWN_ABOVE);
    const { rx, ry, shapeOp } = dropletOutline(u);
    const op = gOpacity * shapeOp;
    const cy = spawnY + y;
    return (
      <g opacity={op}>
        <line
          x1={cx} y1={Math.max(spawnY, cy - 40)} x2={cx} y2={cy}
          stroke={pal.core} strokeWidth={1.2} opacity={0.32}
          filter="url(#bsw-fdrop-afv2)"
        />
        {/* A real teardrop: pointed apex, round belly — not an ellipse.
            HOLLOW: `fill="none"` throughout, so it reads as a bent neon tube
            rather than a solid blob. The lit look comes from stacking a wide
            blurred stroke under a thin bright one — never from a fill. */}
        <path
          d={teardropPathD(cx, cy, rx * 1.5, ry * 1.5)}
          fill="none"
          stroke={pal.core}
          strokeWidth={3.4}
          strokeLinejoin="round"
          opacity={0.55}
          filter="url(#bsw-fdrop-afv2)"
        />
        <path
          d={teardropPathD(cx, cy, rx * 1.5, ry * 1.5)}
          fill="none"
          stroke={pal.bright}
          strokeWidth={1.3}
          strokeLinejoin="round"
          opacity={0.95}
        />
      </g>
    );
  }

  // ── Splashing ──
  const sp = b.local - FALL;
  const RAYS = 5 + Math.round(b.rRay * 2); // 5..7
  const rayDur = 0.3;

  return (
    <g>
      {sp <= rayDur &&
        Array.from({ length: RAYS }).map((_, ri) => {
          // Upper half only: a splash off a horizontal surface throws up, not down.
          const ang = ((-180 + ri * (180 / Math.max(1, RAYS - 1))) * Math.PI) / 180;
          const rl = 34 + (ri % 3) * 14 + b.rRay * 10;
          const ex = cx + Math.cos(ang) * rl;
          const ey = impactY + Math.sin(ang) * rl;
          // Full-length static line revealed by its dash offset — no per-frame
          // geometry recompute, and it draws outward from the impact point.
          const grow = interpolate(sp, [0, rayDur], [rl, 0], {
            easing: Easing.out(Easing.quad),
            extrapolateRight: "clamp",
          });
          return (
            <line
              key={ri} x1={cx} y1={impactY} x2={ex} y2={ey}
              stroke={pal.core} strokeWidth={1.1} strokeLinecap="round"
              strokeDasharray={`${rl} ${rl}`} strokeDashoffset={grow}
              opacity={interpolate(sp, [0, rayDur * 0.7, rayDur], [0.75, 0.5, 0], { extrapolateRight: "clamp" })}
              filter="url(#bsw-fdrop-afv2)"
            />
          );
        })}

      {/* Concentric flat ripples spreading from the impact — more rings and a
          flatter ry than a splash crown, so they read as rings ON a surface
          the way the reference art does. */}
      {[
        { maxRx: 86, del: 0, dur: 0.85, stroke: pal.bright },
        { maxRx: 70, del: 0.08, dur: 1.0, stroke: pal.core },
        { maxRx: 56, del: 0.17, dur: 1.15, stroke: pal.vivid },
        { maxRx: 42, del: 0.27, dur: 1.3, stroke: pal.mid },
      ].map((ring, ri) => {
        const rp = interpolate(sp, [ring.del, ring.del + ring.dur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (rp <= 0 || rp >= 1) return null;
        const wide = ring.maxRx * (0.85 + b.rWide * 0.35);
        const { rx, ry, opacity, sw } = shockRing(rp, wide, wide * 0.32);
        return (
          <ellipse
            key={ri} cx={cx} cy={impactY} rx={rx} ry={ry}
            fill="none" stroke={ring.stroke} strokeWidth={sw}
            opacity={opacity} filter="url(#bsw-fring-afv2)"
          />
        );
      })}
    </g>
  );
};

/** Image panel with glowing accent corners (adapted from the base). */
const ImageWithCornerGlowV2: React.FC<{
  src?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
}> = ({ src, videoUrl, videoMuted, videoVolume, videoDurationInFrames, videoStartInFrames, imageObjectPosition, imageZoom, accentColor }) => (
  <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
    {videoUrl ? (
      <ZoomCropVideo
        src={videoUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
        muted={videoMuted ?? true}
        volume={videoVolume ?? 0.35}
        durationInFrames={videoDurationInFrames}
        startInFrames={videoStartInFrames}
      />
    ) : (
      <ZoomCropImg src={src!} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} alt="" />
    )}
    <div
      style={{
        position: "absolute",
        inset: 0,
        boxShadow: `inset 0 0 0 2px ${accentColor}88, 0 0 24px ${accentColor}55, 0 0 48px ${accentColor}22`,
        pointerEvents: "none",
      }}
    />
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <filter id="arc-corner-glow-afv2" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M0,18 L0,0 L18,0" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow-afv2)" />
      <path d="M82,0 L100,0 L100,18" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow-afv2)" />
      <path d="M100,82 L100,100 L82,100" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow-afv2)" />
      <path d="M18,100 L0,100 L0,82" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow-afv2)" />
    </svg>
  </div>
);

export const ArcFeaturesV2: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration = "",
    items,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    titleFontSize,
    descriptionFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,
    fontFamily,
    aspectRatio = "landscape",
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
  } = props;

  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;
  const p = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const hasImage = !!(imageUrl || videoUrl);
  const featureItems = (items && items.length > 0 ? items : deriveItems(narration)).slice(0, 6);
  const n = Math.max(1, featureItems.length);

  const geom = useMemo(() => sceneGeom(p, hasImage), [p, hasImage]);
  const strands = useMemo(() => waveStrands(p), [p]);

  // NOTE: Template Studio's save-to-source rewrites these by regex, matching the
  // literal token `p` with BARE INTEGER literals. Keep this exact shape — no
  // `portrait ? …`, no arithmetic inside the ternary — or saving typography from
  // the editor fails with "No matching font-size defaults found".
  const titleTarget = titleFontSize ?? (p ? 79 : 72);
  const descTarget = descriptionFontSize ?? (p ? 46 : 36);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrRef = React.useRef<HTMLParagraphElement>(null);
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.max(15, Math.round(titleTarget * 0.34)),
    [title, titleTarget, titleFontSizeIsUserSet, p, height, hasImage],
    Math.round(height * (p ? 0.12 : 0.13)),
  );
  const { px: narrPx } = useFitText(
    narrRef,
    descTarget,
    descriptionFontSizeIsUserSet ? descTarget : Math.max(10, Math.round(descTarget * 0.38)),
    [narration, descTarget, descriptionFontSizeIsUserSet, titlePx, p, height, hasImage],
    Math.round(height * 0.13),
  );

  // Feature cell type shrinks as the row gets crowded.
  // Cell type is DERIVED from the narration size, so the editor's description
  // font-size control drives the feature row too rather than the row being
  // pinned to a constant while everything around it scales.
  const cellScale = n <= 3 ? 1 : n === 4 ? 0.86 : n === 5 ? 0.76 : 0.68;
  const cellPx = Math.max(11, Math.round(descTarget * 0.82 * cellScale));
  const iconPx = Math.round(cellPx * 1.1);
  /** Descriptions only fit when the row is sparse. */
  const showDesc = n <= 3;

  // Drops start only once the last feature cell has settled.
  const emitStart = 0.75 + n * 0.1 + 0.5;
  /** Impact lands on the icon glyph, near the top of the cell. */
  const impactY = geom.rowTop + (geom.rowBot - geom.rowTop) * 0.28;

  const waveOp = interpolate(t, [0, 0.8], [0, 1], { extrapolateRight: "clamp" });
  const imgOp = interpolate(t, [0.15, 0.85], [0, 1], { extrapolateRight: "clamp" });
  const imgY = interpolate(t, [0.15, 0.85], [14, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const titleOp = interpolate(t, [0.35, 1.05], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(t, [0.35, 1.05], [12, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const narrOp = interpolate(t, [0.6, 1.3], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <StarField accentColor={accentColor} />
      </div>

      {/* ── Waves ───────────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: waveOp }}
        aria-hidden
      >
        <defs>
          {/* Wide but SHORT filter regions: these paths span the frame
              horizontally yet occupy a thin band. */}
          <filter id="bsw-wglow-afv2" x="-3%" y="-60%" width="106%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
          </filter>
          <filter id="bsw-wcrisp-afv2" x="-3%" y="-60%" width="106%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="soft" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="bsw-bandgrad-afv2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="12%" stopColor="white" stopOpacity="0.85" />
            <stop offset="55%" stopColor="white" stopOpacity="1" />
            <stop offset="88%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0.08" />
          </linearGradient>
          <mask id="bsw-bandmask-afv2">
            <rect x={0} y={geom.band.top} width={VB_W} height={geom.band.bottom - geom.band.top} fill="url(#bsw-bandgrad-afv2)" />
          </mask>
        </defs>

        <g mask="url(#bsw-bandmask-afv2)">
          {strands.map((s, i) => {
            const d = buildWavePathD(s, t, geom.band.waterline);
            const stroke = pal[s.tone];
            return (
              <React.Fragment key={i}>
                <path d={d} fill="none" stroke={stroke} strokeWidth={s.sw * 3} strokeLinecap="round" opacity={s.op * 0.28} filter="url(#bsw-wglow-afv2)" />
                <path d={d} fill="none" stroke={stroke} strokeWidth={s.sw} strokeLinecap="round" opacity={s.op} filter="url(#bsw-wcrisp-afv2)" />
              </React.Fragment>
            );
          })}
        </g>
      </svg>

      {/* ── Image band ──────────────────────────────────────────────────── */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            left: pctX(colInset(p)),
            width: pctX(VB_W - colInset(p) * 2),
            top: pctY(geom.imgTop),
            height: pctY(geom.imgBot - geom.imgTop),
            opacity: imgOp,
            transform: `translateY(${imgY}px)`,
          }}
        >
          <ImageWithCornerGlowV2
            src={imageUrl}
            videoUrl={videoUrl}
            videoMuted={videoMuted}
            videoVolume={videoVolume}
            videoDurationInFrames={videoDurationInFrames}
            videoStartInFrames={videoStartInFrames}
            imageObjectPosition={imageObjectPosition}
            imageZoom={imageZoom}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* ── Title band ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          right: "5%",
          top: pctY(geom.titleTop),
          height: pctY(geom.narrTop - geom.titleTop),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {/* Width-constrained so long titles wrap rather than run past the
            edges — the fitter only measures height. */}
        <h2
          ref={titleRef}
          style={{
            margin: 0,
            width: "100%",
            maxWidth: "100%",
            fontFamily: fontFamily ?? display,
            fontSize: titlePx,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            letterSpacing: "0.08em",
            lineHeight: 1.18,
            textAlign: "center",
            textTransform: "capitalize",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {title}
        </h2>
        <div style={{ height: 2, width: p ? 220 : 300, background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
      </div>

      {/* ── Narration band ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "7%",
          right: "7%",
          top: pctY(geom.narrTop),
          height: pctY(geom.narrBot - geom.narrTop),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: narrOp,
        }}
      >
        <p
          ref={narrRef}
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: narrPx,
            color: textColor,
            fontWeight: 400,
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            textAlign: "center",
            maxWidth: p ? "100%" : "82%",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {narration}
        </p>
      </div>

      {/* ── Feature row ─────────────────────────────────────────────────────
          Each cell is absolutely placed at `featureCX`, NOT laid out by flex —
          see the header note. This is what lets the drops above find them. */}
      {featureItems.map((item, i) => {
        const colonIdx = item.indexOf(":");
        const boxTitle = colonIdx > 0 ? item.slice(0, colonIdx).trim() : item;
        const boxDesc = colonIdx > 0 ? item.slice(colonIdx + 1).trim() : "";
        const cellOp = interpolate(t, [0.75 + i * 0.1, 1.25 + i * 0.1], [0, 1], { extrapolateRight: "clamp" });
        const cellY = interpolate(t, [0.75 + i * 0.1, 1.25 + i * 0.1], [14, 0], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });
        // The payoff: the icon flares as its drop lands.
        const hit = impactPulse(i, t, emitStart);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pctX(featureCX(i, n, p)),
              width: pctX(featureColW(n, p) * 0.94),
              top: pctY(geom.rowTop),
              height: pctY(geom.rowBot - geom.rowTop),
              transform: `translateX(-50%) translateY(${cellY}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: cellOp,
              textAlign: "center",
            }}
          >
            <span
              style={{
                color: accentColor,
                fontFamily: fontFamily ?? display,
                fontSize: iconPx,
                lineHeight: 1,
                textShadow: `0 0 ${8 + hit * 22}px ${accentColor}`,
                transform: `scale(${1 + hit * 0.28})`,
              }}
            >
              {ICONS[i % ICONS.length]}
            </span>
            <span
              style={{
                color: accentColor,
                fontFamily: fontFamily ?? display,
                fontSize: cellPx,
                fontWeight: 700,
                letterSpacing: "0.5px",
                lineHeight: 1.2,
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {boxTitle}
            </span>
            {showDesc && boxDesc && (
              <span
                style={{
                  color: textColor,
                  fontFamily: fontFamily ?? display,
                  fontSize: Math.round(cellPx * 0.72),
                  fontWeight: 400,
                  lineHeight: 1.45,
                  opacity: 0.85,
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                {boxDesc}
              </span>
            )}
          </div>
        );
      })}

      {/* ── Drops and splashes ──────────────────────────────────────────────
          A SECOND svg over the same viewBox: the waves are band-masked and
          these must not be, and splashes read in front of the feature row. */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="bsw-fdrop-afv2" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bsw-fring-afv2" x="-140%" y="-140%" width="380%" height="380%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
          </filter>
        </defs>
        {featureItems.map((_, i) => (
          <FeatureDrop
            key={i}
            i={i}
            cx={featureCX(i, n, p)}
            impactY={impactY}
            tSec={t}
            emitStart={emitStart}
            pal={pal}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
