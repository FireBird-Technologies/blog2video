import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import { Swan } from "../components/Swan";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { SWAN_PM } from "../swanPaths";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { NeonWater } from "./neonWater";
import { blackswanNeonPalette } from "./blackswanAccent";
// Same-template import, so it is safe under the per-template render workspace
// copy — unlike the wave/droplet math below, which came from other templates
// and had to be duplicated.
import { MarbleField } from "./NeonNarrativeV2";

/**
 * dive_insight__v2 — "The Insight Falls".
 *
 * Variant of `dive_insight`. Same props, different composition:
 *
 *   quote (top) → swan riding a pond of sine waves → and at the END of the
 *   scene the swan comes apart into a drifting cloud of glitter.
 *
 * A drop falls from under the rule, continuously, landing on the water in
 * front of the swan.
 *
 * ── How the swan dissolves into its own shape ───────────────────────────
 * The particles are not a generic burst — each one is anchored to a point
 * sampled off the swan's ACTUAL outline, so the cloud starts as the bird and
 * comes apart from it.
 *
 * `SWAN_PM` is 237 pure cubic segments (`M`/`C`/`Z` only — no arcs, no relative
 * commands), so it can be flattened and resampled in plain JS at MODULE LOAD.
 * That is deliberate and worth preserving:
 *   - no DOM measurement, so no `delayRender` gating. A leaked delayRender
 *     handle hangs a headless render until timeout, and that risk disappears
 *     entirely if nothing is measured.
 *   - it stays in sync with `swanPaths.ts`, which is auto-generated and marked
 *     "do not hand-edit". A committed point array would silently desync on
 *     regeneration — particles tracing last month's swan, which no review
 *     would catch.
 * Cost is ~4600 Bézier evaluations once per process, at import time.
 *
 * NOTE `Swan.tsx`'s `PL = 18000` is NOT a path length — it is a dasharray large
 * enough to hide the path. The real arclength is ~3312. Do not reuse it here.
 *
 * ── Why this code is copied rather than imported ────────────────────────
 * The wave field comes from `droplet_intro__v2`, the droplet physics and
 * teardrop from `arc_features__v2`, the channel PRNG from the sakura template
 * and the particle-lifetime shape from nightfall's (unexported) StarSplurge.
 * Copying is REQUIRED: the backend copies only `src/templates/<id>/` into each
 * per-project render workspace, so a cross-template import compiles in the
 * Player and then breaks the headless render with an unresolved import.
 *
 * Filter/uid suffix for this scene: `-dvv2`. SVG ids are document-global.
 */

const display = "'Righteous', cursive";
const mono = "'Righteous', cursive";

/** Strength of the marbled ground. Sits furthest back, behind the star field. */
const MARBLE_OPACITY = 0.4;

/**
 * Scene photo/clip strength.
 *
 * TWO multipliers stack on the image: this, and the scrim rendered over it
 * (`IMAGE_SCRIM`). Effective visibility is `IMAGE_OPACITY * (1 - IMAGE_SCRIM)`,
 * so at 0.3/0.35 the photo was landing near 0.20 and read as barely-there
 * texture. Tune this pair together rather than either alone.
 */
const IMAGE_OPACITY = 0.62;
/** Darkening veil between the photo and the marble, keeping the copy legible. */
const IMAGE_SCRIM = 0.22;

// ── Water coordinate space (shared with the droplet) ─────────────────────
const VB_W = 1280;
const VB_H = 720;

// ── Swan outline sampling ────────────────────────────────────────────────

/** The swan's own viewBox, and the transform stack `Swan.tsx` applies. */
const SWAN_VB_W = 700;
const SWAN_VB_H = 480;

type Pt = readonly [number, number];
type Seg = readonly [Pt, Pt, Pt, Pt];

/**
 * Parse an absolute cubic path (`M`/`C`/`Z`) into segments.
 *
 * Deliberately tolerant: on an unrecognised command it returns what it has
 * rather than throwing, so a future regeneration of `swanPaths.ts` that
 * introduces `L`/`Q` degrades to a sparser swan instead of crashing the render.
 * It degrades SILENTLY, which is the trade — a crash would be louder but would
 * take the whole video down.
 */
function parseCubicPath(d: string): Seg[] {
  const tokens = d.match(/[MCZmcz]|-?[0-9]*\.?[0-9]+(?:e-?[0-9]+)?/g) ?? [];
  const segs: Seg[] = [];
  let cmd = "";
  let buf: number[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];

  for (const tk of tokens) {
    if (/[MCZmcz]/.test(tk)) {
      if (tk === "Z" || tk === "z") {
        // Close with a degenerate segment so the seam gets sampled too.
        segs.push([cur, cur, start, start]);
        cur = start;
      } else if (tk !== "M" && tk !== "C") {
        return segs; // unsupported command — bail with what we have
      }
      cmd = tk;
      buf = [];
      continue;
    }
    buf.push(parseFloat(tk));
    if (cmd === "M" && buf.length === 2) {
      cur = [buf[0], buf[1]];
      start = cur;
      buf = [];
      cmd = "C"; // implicit: numbers following an M repeat as the next command
    } else if (cmd === "C" && buf.length === 6) {
      const p3: Pt = [buf[4], buf[5]];
      segs.push([cur, [buf[0], buf[1]], [buf[2], buf[3]], p3]);
      cur = p3;
      buf = [];
    }
  }
  return segs;
}

/** Standard Bernstein evaluation of one cubic. */
function cubicAt(s: Seg, u: number): Pt {
  const v = 1 - u;
  const [p0, c1, c2, p3] = s;
  return [
    v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1],
  ];
}

/**
 * Arclength-uniform samples along the swan outline, already transformed into
 * the 700×480 viewBox.
 *
 * `Swan.tsx` draws the body inside `<g transform="translate(12,10) scale(0.614)">`
 * with the path itself at `translate(588,218)`, so a raw point (x,y) lands at
 * `X = 12 + 0.614*(x+588)`, `Y = 10 + 0.614*(y+218)`.
 *
 * Sanity check (verified at design time): the resulting bbox is
 * X 199.7..534.8, Y 143.9..355.8 — that Y max sits 1.2 units above the swan's
 * designed waterline of 357, which is how we know the transform is right.
 */
function sampleSwanOutline(n: number): Pt[] {
  const segs = parseCubicPath(SWAN_PM);
  if (segs.length === 0) return [];

  const lens: number[] = [];
  const offs: number[] = [];
  let total = 0;
  for (const s of segs) {
    let prev = cubicAt(s, 0);
    let len = 0;
    for (let k = 1; k <= 16; k++) {
      const cp = cubicAt(s, k / 16);
      len += Math.hypot(cp[0] - prev[0], cp[1] - prev[1]);
      prev = cp;
    }
    offs.push(total);
    lens.push(len);
    total += len;
  }
  if (total <= 0) return [];

  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const target = (total * i) / n;
    let si = segs.length - 1;
    for (let j = 0; j < segs.length; j++) {
      if (target <= offs[j] + lens[j]) {
        si = j;
        break;
      }
    }
    const u = lens[si] > 0 ? (target - offs[si]) / lens[si] : 0;
    const [x, y] = cubicAt(segs[si], Math.max(0, Math.min(1, u)));
    out.push([12 + 0.614 * (x + 588), 10 + 0.614 * (y + 218)]);
  }
  return out;
}

/**
 * 180 samples ≈ one every 18 units along a ~3312-unit outline, which keeps the
 * neck and beak — the most identity-bearing features — reading as a continuous
 * line of glitter rather than a dotted one. `StarField` runs 252 particles, so
 * this stays inside a proven bound.
 */
const PARTICLE_COUNT = 180;
const SWAN_PTS: Pt[] = sampleSwanOutline(PARTICLE_COUNT);
const SWAN_X_MIN = SWAN_PTS.length ? Math.min(...SWAN_PTS.map((q) => q[0])) : 0;
const SWAN_X_MAX = SWAN_PTS.length ? Math.max(...SWAN_PTS.map((q) => q[0])) : 1;

/** Two-arg channel PRNG: each property draws its own channel, so adding one
 *  doesn't reshuffle the others. Copied from the sakura template. */
function chanRand(seed: number, n: number): number {
  return Math.abs(Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ── Waves ────────────────────────────────────────────────────────────────

/**
 * ── The waterline, as a fraction of FRAME height ────────────────────────
 * One number, three consumers: the pond's own vertical placement, the swan's
 * anchoring, and where the drops land. They must agree or the swan floats off
 * its own reflection and the ripples appear somewhere else entirely.
 *
 * Frame-relative rather than viewBox-relative on purpose. `NeonWater` draws
 * into a 1000x1000 viewBox with the DEFAULT preserveAspectRatio, so in a 16:9
 * frame it letterboxes to a centred square — its `yPct` is a percentage of
 * that square, NOT of the frame. Keeping the source of truth in frame terms
 * and converting per consumer is what stops those two spaces being confused.
 */
const WATERLINE_FRAC_L = 0.775;
const WATERLINE_FRAC_P = 0.795;

// ── Droplet ──────────────────────────────────────────────────────────────

const FALL = 1.15;
const SPLASH = 1.45;
/** First drop waits for the quote to land, so it reads as falling FROM it. */
const DROP_T0 = 0.9;

/**
 * Several independent emitters rather than one.
 *
 * Periods are deliberately NON-COMMENSURATE (no common divisor): equal or
 * harmonically related periods would drift into lockstep and the rain would
 * pulse in unison every few seconds. These never resynchronise.
 *
 * LIFE (FALL + SPLASH = 2.6s) is under the shortest period, so one emitter
 * never has two live drops at once and the node count stays bounded.
 */
const DROP_PERIODS = [2.9, 3.7, 3.3, 4.3, 3.1] as const;
const DROP_COUNT = DROP_PERIODS.length;

/** Hollow neon teardrop: pointed apex, round belly. */
function teardropPathD(cx: number, cy: number, rx: number, ry: number): string {
  const apexY = cy - ry;
  const midY = cy + ry * 0.15;
  return [
    `M ${cx.toFixed(2)},${apexY.toFixed(2)}`,
    `Q ${(cx + rx * 1.35).toFixed(2)},${(cy - ry * 0.25).toFixed(2)} ${(cx + rx).toFixed(2)},${midY.toFixed(2)}`,
    `A ${rx.toFixed(2)},${(ry * 0.85).toFixed(2)} 0 1 1 ${(cx - rx).toFixed(2)},${midY.toFixed(2)}`,
    `Q ${(cx - rx * 1.35).toFixed(2)},${(cy - ry * 0.25).toFixed(2)} ${cx.toFixed(2)},${apexY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function dropletOutline(u: number): { rx: number; ry: number; shapeOp: number } {
  const rx = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [7, 6, 5.5, 9, 11], { extrapolateRight: "clamp" });
  const ry = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [8, 13, 15, 9, 3], { extrapolateRight: "clamp" });
  let shapeOp = 1;
  if (u <= 0) shapeOp = 0;
  else if (u < 0.08) shapeOp = interpolate(u, [0, 0.08], [0, 1]);
  else if (u > 0.96) shapeOp = interpolate(u, [0.96, 1], [1, 0]);
  return { rx, ry, shapeOp };
}

/** Keeps the base's overshoot past the surface — it sells penetration. */
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

function shockRing(p: number, maxRx: number, maxRy: number) {
  const rx = interpolate(p, [0, 1], [8, maxRx], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const ry = interpolate(p, [0, 1], [3, maxRy], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const opacity = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [0.95, 0.88, 0.62, 0.28, 0], { extrapolateRight: "clamp" });
  const sw = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [3, 2.4, 1.6, 0.8, 0.25], { extrapolateRight: "clamp" });
  return { rx, ry, opacity, sw };
}

/**
 * One emitter: a drop falling to the water, then its splash.
 *
 * `x` is re-seeded from the CYCLE INDEX, so every repetition lands somewhere
 * new across the pond rather than drilling the same spot. The impact y is
 * sampled from the live wave at that x, so each drop meets the moving crest
 * wherever it happens to fall.
 */
const Droplet: React.FC<{
  i: number;
  tSec: number;
  spawnY: number;
  /** The pond surface, in viewBox units. Flat — the pond is a still ellipse. */
  impactY: number;
  portrait: boolean;
  pal: ReturnType<typeof blackswanNeonPalette>;
}> = ({ i, tSec, spawnY, impactY, portrait, pal }) => {
  const period = DROP_PERIODS[i % DROP_PERIODS.length];
  // Fixed per-emitter phase so the five don't all start together.
  const stagger = chanRand(i, 31) * period;
  const cyc = tSec - DROP_T0 - stagger;
  if (cyc <= 0) return null;

  const local = cyc % period;
  if (local >= FALL + SPLASH) return null;
  const cycleIdx = Math.floor(cyc / period);

  // New x every cycle, but clustered toward the pond's centre — the ellipse is
  // widest there, so a drop landing at the frame edge would ripple on bare
  // black. Bias by pulling the uniform sample toward 0.5.
  const spread = portrait ? 0.34 : 0.3;
  const r = chanRand(i * 17.3 + cycleIdx * 91.7, 5);
  const x = VB_W * (0.5 + (r - 0.5) * 2 * spread);

  const fall = dropFallMotion(local, impactY - spawnY);
  const shape = dropletOutline(fall.u);
  const splashT = local - FALL;
  const seed = i * 17.3 + cycleIdx * 91.7;

  if (local < FALL) {
    const cy = spawnY + fall.y;
    return (
      <g opacity={fall.gOpacity * shape.shapeOp}>
        <line
          x1={x} y1={Math.max(spawnY, cy - 46)} x2={x} y2={cy}
          stroke={pal.core} strokeWidth={1.2} opacity={0.32}
          filter="url(#bsw-fdrop-dvv2)"
        />
        {/* Hollow — the glow is stacked strokes, never a fill. */}
        <path
          d={teardropPathD(x, cy, shape.rx * 1.5, shape.ry * 1.5)}
          fill="none" stroke={pal.core} strokeWidth={3.4}
          strokeLinejoin="round" opacity={0.55}
          filter="url(#bsw-fdrop-dvv2)"
        />
        <path
          d={teardropPathD(x, cy, shape.rx * 1.5, shape.ry * 1.5)}
          fill="none" stroke={pal.bright} strokeWidth={1.3}
          strokeLinejoin="round" opacity={0.95}
        />
      </g>
    );
  }

  return (
    <g>
      {/* Upper-half ray fan, revealed by dash offset. */}
      {splashT <= 0.3 &&
        Array.from({ length: 6 }).map((_, ri) => {
          const ang = ((-180 + ri * (180 / 5)) * Math.PI) / 180;
          const rl = 30 + (ri % 3) * 12 + chanRand(seed, ri) * 10;
          const grow = interpolate(splashT, [0, 0.3], [rl, 0], {
            easing: Easing.out(Easing.quad),
            extrapolateRight: "clamp",
          });
          return (
            <line
              key={ri}
              x1={x} y1={impactY}
              x2={x + Math.cos(ang) * rl} y2={impactY + Math.sin(ang) * rl}
              stroke={pal.core} strokeWidth={1.1} strokeLinecap="round"
              strokeDasharray={`${rl} ${rl}`} strokeDashoffset={grow}
              opacity={interpolate(splashT, [0, 0.2, 0.3], [0.75, 0.5, 0], { extrapolateRight: "clamp" })}
              filter="url(#bsw-fdrop-dvv2)"
            />
          );
        })}

      {[
        { maxRx: 84, del: 0, dur: 0.9, stroke: pal.bright },
        { maxRx: 68, del: 0.09, dur: 1.05, stroke: pal.core },
        { maxRx: 52, del: 0.18, dur: 1.2, stroke: pal.vivid },
        { maxRx: 38, del: 0.28, dur: 1.35, stroke: pal.mid },
      ].map((ring, ri) => {
        const rp = interpolate(splashT, [ring.del, ring.del + ring.dur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (rp <= 0 || rp >= 1) return null;
        const wide = ring.maxRx * (0.85 + chanRand(seed, ri + 7) * 0.3);
        const { rx, ry, opacity, sw } = shockRing(rp, wide, wide * 0.3);
        return (
          <ellipse
            key={ri} cx={x} cy={impactY} rx={rx} ry={ry}
            fill="none" stroke={ring.stroke} strokeWidth={sw}
            opacity={opacity} filter="url(#bsw-fring-dvv2)"
          />
        );
      })}
    </g>
  );
};

/**
 * The swan coming apart.
 *
 * Ordered, not random: release sweeps rear→front, and freed particles drift
 * up-left on a CURVE (the buoyancy term is separate from the radial distance).
 * Straight radial rays from one origin read as an explosion; a sequenced sweep
 * with rising, swaying motes reads as disintegration.
 */
const SwanDissolve: React.FC<{
  dz: number;
  pal: ReturnType<typeof blackswanNeonPalette>;
}> = ({ dz, pal }) => {
  if (dz <= 0) return null;
  const span = Math.max(1, SWAN_X_MAX - SWAN_X_MIN);

  return (
    <g style={{ mixBlendMode: "screen" }}>
      {SWAN_PTS.map((pt, i) => {
        const [px, py] = pt;
        const r0 = chanRand(i, 0);
        const r1 = chanRand(i, 1);
        const r2 = chanRand(i, 2);
        const r3 = chanRand(i, 3);

        // Rear-first sweep: 0 at the tail, 1 at the beak (the swan faces right).
        const rx = (px - SWAN_X_MIN) / span;
        const release = clamp01(rx * 0.55 + r0 * 0.18);
        const life = Math.max(0.18, 1 - release);
        const q = clamp01((dz - release) / life);
        if (q <= 0) {
          return null;
        }

        const opacity = interpolate(q, [0, 0.12, 0.6, 1], [0, 1, 0.65, 0], {
          extrapolateRight: "clamp",
        });
        if (opacity < 0.02) return null;

        // Up-left cluster with spread.
        const ang = Math.PI * (1.05 + r1 * 0.55);
        const ease = 1 - Math.pow(1 - q, 3);
        const dist = (26 + r2 * 54) * ease;
        // Dual-frequency sway so 180 motes don't move in lockstep.
        const sway = 5 * Math.sin(q * 6.1 + r3 * 6.28) + 2.5 * Math.sin(q * 11.3 + r1 * 6.28);
        const x = px + Math.cos(ang) * dist + sway;
        // Buoyancy is SEPARATE from `dist` so the drift curves upward.
        const y = py + Math.sin(ang) * dist - 14 * q * q;
        const size = (0.9 + r2 * 1.6) * (1 - 0.35 * q);

        return (
          <React.Fragment key={i}>
            <circle cx={x} cy={y} r={size * 2.6} fill={pal.core} opacity={opacity * 0.3} filter="url(#bsw-fpart-dvv2)" />
            <circle cx={x} cy={y} r={size} fill={pal.bright} opacity={opacity} />
          </React.Fragment>
        );
      })}
    </g>
  );
};

export const DiveInsightV2: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration = "",
    quote,
    highlightWord,
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
  const { fps, durationInFrames, height } = useVideoConfig();
  const t = frame / fps;
  const p = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const waterlineFrac = p ? WATERLINE_FRAC_P : WATERLINE_FRAC_L;

  // Same source-of-truth as the base dive_insight: quote wins, else narration.
  const insightText = quote || narration || "";

  // NOTE: Template Studio's save-to-source rewrites these by regex, matching the
  // literal token `p` with BARE INTEGER literals. Keep this exact shape.
  const quoteTarget = titleFontSize ?? (p ? 80 : 67);
  const subTarget = descriptionFontSize ?? (p ? 33 : 39);
  const quoteRef = React.useRef<HTMLDivElement>(null);
  const subRef = React.useRef<HTMLParagraphElement>(null);
  const { px: quotePx } = useFitText(
    quoteRef,
    quoteTarget,
    titleFontSizeIsUserSet ? quoteTarget : Math.max(15, Math.round(quoteTarget * 0.34)),
    [insightText, quoteTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.3 : 0.26)),
  );
  const { px: subPx } = useFitText(
    subRef,
    subTarget,
    descriptionFontSizeIsUserSet ? subTarget : Math.max(10, Math.round(subTarget * 0.38)),
    [title, insightText, subTarget, descriptionFontSizeIsUserSet, quotePx, p, height],
    Math.round(height * 0.1),
  );

  // ── Dissolve window ───────────────────────────────────────────────────
  // `BlackswanVideo` reserves the last 15 frames of every non-final scene for
  // the outgoing transition, so the glitter must be gone before then. The floor
  // on the start matters: without it a short scene computes a negative start
  // and the swan dissolves before it has finished drawing on (Swan's own
  // draw-on runs 2.9s).
  const TRANSITION_RESERVE = 15;
  const dissolveEnd = Math.max(1, durationInFrames - TRANSITION_RESERVE - 4);
  const dissolveStartRaw = Math.max(Math.round(fps * 2.2), dissolveEnd - Math.round(fps * 1.6));
  // interpolate() throws on a non-ascending range, which a pathologically short
  // scene would otherwise produce.
  const dissolveStart = Math.min(dissolveStartRaw, dissolveEnd - 1);
  const dz = interpolate(frame, [dissolveStart, dissolveEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Entrances ─────────────────────────────────────────────────────────
  const waterOp = interpolate(t, [0, 0.8], [0, 1], { extrapolateRight: "clamp" });
  // The image leads everything — it is the ground the rest is built on.
  const imgOp = interpolate(t, [0, 0.9], [0, 1], { extrapolateRight: "clamp" });
  const eyeOp = interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  const quoteOp = interpolate(t, [0.25, 1.0], [0, 1], { extrapolateRight: "clamp" });
  const quoteY = interpolate(t, [0.25, 1.0], [14, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const subOp = interpolate(t, [0.8, 1.4], [0, 1], { extrapolateRight: "clamp" });
  const swanIn = interpolate(t, [0.6, 1.5], [0, 1], { extrapolateRight: "clamp" });
  // The body LEADS the particles out. Matched curves would hold total light
  // constant and read as a crossfade; this hesitates at near-full brightness
  // while the first rear motes lift, then clears by 70% so the cloud is alone.
  const swanOut = interpolate(dz, [0, 0.15, 0.7], [1, 0.92, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Swan on the waterline ─────────────────────────────────────────────
  const swanSize = p ? 980 : 880;
  const swanH = (swanSize * SWAN_VB_H) / SWAN_VB_W;
  const swanW = swanSize;
  const waterlinePx = waterlineFrac * height;
  // A gentle idle bob. The pond is a still ellipse with no surface function to
  // sample, so this is a slow sine rather than a crest reading — but it keeps
  // the swan from looking pasted onto the water.
  const bob = Math.sin(t * 0.9) * (p ? 5 : 4);
  const swanTop = waterlinePx - swanH * (357 / SWAN_VB_H) + bob;

  // ── The drop ──────────────────────────────────────────────────────────
  // Spawn Y is derived from the RULE's position, not the quote's: the quote is
  // fitted and can shrink to a third of its target, so its rendered bottom
  // moves — the rule does not.
  const ruleTopFrac = p ? 0.46 : 0.44;
  const spawnY = ruleTopFrac * VB_H + 16;
  /** Drops land on the pond surface, in the droplet svg's 1280x720 space. */
  const pondSurfaceY = waterlineFrac * VB_H;
  // Fade the whole droplet group out before the dissolve — a drop landing
  // mid-dissolve fights the moment, and a hard cut mid-ripple is visible.
  const dropFade = interpolate(frame, [dissolveStart - Math.round(fps * 0.4), dissolveStart], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Split on the highlight word, same marker-pair approach as the base.
  const highlighted =
    highlightWord && insightText.includes(highlightWord)
      ? insightText.replace(highlightWord, `__S__${highlightWord}__E__`)
      : insightText;
  const pieces = highlighted.split(/(__S__|__E__)/);
  let hl = false;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* ── Scene photo / clip, furthest back ───────────────────────────────
          The marble goes OVER this, so the swirls read as lying on the image
          rather than behind it. A scrim in `bgColor` sits between the two to
          keep the photo from competing with the copy. */}
      {(imageUrl || videoUrl) && (
        <div style={{ position: "absolute", inset: 0, opacity: imgOp * IMAGE_OPACITY, overflow: "hidden", zIndex: 0 }}>
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
            <ZoomCropImg
              src={imageUrl!}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              alt=""
            />
          )}
          <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: IMAGE_SCRIM }} />
        </div>
      )}

      {/* Marbled ground, over the image. Its `uid` MUST differ from every other
          scene's — SVG ids are document-global and all scenes mount into one
          AbsoluteFill, so a shared uid would silently make two scenes resolve
          to the same filter. */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <MarbleField
          tSec={t}
          portrait={p}
          accentColor={accentColor}
          bgColor={bgColor}
          opacity={MARBLE_OPACITY}
          uid="dvv2"
          // Only skip the marble's own opaque ground when there IS an image
          // beneath it to protect; on a bare scene the ground is what stops the
          // swirls floating on flat black.
          hideGround={!!(imageUrl || videoUrl)}
        />
      </div>

      <div style={{ position: "absolute", inset: 0 }}>
        <StarField accentColor={accentColor} />
      </div>

      {/* ── The pond ───────────────────────────────────────────────────────
          Concentric perspective rings, as the base `dive_insight` draws them,
          rather than a sine-wave band.

          `NeonWater` uses a 1000x1000 viewBox with the DEFAULT
          preserveAspectRatio, so it letterboxes to a centred square and `yPct`
          is a percent of THAT square, not of the frame. Converting from the
          shared frame-relative waterline is what keeps the pond, the swan and
          the drops on one surface. */}
      <div style={{ position: "absolute", inset: 0, opacity: waterOp * 0.9, zIndex: 1 }}>
        <NeonWater
          uid="dvv2-pond"
          cx={500}
          yPct={waterlineFrac * 100}
          rxBase={220}
          ryBase={28}
          maxRx={520}
          nRings={6}
          delay={0.05}
          hideBg
          fadeEdges
          accentColor={accentColor}
        />
      </div>

      {/* ── Swan ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: swanTop,
          transform: "translateX(-50%)",
          opacity: swanIn * swanOut,
          zIndex: 2,
        }}
      >
        <Swan size={swanSize} water={false} reflection={false} uid="dvv2-swan" accentColor={accentColor} />
      </div>

      {/* ── Drop and splash ─────────────────────────────────────────────
          Its OWN svg, not the water's: it lands in front of the swan so it must
          paint over it, and the band mask would fade its rings near the top. */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: dropFade, zIndex: 3 }}
        aria-hidden
      >
        <defs>
          <filter id="bsw-fdrop-dvv2" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bsw-fring-dvv2" x="-140%" y="-140%" width="380%" height="380%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
          </filter>
        </defs>

        {Array.from({ length: DROP_COUNT }).map((_, i) => (
          <Droplet
            key={i}
            i={i}
            tSec={t}
            spawnY={spawnY}
            impactY={pondSurfaceY}
            portrait={p}
            pal={pal}
          />
        ))}
      </svg>

      {/* ── The dissolving swan ─────────────────────────────────────────
          A SIBLING of the Swan, never a child: `bswan-cp-{uid}` is a 700x480
          clipPath and these drift ~80 units outward, so nesting them would
          guillotine the cloud — worst at the neck, where up-drift exits at
          once. Same viewBox and box geometry as the swan, so the sampled
          points need no conversion. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: swanTop,
          width: swanW,
          height: swanH,
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        <svg
          viewBox={`0 0 ${SWAN_VB_W} ${SWAN_VB_H}`}
          style={{ width: "100%", height: "100%", overflow: "visible" }}
          aria-hidden
        >
          <defs>
            <filter id="bsw-fpart-dvv2" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" />
            </filter>
          </defs>
          <SwanDissolve dz={dz} pal={pal} />
        </svg>
      </div>

      {/* ── Copy ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          top: p ? "15%" : "12%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: p ? 14 : 16,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontFamily: fontFamily ?? mono,
            fontSize: p ? 18 : 16,
            letterSpacing: 6,
            color: pal.mid,
            textTransform: "uppercase",
            fontWeight: 400,
            opacity: eyeOp,
          }}
        >
          Insight
        </div>

        <div
          ref={quoteRef}
          style={{
            width: "100%",
            maxWidth: "100%",
            fontFamily: fontFamily ?? display,
            fontSize: quotePx,
            fontWeight: 400,
            color: textColor,
            letterSpacing: "0.04em",
            lineHeight: 1.3,
            textAlign: "center",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            opacity: quoteOp,
            transform: `translateY(${quoteY}px)`,
          }}
        >
          {pieces.map((piece, i) => {
            if (piece === "__S__") {
              hl = true;
              return null;
            }
            if (piece === "__E__") {
              hl = false;
              return null;
            }
            if (!piece) return null;
            return (
              <span
                key={i}
                style={
                  hl
                    ? { fontSize: "inherit", ...neonTitleTubeStyle(accentColor, { bgColor }) }
                    : { fontSize: "inherit", color: "inherit" }
                }
              >
                {piece}
              </span>
            );
          })}
        </div>

        <div
          style={{
            height: 2,
            width: p ? 160 : 200,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
            opacity: subOp,
            flexShrink: 0,
          }}
        />

        {title && title !== insightText && (
          <p
            ref={subRef}
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: subPx,
              color: accentColor,
              fontWeight: 400,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.5,
              opacity: 0.75 * subOp,
            }}
          >
            {title}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
