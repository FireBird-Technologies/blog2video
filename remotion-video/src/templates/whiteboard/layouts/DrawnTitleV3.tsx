import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

/**
 * drawn_title__v3 — "Rope Haul".
 *
 * Variant of `drawn_title`. Same props, different composition: a stick figure
 * stands on a stool and hauls the title/narration placard in from off-frame left
 * on a rope, hand over hand. Once the placard is centred the rope goes slack and
 * the figure turns to point at it.
 *
 * ── How the rope stays attached ────────────────────────────────────────
 * The placard's copy is real HTML (`useFitText` measures DOM nodes to auto-shrink
 * the title and narration), while the figure and rope are SVG. They are kept in
 * contact by authoring the whole scene in the FIGURE's viewBox units and
 * converting to page px with one scale factor, `s`.
 *
 * The rope is not a fixed-length path that happens to line up. Both of its
 * endpoints are the SAME expressions that place the hand and the placard's
 * anchor, so it is attached by construction and cannot detach or stretch.
 *
 * The rope also never shortens — a rope that gets shorter is a rubber band.
 * Instead the slack the figure takes in is expressed as SAG: taut while hauling,
 * dipping on each recovery, and hanging loose once the placard has landed.
 *
 * The placard advances only during haul strokes, so the copy visibly moves
 * *because* the figure pulls rather than drifting on its own clock.
 *
 * Filter IDs carry a `-dtv3` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

/** Width/height of the figure track in viewBox units (spans the frame). */
const FIG_TRACK_W = 300;
const FIG_TRACK_H = 124;

/**
 * How much clear space is left to the RIGHT of the figure, as a fraction of the
 * frame width. The figure's own track x is derived from this — see `restX`.
 *
 * It cannot be a plain track fraction. Under `xMidYMax meet` the 300-unit track
 * spans only the middle ~500px of a 1280px frame, so even x=300 lands well
 * short of the frame's right edge; putting the hauler at the true right end
 * needs a track x greater than 300, which renders fine because the svg is
 * `overflow: visible`.
 */
const RIGHT_MARGIN = 0.07;

/**
 * Stool height in rig units — the rig is lifted by exactly this much. Tall
 * enough that the hauler's hands come up near the underline's height, so the
 * rope's drop to the hand is a gentle fall rather than a near-vertical plunge.
 */
const STOOL_H = 52;
/** Seat height, in track units. The rig's feet (local y=114) land here. */
const SEAT_Y = 114 - STOOL_H;

/* ── Timeline ──────────────────────────────────────────────────────────
   The figure does NOT walk in; it is already on the stool. That removes an
   entire beat and buys the budget for the pull, which matters because a scene
   can be as short as 150 frames (`FPS * 5` in WhiteboardVideo). */
/* The rope is drawn on just before the first haul. Any earlier and it is a line
   running off-frame to a placard that has not entered yet. */
const ROPE_DRAW_START = 10;
const ROPE_DRAW_END = 18;
const PULL_START = 16;
const PULL_END = 100;
/**
 * Two long strokes rather than four short ones. Fewer, longer hauls read as
 * smooth and deliberate; four in the same 84 frames made the copy advance in
 * visibly choppy steps.
 */
const STROKES = 2;
/**
 * Fraction of each stroke spent hauling; the rest is the recovery reach. Higher
 * than it would be for short strokes — most of a long stroke should be moving
 * the load, with only a brief reach-back between.
 */
const HAUL_FRAC = 0.72;
const SETTLE_END = 112;
const POINT_START = 112;
const POINT_END = 126;

/**
 * The hauling figure, standing on a stool.
 *
 * Authored in the rig's own local space and mirrored as a whole so it faces
 * LEFT (toward the placard it is pulling) — the same idiom the walking variants
 * use. Every coordinate below is therefore written for the unmirrored,
 * right-facing rig, and the flip is applied once at the top.
 */
const HaulingStickman: React.FC<{
  color: string;
  handLead: { x: number; y: number };
  handTrail: { x: number; y: number };
  tension: number;
  posed: number;
  drift: number;
  appear: number;
}> = ({ color, handLead, handTrail, tension, posed, drift, appear }) => {
  // Braced against the load: the torso leans back as the rope goes taut and
  // straightens as the figure settles into the point.
  const leanX = 52 + 4 * tension * (1 - posed);

  // Elbow as a midpoint with an outward bulge — enough articulation at stickman
  // fidelity that the arm bends like an arm, without a real IK solve.
  const elbow = (h: { x: number; y: number }) => ({
    x: (50 + h.x) / 2 + 4,
    y: (48 + h.y) / 2 - 6,
  });
  const eLead = elbow(handLead);
  const eTrail = elbow(handTrail);

  /* Posed arms: near arm to the waist, far arm out to point at the placard.
     Interpolated FROM the live pull positions, so the arms flow out of the last
     stroke rather than snapping to a new pose.

     The pointing arm is expressed as straight COORDINATES reaching up-and-out
     (which the outer mirror turns into up-and-LEFT on screen, at the placard),
     not as a rotation of the pull pose. Rotating instead would compound with
     the arm's own outward reach and fold the limb back across the body. The
     slow `drift` keeps the held point from being dead still. */
  const pointElbowX = interpolate(posed, [0, 1], [eLead.x, 72]);
  const pointElbowY = interpolate(posed, [0, 1], [eLead.y, 40]);
  const pointHandX = interpolate(posed, [0, 1], [handLead.x, 98 + drift * 0.3]);
  const pointHandY = interpolate(posed, [0, 1], [handLead.y, 26 - drift]);

  const waistElbowX = interpolate(posed, [0, 1], [eTrail.x, 30]);
  const waistElbowY = interpolate(posed, [0, 1], [eTrail.y, 62]);
  const waistHandX = interpolate(posed, [0, 1], [handTrail.x, 44]);
  const waistHandY = interpolate(posed, [0, 1], [handTrail.y, 74]);

  return (
    <g opacity={appear} transform="translate(100 0) scale(-1 1)">
      {/* Filter is kept off the node that carries the stool lift so the ink
          noise is sampled in the rig's own frame rather than crawling. */}
      <g filter="url(#inkFig-dtv3)" transform={`translate(0, ${-STOOL_H})`}>
        {/* Head */}
        <circle cx="50" cy="22" r="14" stroke={color} strokeWidth="4.5" fill="none" />
        {/* Spine — leans back against the pull */}
        <line x1="50" y1="38" x2={leanX} y2="72" stroke={color} strokeWidth="4.5" />

        {/* Trail arm (drawn behind the body) */}
        <g>
          <line x1="50" y1="48" x2={waistElbowX} y2={waistElbowY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          <line x1={waistElbowX} y1={waistElbowY} x2={waistHandX} y2={waistHandY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* Legs — planted and braced, not walking. The front leg takes the load
            and compresses slightly on each haul. */}
        <g>
          <line x1={leanX} y1="72" x2={leanX + 10} y2="92" stroke={color} strokeWidth="4.5" />
          <line
            x1={leanX + 10}
            y1="92"
            x2={leanX + 8 + 2 * tension}
            y2="114"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>
        <g>
          <line x1={leanX} y1="72" x2={leanX - 11} y2="92" stroke={color} strokeWidth="4.5" />
          <line
            x1={leanX - 11}
            y1="92"
            x2={leanX - 14 - 2 * tension}
            y2="114"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>

        {/* Lead arm (drawn in front) — this is the one the rope ties to, and
            the one that becomes the pointing arm. */}
        <g>
          <line x1="50" y1="48" x2={pointElbowX} y2={pointElbowY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          <line x1={pointElbowX} y1={pointElbowY} x2={pointHandX} y2={pointHandY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
};

/**
 * Text that reveals as if being written by hand.
 *
 * A single `clip-path` wipe across a whole paragraph slides uniformly and looks
 * like a curtain, not writing — on a multi-line block every line would appear
 * simultaneously. So the copy is rendered once per line, and each line gets its
 * own left-to-right wipe that only starts when the previous line has finished.
 *
 * Lines are split by measuring the rendered text: the invisible sizing copy
 * reports its own height and the line-height in use, which gives the line count
 * at whatever size `useFitText` settled on.
 */
const HandwrittenText: React.FC<{
  text: string;
  progress: number;
  lineCount: number;
  style: React.CSSProperties;
  inkFilter: string;
}> = ({ text, progress, lineCount, style, inkFilter }) => {
  const lines = Math.max(1, lineCount);
  return (
    <>
      {Array.from({ length: lines }, (_, i) => {
        const slice = 1 / lines;
        const local = Math.max(0, Math.min(1, (progress - i * slice) / slice));
        const eased = 1 - (1 - local) * (1 - local);
        return (
          <div
            key={i}
            aria-hidden={i > 0}
            style={{
              ...style,
              position: "absolute",
              inset: 0,
              clipPath: `inset(${(i * 100) / lines}% ${100 - eased * 100}% ${
                ((lines - i - 1) * 100) / lines
              }% 0)`,
              filter: inkFilter,
            }}
          >
            {text}
          </div>
        );
      })}
    </>
  );
};

export const DrawnTitleV3: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const { height, width } = useVideoConfig();

  /* ── Rig-unit → page-px scale ─────────────────────────────────────────
     The figure svg spans the full frame on a 300×124 viewBox under
     `xMidYMax meet`, so its scale is min(boxW/300, boxH/124) px per rig unit.
     The whole choreography is authored in rig units; this carries it over to
     the DOM copy. */
  const figBoxH = height * (p ? 0.223 : 0.287);
  const s = Math.min(width / FIG_TRACK_W, figBoxH / FIG_TRACK_H);
  const trackOriginX = (width - FIG_TRACK_W * s) / 2;

  /* The hauler's position, solved so its right side clears the frame edge by
     RIGHT_MARGIN. Commonly lands beyond x=300 in landscape — see the note on
     RIGHT_MARGIN. */
  const restX = (width * (1 - RIGHT_MARGIN) - trackOriginX) / s - 22;

  /* ── Pull cycle ────────────────────────────────────────────────────────
     Two strokes. Each is a HAUL (the rope goes taut and the copy advances)
     followed by a RECOVERY (the hand reaches forward again, copy holds). */
  const u = interpolate(frame, [PULL_START, PULL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s4 = u * STROKES;
  const k = Math.min(STROKES - 1, Math.floor(s4));
  const f = s4 - k;
  const haul =
    f < HAUL_FRAC ? Easing.out(Easing.cubic)(f / HAUL_FRAC) : 1;

  /* Placard progress advances ONLY during hauls. This is continuous across the
     stroke boundary: at the end of a haul it is (k+1)/STROKES, and at the start
     of the next stroke haul=0 gives the same value — so there is no jump. */
  const pullT = Math.min(1, (k + haul) / STROKES);

  /* A short eased settle carries the last of the travel after the final stroke,
     so the placard glides to a stop rather than halting on a pull. */
  const settleT = interpolate(frame, [PULL_END, SETTLE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const t = Math.max(pullT, settleT);

  /* Rope tension: 1 while hauling, 0 on the recovery, smoothed so the rope does
     not snap between states. Falls to 0 for good once the pull is over. */
  const strokeTension =
    f < HAUL_FRAC
      ? interpolate(f, [0, 0.08, HAUL_FRAC - 0.08, HAUL_FRAC], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const pullOver = interpolate(frame, [PULL_END, SETTLE_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tension = strokeTension * pullOver;

  /* Hands, hand-over-hand. The lead hand drags from extended to the chest while
     the trail hand reaches back out; they swap roles each stroke. Both share the
     same phase at a stroke boundary, so the rope's endpoint never jumps. */
  const handAt = (phase: number) => ({
    x: interpolate(phase, [0, 1], [78, 44]),
    y: interpolate(phase, [0, 1], [50, 58]),
  });
  const even = k % 2 === 0;
  const handLead = handAt(even ? haul : 1 - haul);
  const handTrail = handAt(even ? 1 - haul : haul);

  /* ── Point ─────────────────────────────────────────────────────────── */
  const posed = interpolate(frame, [POINT_START, POINT_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  /* A slow drift so the held point isn't dead still. Raised cosine rather than
     abs(sin): abs folds the wave at zero and that corner reads as a jerk. */
  const pointDrift = ((1 - Math.cos(frame * 0.075)) / 2) * 4 * posed;

  const appear = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Placard travel ────────────────────────────────────────────────────
     The placard's REST position is its CSS box, so the transform delta is 0 at
     t=1 by construction — no centring constant to keep in sync.

     Only `transform` is animated. `useFitText` probes layout (clientHeight /
     scrollHeight) and gates on delayRender; animating `left` would re-run the
     fitter every frame and thrash the renderer. */
  /* ── Copy reveal ───────────────────────────────────────────────────────
     Written while the placard is still off-frame left, so what gets hauled in
     is a finished object rather than a block that assembles itself en route. */
  const write = interpolate(frame, [3, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationWrite = interpolate(frame, [22, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const groundProgress = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stoolProgress = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Auto-fit (title + narration) ──────────────────────────────────
     Both are rendered TWICE: an invisible (opacity:0) full-text copy that
     establishes layout size and is safe to measure, plus an absolutely
     positioned copy revealed via clip-path. An explicitly chosen size is
     honored exactly (minPx === targetPx no-ops the hook).

     NOTE: `frame` must never enter these dep arrays — see the transform note
     above. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 77 : 66);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 37 : 27);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.24 : 0.28)),
  );
  const { px: fitNarrationPx } = useFitText(
    fitNarrationRef,
    fitNarrationTarget,
    descriptionFontSizeIsUserSet ? fitNarrationTarget : Math.round(fitNarrationTarget * 0.5),
    [narration, fitNarrationTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.2 : 0.22)),
  );

  const [titleLines, setTitleLines] = React.useState(1);
  const [narrationLines, setNarrationLines] = React.useState(1);
  /* Measured heights of the two blocks, in px.
     The rule's position is derived from the TITLE's real rendered height rather
     than from `fontSize * lineHeight * lineCount`. That product is an estimate:
     it misses the font's own ascent/descent overshoot, and it lags whenever the
     column width changes the wrap. Either way the rule ends up drawn THROUGH
     the last line instead of under it, which is exactly what a measured height
     cannot get wrong. The estimate is kept only as the pre-layout seed. */
  const [titleMeasuredPx, setTitleMeasuredPx] = React.useState(0);
  const [narrationMeasuredPx, setNarrationMeasuredPx] = React.useState(0);
  React.useLayoutEffect(() => {
    let cancelled = false;
    const read = () => {
      if (cancelled) return;
      const measure = (el: HTMLElement | null, px: number) => {
        if (!el) return { lines: 1, height: 0 };
        const lh = parseFloat(getComputedStyle(el).lineHeight) || px;
        const height = el.getBoundingClientRect().height;
        return { lines: Math.max(1, Math.round(height / lh)), height };
      };
      const t = measure(fitTitleRef.current, fitTitlePx);
      const n = measure(fitNarrationRef.current, fitNarrationPx);
      setTitleLines(t.lines);
      setNarrationLines(n.lines);
      // Tolerance guard: sub-pixel churn would loop the state update.
      setTitleMeasuredPx((prev) => (Math.abs(prev - t.height) <= 0.5 ? prev : t.height));
      setNarrationMeasuredPx((prev) =>
        Math.abs(prev - n.height) <= 0.5 ? prev : n.height,
      );
    };

    read();
    /* Re-read once webfonts land. The marker face is much wider than the
       fallback, so the copy RE-WRAPS when it arrives — a one-line title can
       become two. `useFitText` may settle on the same px either way, so a
       measurement keyed only on the fitted size would keep a stale height and
       the rule would be drawn through the last line. */
    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    fontsObj?.ready?.then(read).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [title, narration, fitTitlePx, fitNarrationPx, p, width, height, fontFamily]);

  /* The copy block's geometry, all DERIVED from the one set of CSS percentages
     it is laid out with, so the rope's anchor cannot drift off the text if the
     box is ever retuned.

     There is no card: the copy sits plain on the paper, and the ROPE ITSELF is
     the rule under the title. So the rope's left end has to land exactly where
     that underline starts, and it must run flat across the title's width before
     rising to the figure's hand. */
  /* Portrait sets the copy lower than it otherwise would: the tall 9:16 frame
     puts a lot of vertical distance between a top-anchored heading and the
     hauler's hands, which turns the rope's free span into a near-vertical
     plunge. Dropping the copy keeps that span closer to the diagonal it reads
     best at. It is also centred in the frame rather than pinned left. */
  /* The column must END LEFT OF the hauler's most-extended hand. The rope runs
     hook → hand, so if the rule reached past the hand the rope would double
     back on itself and wrap behind the figure. That constraint is what sets the
     portrait width: a column centred in the frame is necessarily wide on both
     sides and always overruns the hand, so the column is inset from the left
     with the TEXT centred inside it instead. */
  const copyLeftPct = p ? 0.06 : 0.07;
  const copyWidthPct = p ? 0.66 : 0.5;
  /* In PORTRAIT this is the block's CENTRE line (it grows both ways from here);
     in LANDSCAPE it is the block's top edge. */
  const copyTopPct = p ? 0.34 : 0.22;

  const svgBottomPageY = height - height * (p ? 0.09 : 0.07);
  const copyLeftPx = width * copyLeftPct;
  const copyRightPx = width * (copyLeftPct + copyWidthPct);
  /** Left and right edges of the copy column at rest, in track units. */
  const copyLeftX = (copyLeftPx - trackOriginX) / s;
  const copyRightX = (copyRightPx - trackOriginX) / s;

  /* Start far enough left that the copy's RIGHT edge clears the frame, so it is
     fully off-stage at t=0 rather than half-visible. */
  const TEXT_FROM_X = -(copyRightPx / s + 16);
  const textAnchorX = interpolate(t, [0, 1], [TEXT_FROM_X, 0]);
  const textDX = textAnchorX * s;

  /* The underline's Y, in track units. It sits just below the title, whose
     height depends on the fitted font size and its line count — so this is
     derived from those rather than fixed, keeping the rope on the rule for any
     copy length. */
  /* Measured height wins; the line-count product is only the pre-layout seed so
     frame 0 is already close and self-corrects on the first measure. */
  const titleBlockPx = titleMeasuredPx || fitTitlePx * 1.05 * titleLines;
  const narrationBlockPx = narrationMeasuredPx || fitNarrationPx * 1.45 * narrationLines;
  /* The empty band the rope lies in. The SAME value is used as the spacer div's
     height in the copy below, so the drawn rule sits in the gap by
     construction rather than by two numbers being kept in step by hand. The
     rule is centred in that band.

     It SCALES with the title, rather than being a fixed 28-34px: a measured
     text height stops at the last line's box, but a face's descenders (and the
     marker face's generous overshoot) hang below that. At large title sizes a
     fixed band left the rule crowding — visually striking through — the final
     line. Tying the band to the type keeps the same optical clearance at every
     size, with a floor so small copy still gets a real gap. */
  const ropeGapPx = Math.max(p ? 34 : 28, Math.round(fitTitlePx * 0.75));

  /* PORTRAIT centres the whole copy block on a fixed line, so it grows BOTH
     ways: extra title lines push up into the space above, extra narration lines
     push down into the space below, and the block stays visually anchored
     instead of drifting off one end. (Anchoring the top pushed long copy down
     onto the hauler; anchoring the bottom drove long titles off the top of the
     frame.) LANDSCAPE keeps the simpler top-anchored stack — the copy is short
     there and the figure sits beside it, so downward growth is harmless. */
  const copyBlockPx = titleBlockPx + ropeGapPx + narrationBlockPx;
  const copyTopResolvedPx = p
    ? height * copyTopPct - copyBlockPx / 2
    : height * copyTopPct;
  /* The rule sits in the middle of the rope band, wherever the block landed. */
  const underlinePx = copyTopResolvedPx + titleBlockPx + ropeGapPx / 2;
  const anchorY = FIG_TRACK_H - (svgBottomPageY - underlinePx) / s;
  /* Rope's left end: the start of the underline, travelling with the copy. */
  const anchorX = copyLeftX + textAnchorX;
  /* Where the underline stops and the rope lifts away toward the hand. */
  const ruleEndX = copyRightX + textAnchorX;

  /* ── Rope ──────────────────────────────────────────────────────────────
     Both endpoints ARE the placard anchor and the lead hand — the same values
     used to draw them — so the rope is attached by construction.

     Sag, not shortening, absorbs the slack the figure takes in. It is at its
     tightest mid-haul and dips on every recovery, which is what sells the rope
     as a rope rather than a drawn line that happens to connect two things. */
  const handPageX = restX - 50 + (100 - handLead.x);
  const handPageY = handLead.y - STOOL_H;

  /* ── The free span: rule end → hand ──────────────────────────────────
     Sag applies only here. The flat rule section under the title never sags —
     it is lying on the page.

     A rope under its own weight hangs BELOW the straight line between its two
     ends. In SVG, +y is DOWN, so the control point must be pushed to a LARGER
     y than the straight-line midpoint. Placing the control near the rule's own
     height (as a small fraction of the drop) instead pulls the curve up above
     the chord, which reads as a bow bending the wrong way.

     So: start from the true midpoint of the span and add the sag downward. */
  /* The control point pulls the curve only about HALF way toward itself, so the
     visible droop is roughly sag/2 — the multiplier is sized for the drawn
     result, not the raw offset. There is a small floor so the rope is never a
     mathematically straight line even at full tension. */
  const span = Math.hypot(handPageX - ruleEndX, handPageY - anchorY);
  const sag = (1 - tension) * span * 0.34 + 5;
  const ropeMidX = (ruleEndX + handPageX) / 2;
  const ropeMidY = (anchorY + handPageY) / 2 + sag;
  const ropeDraw = interpolate(frame, [ROPE_DRAW_START, ROPE_DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /* The rope is released as the figure turns to point. */
  /* Portrait releases the rope EARLIER — before the copy has finished its
     travel. The copy column there is nearly frame-wide, so by the time it is
     fully home the rule would have run past the figure and off the right edge.
     Letting go during the final glide keeps the rope from ever overshooting,
     and reads as the hauler giving the last of the slack a shove. Landscape has
     the room, so it holds on until the point. */
  const ropeReleaseStart = p ? SETTLE_END - 14 : POINT_START;
  const ropeOpacity =
    ropeDraw * interpolate(frame, [ropeReleaseStart, ropeReleaseStart + 8], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });


  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="grain-dtv3">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.05" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-dtv3" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="52" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkFig-dtv3">
            <feTurbulence type="fractalNoise" baseFrequency="0.042" numOctaves="4" seed="19" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" />
          </filter>
          <filter id="inkTrail-dtv3">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="7" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-dtv3)" fill="none" />
      </svg>

      {/* The copy: plain text on the paper, no card. It is hauled in from the
          left as one block, and the ROPE doubles as the rule under the title —
          so the gap below the heading is left empty here and the rope is drawn
          across it in the figure's svg. */}
      <div
        style={{
          position: "absolute",
          // Same percentages the rope's anchor is derived from — see above.
          left: `${copyLeftPct * 100}%`,
          // Resolved above: portrait centres the block on `copyTopPct` so it
          // grows up AND down; landscape treats it as a plain top edge.
          top: copyTopResolvedPx,
          width: `${copyWidthPct * 100}%`,
          // Portrait centres the copy in its column; landscape keeps it ranged
          // left, where it reads against the figure standing off to the right.
          textAlign: p ? "center" : "left",
          transform: `translateX(${textDX}px)`,
          willChange: "transform",
          zIndex: 10,
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          <div
            ref={fitTitleRef}
            style={{
              opacity: 0,
              fontWeight: 700,
              lineHeight: 1.05,
              fontSize: fitTitlePx,
              letterSpacing: "0.01em",
              width: "100%",
            }}
          >
            {title}
          </div>
          <HandwrittenText
            text={title}
            progress={write}
            lineCount={titleLines}
            inkFilter="url(#ink-dtv3)"
            style={{
              color: textColor,
              fontWeight: 700,
              lineHeight: 1.05,
              fontSize: fitTitlePx,
              letterSpacing: "0.01em",
              width: "100%",
            }}
          />
        </div>

        {/* Space where the rope lies. Height is the SAME `ropeGapPx` the
            underline position is derived from, so the drawn rule and the gap
            in the copy cannot drift apart. */}
        <div style={{ height: ropeGapPx }} />

        <div style={{ position: "relative", width: "100%" }}>
          <div
            ref={fitNarrationRef}
            style={{
              opacity: 0,
              fontSize: fitNarrationPx,
              fontWeight: 500,
              lineHeight: 1.45,
              width: "100%",
            }}
          >
            {narration}
          </div>
          <HandwrittenText
            text={narration}
            progress={narrationWrite}
            lineCount={narrationLines}
            inkFilter="url(#ink-dtv3)"
            style={{
              color: textColor,
              fontSize: fitNarrationPx,
              fontWeight: 500,
              lineHeight: 1.45,
              width: "100%",
            }}
          />
        </div>
      </div>

      {/* Figure, stool and rope. The svg spans the FULL frame so everything can
          be expressed in one shared coordinate space — which is what lets the
          rope's endpoints be literally the hand and the placard anchor. Under
          `meet` the scale is min(boxW/300, boxH/124); these percentages make
          that resolve to the base `drawn_title` rig scale. */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "9%" : "7%",
          left: 0,
          width: "100%",
          height: p ? "22.3%" : "28.7%",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 20,
        }}
        viewBox={`0 0 ${FIG_TRACK_W} ${FIG_TRACK_H}`}
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        aria-hidden
      >
        {/* Rope, behind the figure so the hand reads as gripping it */}
        {/* The rope runs FLAT across the title's width — that straight section
            is the rule under the heading — then lifts away to the hand. Drawing
            it as one path is what makes the underline and the rope the same
            object rather than two things that happen to meet. */}
        <g filter="url(#inkTrail-dtv3)" opacity={ropeOpacity}>
          <path
            d={`M ${anchorX} ${anchorY} L ${ruleEndX} ${anchorY} Q ${ropeMidX} ${ropeMidY} ${handPageX} ${handPageY}`}
            fill="none"
            stroke={accentColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Hook where the rope MEETS the copy — at the end of the rule, the
              point the pull is actually transmitted through. (At the rule's far
              left it would sit at the trailing tail, hooked onto nothing.)
              Drawn from the same `ruleEndX/anchorY` the path bends at, so the
              hook and rope cannot separate. */}
          <g stroke={accentColor} fill="none" strokeLinecap="round">
            <circle cx={ruleEndX} cy={anchorY} r={4.5} strokeWidth={2.6} />
            {/* Shank curling up off the ring, as a hook's tip would. */}
            <path d={`M ${ruleEndX} ${anchorY - 4.5} q 6,-5 9,1`} strokeWidth={2.4} />
          </g>
        </g>

        {/* Stool, drawn on at the start. The seat's height is DERIVED from
            STOOL_H — the rig is lifted by exactly that much, and its feet sit at
            local y=114, so seat and feet coincide for any stool height. */}
        <g
          filter="url(#inkTrail-dtv3)"
          fill="none"
          stroke={textColor}
          strokeLinecap="round"
          strokeDasharray={300}
          strokeDashoffset={300 * (1 - stoolProgress)}
        >
          <line x1={restX - 22} y1={SEAT_Y} x2={restX + 22} y2={SEAT_Y} strokeWidth={5} />
          <line x1={restX - 16} y1={SEAT_Y} x2={restX - 21} y2={114} strokeWidth={4.5} />
          <line x1={restX + 16} y1={SEAT_Y} x2={restX + 21} y2={114} strokeWidth={4.5} />
          <line
            x1={restX - 19}
            y1={SEAT_Y + (114 - SEAT_Y) * 0.6}
            x2={restX + 19}
            y2={SEAT_Y + (114 - SEAT_Y) * 0.6}
            strokeWidth={3}
            strokeOpacity={0.55}
          />
        </g>

        <g transform={`translate(${restX - 50}, 0)`}>
          <HaulingStickman
            color={textColor}
            handLead={handLead}
            handTrail={handTrail}
            tension={tension}
            posed={posed}
            drift={pointDrift}
            appear={appear}
          />
        </g>
      </svg>

      {/* Ground line */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "8.4%" : "6.4%",
          left: 0,
          width: "100%",
          height: 24,
          overflow: "visible",
          pointerEvents: "none",
        }}
        viewBox="0 0 1000 24"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M 970,13 Q 720,8 480,12 Q 240,16 30,12"
          fill="none"
          stroke={textColor}
          strokeWidth={5}
          strokeOpacity={0.25}
          strokeLinecap="round"
          filter="url(#inkTrail-dtv3)"
          strokeDasharray={1000}
          strokeDashoffset={1000 * (1 - groundProgress)}
        />
      </svg>
    </AbsoluteFill>
  );
};
