import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette, rgbaFromHex } from "./blackswanAccent";

/**
 * neon_narrative__v2 — "Marbled Water".
 *
 * Mid-scene variant of `neon_narrative`. Same props, different composition.
 *
 * Where the base puts the copy in a LEFT column with one swan and an elliptical
 * pond on the RIGHT, this variant is symmetric and stacked:
 *
 *   two swans facing each other (top)  →  eyebrow  →  title  →  narration
 *
 * behind a flowing liquid-marble field: dark neon swirls, like an oil slick.
 *
 * ── How the marble is made ──────────────────────────────────────────────
 * There is no noise implementation anywhere in this repo — no simplex, perlin
 * or fbm, only sine-hash PRNGs with no spatial coherence, which cannot produce
 * a flow field. So the marble is not noise-generated. It is dense parallel sine
 * strands pushed through ONE large-scale turbulence displacement, which is
 * essentially how marbled contour art is actually made: regular bands + a
 * violent warp = folded, organic lobes.
 *
 * `baseFrequency` is STATIC across frames — only the strands' `tSec` advances.
 * Animating a filter primitive per frame is avoided repo-wide for render cost,
 * and every turbulence filter here carries that note.
 *
 * ── Why this code is copied rather than imported ────────────────────────
 * The sine-strand builder is copied from `laduc/wavePaths.ts` and the
 * displacement filter from `sakura/sakuraTransitions.tsx`. Copying is REQUIRED,
 * not stylistic: the backend copies only `src/templates/<id>/` into each
 * per-project render workspace, so a cross-template import compiles fine in the
 * Player and then breaks the headless render with an unresolved import. (Same
 * reason `useFitText` is duplicated per template — see its docblock.)
 *
 * Filter/uid suffix for this scene: `-nnv2`. SVG filter, gradient and mask IDs
 * are document-global — every scene mounts into one AbsoluteFill — so anything
 * introduced here carries that suffix or it collides with another scene.
 */

const display = "'Righteous', cursive";
const mono = "'Righteous', cursive";

/**
 * ── The ONE marble tuning knob ──────────────────────────────────────────
 * Applied once, on the marble svg's root. Everything beneath it is authored at
 * full strength so this stays a clean single multiplier.
 *
 * Deliberately low: the marble sits behind the scene photo, the star field, two
 * swans AND the copy, and at higher values it stops being a texture and starts
 * competing. Raise toward 0.5+ to make it a dominant background.
 */
const MARBLE_OPACITY = 0.4;

// Marble coordinate space. `preserveAspectRatio="none"` guarantees x=0 and
// x=VB_W land exactly on the frame edges in BOTH aspect ratios — a horizontally
// stretched sine is still a sine, so the non-uniform scale costs nothing here.
// In portrait the ~2.4x vertical stretch is a bonus: taller, lazier folds.
const VB_W = 1280;
const VB_H = 720;

/** Polyline resolution for the strands. */
const STEP = 5;

/**
 * Portrait stretches each wavelength out by a third. A 9:16 frame is far
 * narrower, so the same lambda packs visibly more crests across it and the
 * field reads as busy noise rather than slow marble.
 */
const PORTRAIT_FREQ_SCALE = 0.75;

type MarbleStrand = {
  /** Vertical anchor, fraction of the canvas. */
  yFrac: number;
  /** Peak-to-trough amplitude, px. */
  amp: number;
  /** Wavelength, px. Shorter than open-water waves: folds need periods to fold. */
  lambda: number;
  /** Phase offset so neighbours don't crest together. */
  phase0: number;
  /** Horizontal drift, px/sec. */
  drift: number;
  /** Slow vertical breathe period, seconds. */
  wobblePeriodSec: number;
  /** Breathe displacement, px. */
  wobbleAmp: number;
  /** Stroke width. */
  sw: number;
  /** Base opacity. */
  op: number;
  /** Key into the neon palette — front strands brightest. */
  tone: "bright" | "core" | "vivid" | "mid" | "waterLo" | "deep";
};

/**
 * 14 strands spanning the WHOLE canvas (yFrac 0.03 → 0.97).
 *
 * The source table this is adapted from hugs the lower canvas as a "wave
 * curtain"; a marble field has to cover the frame, so the anchors are spread
 * top to bottom. Wavelengths are short relative to that source — long silk
 * wavelengths read as *waves*, and the displacement below needs closely-spaced
 * structure to fold into lobes.
 *
 * ── Why every strand carries near-identical amp / op / sw ───────────────
 * An earlier version ramped amplitude and opacity toward the middle (op 0.18 →
 * 0.72 → 0.18) to give the field depth. It worked, but it made the marble
 * visibly DENSE through the centre band and sparse at the top and bottom
 * edges — the density was a function of where you looked. Holding these three
 * flat is what gives the frame an even weight corner to corner.
 *
 * Depth now comes only from `tone` and from the phase/drift spread, neither of
 * which biases density toward any region.
 *
 * Strand COUNT is the density knob: 14 evenly-spaced strands rather than 22.
 * `MARBLE_OPACITY` scales the whole field on top of this.
 */
const MARBLE_STRANDS: MarbleStrand[] = [
  { yFrac: 0.03, amp: 30, lambda: 430, phase0: 0.00, drift:  16, wobblePeriodSec: 28, wobbleAmp: 7, sw: 1.4, op: 0.42, tone: "deep"    },
  { yFrac: 0.10, amp: 32, lambda: 470, phase0: 1.40, drift: -19, wobblePeriodSec: 34, wobbleAmp: 8, sw: 1.4, op: 0.44, tone: "waterLo" },
  { yFrac: 0.17, amp: 29, lambda: 405, phase0: 2.70, drift:  22, wobblePeriodSec: 40, wobbleAmp: 7, sw: 1.5, op: 0.46, tone: "mid"     },
  { yFrac: 0.24, amp: 33, lambda: 455, phase0: 0.60, drift: -17, wobblePeriodSec: 46, wobbleAmp: 8, sw: 1.4, op: 0.43, tone: "vivid"   },
  { yFrac: 0.31, amp: 30, lambda: 420, phase0: 3.90, drift:  24, wobblePeriodSec: 52, wobbleAmp: 7, sw: 1.5, op: 0.47, tone: "core"    },
  { yFrac: 0.38, amp: 34, lambda: 480, phase0: 1.10, drift: -21, wobblePeriodSec: 58, wobbleAmp: 8, sw: 1.4, op: 0.44, tone: "mid"     },
  { yFrac: 0.45, amp: 31, lambda: 415, phase0: 2.30, drift:  18, wobblePeriodSec: 64, wobbleAmp: 7, sw: 1.5, op: 0.46, tone: "bright"  },
  { yFrac: 0.52, amp: 33, lambda: 465, phase0: 4.60, drift: -25, wobblePeriodSec: 70, wobbleAmp: 8, sw: 1.4, op: 0.43, tone: "core"    },
  { yFrac: 0.59, amp: 30, lambda: 425, phase0: 0.80, drift:  20, wobblePeriodSec: 76, wobbleAmp: 7, sw: 1.5, op: 0.47, tone: "vivid"   },
  { yFrac: 0.66, amp: 34, lambda: 475, phase0: 3.20, drift: -23, wobblePeriodSec: 82, wobbleAmp: 8, sw: 1.4, op: 0.44, tone: "mid"     },
  { yFrac: 0.73, amp: 31, lambda: 410, phase0: 1.70, drift:  26, wobblePeriodSec: 88, wobbleAmp: 7, sw: 1.5, op: 0.46, tone: "core"    },
  { yFrac: 0.80, amp: 33, lambda: 460, phase0: 4.10, drift: -18, wobblePeriodSec: 94, wobbleAmp: 8, sw: 1.4, op: 0.43, tone: "waterLo" },
  { yFrac: 0.88, amp: 30, lambda: 435, phase0: 2.50, drift:  22, wobblePeriodSec: 99, wobbleAmp: 7, sw: 1.5, op: 0.45, tone: "vivid"   },
  { yFrac: 0.97, amp: 32, lambda: 445, phase0: 0.30, drift: -20, wobblePeriodSec: 104, wobbleAmp: 8, sw: 1.4, op: 0.42, tone: "deep"    },
];

/**
 * Build one strand's `d`.
 *
 * Extends a half wavelength past each edge so the drift never exposes a gap —
 * and, here, so the displacement below has geometry to pull IN from off-frame
 * rather than leaving bare corners.
 */
function buildStrandPathD(s: MarbleStrand, tSec: number, lambdaScale: number): string {
  const lambda = s.lambda / lambdaScale;
  const k = (2 * Math.PI) / lambda;
  const driftTheta = k * tSec * s.drift;
  const wobbleY = s.wobbleAmp * Math.sin((tSec / s.wobblePeriodSec) * Math.PI * 2 + s.phase0 * 0.4);
  const baseY = s.yFrac * VB_H + wobbleY;
  const margin = lambda * 0.5;

  const parts: string[] = [];
  for (let x = -margin; x <= VB_W + margin; x += STEP) {
    const y = baseY + s.amp * Math.sin(k * x - driftTheta + s.phase0);
    parts.push(`${parts.length === 0 ? "M" : "L"} ${x.toFixed(0)},${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

/**
 * The marble field.
 *
 * The displacement filter is applied to ONE `<g>` wrapping every strand, not
 * per-path: that is one filter region and one displacement evaluation per
 * frame instead of 22, which is the difference between this being affordable
 * and not.
 */
export const MarbleField: React.FC<{
  tSec: number;
  portrait: boolean;
  accentColor: string;
  bgColor: string;
  opacity: number;
  /**
   * Namespaces this instance's filter ids. REQUIRED to differ per scene: SVG
   * ids are document-global and every blackswan scene mounts into one
   * AbsoluteFill, so two MarbleFields sharing a uid would both resolve
   * `url(#marble-warp-…)` to whichever `<defs>` came first in the document —
   * silently sharing one filter rather than erroring.
   */
  uid: string;
  /**
   * Skip the opaque dark ground beneath the swirls.
   *
   * That ground ends at a SOLID `bgColor`, so anything rendered below the
   * marble (a scene photo, say) would be completely hidden by it. Set this when
   * the marble is layered OVER other artwork rather than sitting on bare black.
   */
  hideGround?: boolean;
}> = ({ tSec, portrait, accentColor, bgColor, opacity, uid, hideGround = false }) => {
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const lambdaScale = portrait ? PORTRAIT_FREQ_SCALE : 1;
  const warpId = `marble-warp-${uid}`;
  const glowId = `marble-glow-${uid}`;

  return (
    <>
      {/* Dark ground with a faint accent bloom, so the swirls sit in something
          rather than floating on flat black. Skipped when the marble is layered
          over other artwork — this ends at an opaque bgColor and would hide it. */}
      {!hideGround && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 42%, ${rgbaFromHex(accentColor, 0.1)} 0%, ${bgColor} 68%)`,
          }}
        />
      )}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}
        aria-hidden
      >
        <defs>
          {/* STATIC turbulence — no animated baseFrequency. The region is
              generously oversized because a scale-170 displacement pulls
              geometry in from well outside the nominal box; a tight region
              would clip the warp at the frame edges. */}
          <filter id={warpId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={7} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={210} />
          </filter>
          <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={7} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={210} result="warped" />
            <feGaussianBlur in="warped" stdDeviation={9} />
          </filter>
        </defs>

        {/* Bloom pass, then the crisp pass over it — the two together are what
            read as "glowing liquid" rather than as line art. */}
        <g filter={`url(#${glowId})`}>
          {MARBLE_STRANDS.map((s, i) => (
            <path
              key={i}
              d={buildStrandPathD(s, tSec, lambdaScale)}
              fill="none"
              stroke={pal[s.tone]}
              strokeWidth={s.sw * 2.6}
              strokeLinecap="round"
              opacity={s.op * 0.5}
            />
          ))}
        </g>
        <g filter={`url(#${warpId})`}>
          {MARBLE_STRANDS.map((s, i) => (
            <path
              key={i}
              d={buildStrandPathD(s, tSec, lambdaScale)}
              fill="none"
              stroke={pal[s.tone]}
              strokeWidth={s.sw}
              strokeLinecap="round"
              opacity={s.op}
            />
          ))}
        </g>
      </svg>
    </>
  );
};

/** Split narration on newlines so breaks stay visible (plain <p> collapses \n). */
function narrationBlocks(text: string): string[] {
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

export const NeonNarrativeV2: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration = "",
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
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
  const p = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  // Same size targets as the base neon_narrative.
  //
  // NOTE: Template Studio's save-to-source rewrites these two lines by regex and
  // matches the literal token `p` with bare integer literals. Keep this exact
  // shape — no `portrait ? …`, no arithmetic inside the ternary — or saving
  // typography from the editor fails with "No matching font-size defaults".
  const titleTarget = titleFontSize ?? (p ? 102 : 93);
  const descTarget = descriptionFontSize ?? (p ? 55 : 50);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  // Budgets are tighter than the base's (0.18/0.24 and 0.30/0.42): the swan
  // pair now claims the top of the frame, so there is genuinely less room and
  // over-promising it would let long copy run into them.
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.max(15, Math.round(titleTarget * 0.34)),
    [title, titleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.14 : 0.17)),
  );
  const { px: descPx } = useFitText(
    descRef,
    descTarget,
    descriptionFontSizeIsUserSet ? descTarget : Math.max(10, Math.round(descTarget * 0.38)),
    [narration, descTarget, descriptionFontSizeIsUserSet, titlePx, p, height],
    Math.round(height * (p ? 0.26 : 0.3)),
  );

  const marbleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const eyebrowOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [10, 35], [14, 0], { extrapolateRight: "clamp" });
  const bodyOp = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const bodyY = interpolate(frame, [25, 50], [14, 0], { extrapolateRight: "clamp" });

  const blocks = narrationBlocks(narration);


  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* ── Marble, furthest back ───────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, opacity: marbleOp }}>
        <MarbleField
          tSec={t}
          portrait={p}
          accentColor={accentColor}
          bgColor={bgColor}
          opacity={MARBLE_OPACITY}
          uid="nnv2"
        />
      </div>

      {/* No scene photo/clip: `neon_narrative__v2` is listed in this template's
          `layouts_without_image` (backend/templates/blackswan/meta.json), so the
          pipeline never assigns one. The marble below is the whole background. */}

      <div style={{ position: "absolute", inset: 0 }}>
        <StarField accentColor={accentColor} />
      </div>

      {/* ── Copy, centred in the frame ──────────────────────────────────────
          The facing swan pair that used to sit above this block is gone, and
          with it the `space-between` scaffolding that pinned the row to the top
          and the text to the bottom. A single centred child is all that is left,
          so the copy is simply centred — the same treatment in both aspect
          ratios, with the marble field carrying the frame on its own. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "72px 44px" : "48px 96px",
          pointerEvents: "none",
        }}
      >
        {/* Eyebrow + title + rule + narration travel together as ONE block, so
            the four stay grouped rather than spreading down the frame. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            flexShrink: 0,
          }}
        >
        <div
          style={{
            marginTop: p ? 28 : 22,
            fontSize: p ? 18 : 14,
            letterSpacing: 5,
            color: pal.mid,
            textTransform: "uppercase",
            fontFamily: fontFamily ?? mono,
            fontWeight: 500,
            opacity: eyebrowOp,
          }}
        >
          Insight
        </div>

        {/* Width-constrained so long titles wrap instead of running past the
            frame edges — the fitter only measures height. */}
        <h2
          ref={titleRef}
          style={{
            margin: p ? "10px 0 0" : "8px 0 0",
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
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {title}
        </h2>

        <div
          style={{
            marginTop: p ? 14 : 12,
            height: 3,
            width: p ? 260 : 340,
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
            opacity: titleOp,
          }}
        />

        {blocks.length > 0 && (
          <div
            ref={descRef}
            style={{
              marginTop: p ? 20 : 18,
              maxWidth: p ? "100%" : "72%",
              fontSize: descPx,
              color: textColor,
              fontFamily: fontFamily ?? display,
              fontWeight: 400,
              letterSpacing: "0.04em",
              lineHeight: 1.5,
              textAlign: "center",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              opacity: bodyOp,
              transform: `translateY(${bodyY}px)`,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {blocks.map((b, i) => (
              <p key={i} style={{ margin: 0, fontSize: "inherit" }}>
                {b}
              </p>
            ))}
          </div>
        )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
