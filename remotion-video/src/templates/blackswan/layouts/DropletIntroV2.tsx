import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette } from "./blackswanAccent";

/**
 * droplet_intro__v2 — "Open Water".
 *
 * Opening-scene variant of `droplet_intro`. Same props, different composition.
 *
 * Where the base shows a droplet falling into a flat elliptical ripple pond
 * with the copy stacked at the bottom, this variant is a live water surface:
 *
 *   title (top)  →  narration under it  →  open sky  →  swan riding the water
 *
 * The copy sits together at the top, the water fills the lower part of the
 * frame, and the swan rides its surface. The water is real sine geometry with
 * visible crests and troughs, spanning the frame edge to edge.
 *
 * ── Why the water is drawn here instead of with `NeonWater` ──────────────
 * `NeonWater` draws flat `<ellipse>` rings — a pond seen in perspective. It has
 * no sine math and cannot produce crests or troughs at any prop combination.
 * Its viewBox is also 1000×1000 with the default `preserveAspectRatio`, so in
 * landscape it letterboxes to a centred square and its x=0 / x=1000 are NOT the
 * frame edges — it physically cannot reach them. Hence local wave geometry.
 *
 * The sine builder below is copied (not imported) from `laduc/wavePaths.ts`,
 * and the droplet/splash math from the base `DropletIntro.tsx`. Copying is
 * required, not stylistic: the backend copies only `src/templates/<id>/` into
 * each per-project render workspace, so a cross-template import compiles in the
 * Player but breaks the headless render with an unresolved import. (Same reason
 * `useFitText` is duplicated per template — see its docblock.)
 *
 * Filter/uid suffix for this scene: `-div2`. SVG filter, gradient and mask IDs
 * are document-global, so everything introduced here carries that suffix or it
 * collides with another scene mounted in the same Player.
 */

const display = "'Righteous', cursive";
const mono = "'Righteous', cursive";

// ── Shared SVG coordinate space ──────────────────────────────────────────
// `preserveAspectRatio="none"` (rather than LaDuc's "slice") is deliberate: it
// guarantees x=0 and x=VB_W land exactly on the frame edges in BOTH aspect
// ratios, which is what "waves span the full width" requires. The non-uniform
// scale it introduces is harmless here because every element is either a
// horizontal sine (stretched horizontally is still a sine) or radially
// symmetric — which is also why splash sparkles are circles, not stars: a
// circle is the one glyph that survives the shear unremarkably.
const VB_W = 1280;
const VB_H = 720;

/**
 * Polyline resolution. Must stay small relative to the SHORTEST wavelength
 * below (~134px) or the sampling itself flattens the crests: at 4px that is
 * still ~33 points per period, which is imperceptibly smooth.
 */
const STEP = 4;

// ── Wave band ────────────────────────────────────────────────────────────

type BandGeom = {
  /** Top of the wave field (viewBox units). */
  top: number;
  /** Y of the primary crest line: the swan rides this, droplets impact it. */
  waterline: number;
  /** Bottom of the wave field. */
  bottom: number;
};

/**
 * The water occupies the LOWER part of the frame and runs off the bottom edge:
 * all the copy lives up top, so the waves have the whole lower half to fill.
 * The waterline sits high enough that the deeper strands still have room to
 * swell beneath it before they run out of frame.
 */
function bandGeom(portrait: boolean): BandGeom {
  if (portrait) {
    return { top: 0.66 * VB_H, waterline: 0.72 * VB_H, bottom: VB_H };
  }
  return { top: 0.64 * VB_H, waterline: 0.70 * VB_H, bottom: VB_H };
}

type WaveStrand = {
  /** Vertical offset from the waterline, in viewBox units. */
  yOff: number;
  /** Peak-to-trough amplitude. Large enough that crests actually read. */
  amp: number;
  /** Horizontal wavelength. Short = choppier. */
  lambda: number;
  /** Phase offset so adjacent strands don't crest together. */
  phase0: number;
  /** Horizontal drift, px/sec. Negative drifts leftward. */
  drift: number;
  /** Slow vertical breathe period, seconds. */
  wobblePeriodSec: number;
  /** Breathe displacement, px. */
  wobbleAmp: number;
  /** Stroke width. */
  sw: number;
  /** Base opacity. */
  op: number;
  /** Key into the neon palette. */
  tone: "core" | "bright" | "vivid" | "mid" | "waterLo" | "deep";
};

/**
 * Seven strands, not the 28 of the LaDuc curtain: this is a bounded band, and
 * each strand costs two filtered passes. Amplitude grows toward the front
 * (larger yOff) so the field reads with depth; two strands drift against the
 * rest so the water doesn't look like one sheet sliding sideways.
 *
 * Wavelength has to stay in a band. Too LONG (near the frame width) and a
 * low-amplitude strand reads as a straight horizontal rule lying across the
 * water instead of a wave. Too SHORT and the field turns into busy ripple
 * noise. These sit around 3–6 periods across the 1280-wide frame.
 *
 * Drift is deliberately fast relative to the wavelength: long, quick swells
 * read as open water, where short slow ones read as a pond.
 */
const WAVE_STRANDS: WaveStrand[] = [
  { yOff: -12, amp: 13, lambda: 460, phase0: 0.00, drift:  30, wobblePeriodSec: 26, wobbleAmp: 3, sw: 1.5, op: 0.85, tone: "bright" },
  { yOff:   0, amp: 16, lambda: 410, phase0: 1.30, drift:  38, wobblePeriodSec: 31, wobbleAmp: 4, sw: 1.9, op: 0.80, tone: "core"   },
  { yOff:  22, amp: 18, lambda: 360, phase0: 2.70, drift: -33, wobblePeriodSec: 35, wobbleAmp: 4, sw: 1.5, op: 0.60, tone: "vivid"  },
  { yOff:  48, amp: 21, lambda: 320, phase0: 0.80, drift:  46, wobblePeriodSec: 39, wobbleAmp: 5, sw: 1.3, op: 0.45, tone: "mid"    },
  { yOff:  80, amp: 24, lambda: 285, phase0: 3.40, drift: -42, wobblePeriodSec: 44, wobbleAmp: 6, sw: 1.1, op: 0.34, tone: "mid"    },
  { yOff: 116, amp: 26, lambda: 250, phase0: 1.90, drift:  54, wobblePeriodSec: 49, wobbleAmp: 7, sw: 0.9, op: 0.25, tone: "waterLo"},
  { yOff: 150, amp: 28, lambda: 220, phase0: 4.60, drift:  62, wobblePeriodSec: 54, wobbleAmp: 8, sw: 0.8, op: 0.18, tone: "deep"   },
];

/**
 * Portrait runs at 0.75× the landscape wave frequency.
 *
 * A 9:16 frame is far narrower, so the same wavelength packs visibly more
 * crests across it and the water reads as choppy noise. Frequency is the
 * INVERSE of wavelength, so a 0.75 frequency scale means dividing lambda by
 * 0.75 — i.e. stretching each wave out by a third.
 */
const PORTRAIT_FREQ_SCALE = 0.75;

/** The strand table for one aspect ratio. Landscape uses it unmodified. */
function waveStrands(portrait: boolean): WaveStrand[] {
  if (!portrait) return WAVE_STRANDS;
  return WAVE_STRANDS.map((s) => ({ ...s, lambda: s.lambda / PORTRAIT_FREQ_SCALE }));
}

/**
 * Y of one strand's surface at a given x and time.
 *
 * The droplet impact points call this too, so a drop always lands ON the moving
 * crest rather than hovering above it. Keeping the path and the impact point on
 * one expression is what stops them drifting apart.
 */
function strandSurfaceY(s: WaveStrand, tSec: number, baseY: number, x: number): number {
  const k = (2 * Math.PI) / s.lambda;
  const driftTheta = k * tSec * s.drift;
  const wobbleY = s.wobbleAmp * Math.sin((tSec / s.wobblePeriodSec) * Math.PI * 2 + s.phase0 * 0.4);
  return baseY + s.yOff + wobbleY + s.amp * Math.sin(k * x - driftTheta + s.phase0);
}

/**
 * Build one strand's `d`. Extends a half wavelength past each edge so the
 * drift never exposes a gap at the frame boundary.
 */
function buildWavePathD(s: WaveStrand, tSec: number, baseY: number): string {
  const margin = s.lambda * 0.5;
  const parts: string[] = [];
  for (let x = -margin; x <= VB_W + margin; x += STEP) {
    const y = strandSurfaceY(s, tSec, baseY, x);
    parts.push(`${parts.length === 0 ? "M" : "L"} ${x.toFixed(0)},${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

export const DropletIntroV2: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#FFFFFF",
    titleFontSize,
    descriptionFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;
  const portrait = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const band = useMemo(() => bandGeom(portrait), [portrait]);
  const strands = useMemo(() => waveStrands(portrait), [portrait]);

  // Same size targets as the base droplet_intro, so switching variants doesn't
  // jump the type size — but tighter height budgets, since the pond now claims
  // the middle third of the frame.
  // `p` aliases `portrait` purely for the two font-size fallbacks below.
  // Template Studio's save-to-source rewrites typography defaults by regex and
  // matches the literal token `p` in `<key> ?? (p ? N : N)` — a ternary written
  // on `portrait` is not recognised and the save fails with "No matching
  // font-size defaults found". Keep these two expressions in this exact shape.
  const p = portrait;
  const titleTarget = titleFontSize ?? (p ? 84 : 71);
  const descTarget = descriptionFontSize ?? (p ? 43 : 42);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.max(16, Math.round(titleTarget * 0.34)),
    [title, titleTarget, titleFontSizeIsUserSet, portrait, height],
    Math.round(height * (portrait ? 0.15 : 0.16)),
  );
  const { px: descPx } = useFitText(
    descRef,
    descTarget,
    descriptionFontSizeIsUserSet ? descTarget : Math.max(10, Math.round(descTarget * 0.38)),
    [narration, descTarget, descriptionFontSizeIsUserSet, titlePx, portrait, height],
    Math.round(height * (portrait ? 0.15 : 0.16)),
  );

  // ── Entrance ──────────────────────────────────────────────────────────
  const waveOp = interpolate(t, [0, 0.8], [0, 1], { extrapolateRight: "clamp" });
  const swanOp = interpolate(t, [0.5, 1.4], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(t, [0.15, 0.9], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(t, [0.15, 0.9], [16, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const bodyOp = interpolate(t, [0.5, 1.2], [0, 1], { extrapolateRight: "clamp" });

  // ── Swan, anchored to the waterline ───────────────────────────────────
  // Swan draws in a 700×480 viewBox whose own designed waterline sits at y=357
  // (the horizon rules it draws when `water` is on). Aligning that fraction to
  // the pond's waterline is what puts the bird ON the water rather than beside
  // it. `water={false}` as everywhere else — the pond supplies the water.
  const swanSize = portrait ? 1150 : 980;
  const swanH = (swanSize * 480) / 700;
  const waterlinePx = (band.waterline / VB_H) * height;
  // Ride the swell: sample the crest the swan sits on, at frame centre.
  const bob = ((strandSurfaceY(strands[1], t, band.waterline, VB_W / 2) - band.waterline) / VB_H) * height * 0.5;
  const swanTop = waterlinePx - swanH * (357 / 480) + bob;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <StarField accentColor={accentColor} />
      </div>

      {/* ── Water ───────────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: waveOp }}
        aria-hidden
      >
        <defs>
          {/* Wide blurred pass. Filter region is wide but SHORT — these paths
              span the frame horizontally yet occupy a thin band, so a tall
              region would just cost fill rate for nothing. */}
          <filter id="bsw-wglow-div2" x="-3%" y="-60%" width="106%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
          </filter>
          {/* Crisp pass: soft bloom merged back over the source. */}
          <filter id="bsw-wcrisp-div2" x="-3%" y="-60%" width="106%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="soft" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Vertical fade so the band dissolves into the dark instead of
              ending on a hard horizontal cut. */}
          <linearGradient id="bsw-bandgrad-div2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="12%" stopColor="white" stopOpacity="0.85" />
            <stop offset="55%" stopColor="white" stopOpacity="1" />
            <stop offset="88%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0.08" />
          </linearGradient>
          <mask id="bsw-bandmask-div2">
            <rect
              x={0} y={band.top} width={VB_W} height={band.bottom - band.top}
              fill="url(#bsw-bandgrad-div2)"
            />
          </mask>
        </defs>

        <g mask="url(#bsw-bandmask-div2)">
          {strands.map((s, i) => {
            const d = buildWavePathD(s, t, band.waterline);
            const stroke = pal[s.tone];
            return (
              <React.Fragment key={i}>
                <path
                  d={d} fill="none" stroke={stroke} strokeWidth={s.sw * 3}
                  strokeLinecap="round" opacity={s.op * 0.28}
                  filter="url(#bsw-wglow-div2)"
                />
                <path
                  d={d} fill="none" stroke={stroke} strokeWidth={s.sw}
                  strokeLinecap="round" opacity={s.op}
                  filter="url(#bsw-wcrisp-div2)"
                />
              </React.Fragment>
            );
          })}
        </g>
      </svg>

      {/* ── Swan, riding the waterline ──────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: swanTop,
          transform: "translateX(-50%)",
          opacity: swanOp,
        }}
      >
        {/* `trimBaseRules`: this scene puts the swan on a live water surface,
            where the two flat rules along the base of the traced outline read
            as stray lines lying under the bird. Scoped to this layout — every
            other blackswan scene keeps the shape it has always drawn. */}
        <Swan size={swanSize} water={false} reflection={false} trimBaseRules uid="div2-swan" accentColor={accentColor} />
      </div>

      {/* ── Copy: title and narration together at the top ───────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "center",
          // Portrait drops the copy lower: a 9:16 frame has far more headroom
          // above the water, so top-flush type floats awkwardly high.
          padding: portrait ? "132px 40px 64px" : "48px 80px 56px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: portrait ? 8 : 12,
            width: "100%",
            flexShrink: 0,
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {/* Width-constrained so long titles wrap instead of running past the
              frame edges — the fitter only measures height. */}
          <div
            ref={titleRef}
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: "100%" }}
          >
            <span
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: titlePx,
                fontWeight: 400,
                ...neonTitleTubeStyle(accentColor, { bgColor }),
                letterSpacing: "0.12em",
                textTransform: "capitalize",
                lineHeight: 1.2,
                textAlign: "center",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {title}
            </span>
          </div>
          <div style={{ height: 3, width: portrait ? 300 : 380, background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            flexShrink: 0,
            // Portrait needs a wider gap under the title: the type is larger
            // relative to the narrow frame, so the landscape spacing reads as
            // cramped against the rule above it.
            marginTop: portrait ? 54 : 18,
            opacity: bodyOp,
          }}
        >
          {narration && (
            <div
              ref={descRef}
              style={{
                maxWidth: portrait ? "100%" : "76%",
                fontSize: descPx,
                color: textColor,
                fontFamily: fontFamily ?? display,
                fontWeight: 400,
                letterSpacing: "0.06em",
                lineHeight: 1.5,
                textAlign: "center",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {narration}
            </div>
          )}
          <div
            style={{
              marginTop: 15,
              color: accentColor,
              fontFamily: fontFamily ?? mono,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: 8,
              opacity: 0.5,
              textTransform: "uppercase",
            }}
          >
            BLACKSWAN
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
