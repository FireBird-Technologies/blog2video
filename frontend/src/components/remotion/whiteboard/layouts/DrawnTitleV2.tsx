import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

/**
 * drawn_title__v2 — "Shoulder Carry".
 *
 * Variant of `drawn_title`. Same props, different composition: TWO stick figures
 * carry the title/narration board in from the left on their shoulders, walk it
 * to centre, then turn to face front and press it overhead.
 *
 * ── How the board stays glued to the carriers ──────────────────────────
 * The board's copy is real HTML (it has to be — `useFitText` measures DOM nodes
 * to auto-shrink the title and narration), while the figures are SVG. They are
 * kept in contact by computing the whole choreography in the FIGURE's viewBox
 * units and converting to page px with a single scale factor, `s`.
 *
 * The board keeps its existing static CSS box and is moved only by a
 * `transform`. That matters for two reasons:
 *   - `transform` does not trigger layout, so `useFitText`'s measurement probes
 *     (which read clientHeight/scrollHeight) are untouched. Animating `top`
 *     instead would re-run the fitter every frame and thrash `delayRender`.
 *   - The board's REST position is already its CSS position, so the transform
 *     delta is naturally 0 on arrival — no magic centring constant.
 *
 * Contact is an invariant, not a tuned number: the board's underside Y and the
 * hands' Y are interpolated from the SAME `lift` scalar, so the hands cannot
 * drift off the board mid-press.
 *
 * Filter IDs carry a `-dtv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

const CHARS_PER_SEC = 30;

/** Perimeter of the board rect in viewBox units, for the draw-on dash. */
const BOARD_PERIMETER = 2 * (1000 + 460);

/** Width of the carry track in viewBox units (the svg spans the full frame). */
const FIG_TRACK_W = 300;
/** Height of the figure viewBox — the rig stands 124 units tall. */
const FIG_TRACK_H = 124;

/**
 * The pair's midpoint travels from off-frame left to dead centre of the track.
 * Each figure is drawn about its own local x=50, so the midpoint is the point
 * the board is centred on.
 */
const WALK_FROM = -70;
const WALK_TO = FIG_TRACK_W / 2;

/**
 * How far in from each end of the board the carriers stand, as a fraction of
 * the board's width. Two figures huddled under the middle of a wide board reads
 * as the board floating; standing near the ends is where you would actually
 * grip a load this size. The gap itself is derived per-orientation from the
 * board's real width — see `pairHalfGap` below.
 */
const CARRY_INSET = 0.1;

/**
 * Stride cadence copied verbatim from the base `drawn_title`: `frame * 0.22 *
 * speed` with speed 0.9. Same rate, same phase, same knee action.
 *
 * The GROUND speed is faster than the base's shuffle. The base drifts its figure
 * about half a body-width per stride, which never crosses a frame; carrying the
 * board in at that rate would take ~6s and a scene can be as short as 5s
 * (`FPS * 5` in WhiteboardVideo). At 2.8 body-widths per stride the reused leg
 * cycle still reads as a real walk — brisk and purposeful, which suits two
 * people carrying a load — and the whole entrance-and-press lands by frame 135.
 * Much past ~3 body-widths it would start to skate, which is why the budget was
 * bought by starting closer in (WALK_FROM) rather than by lengthening the
 * stride further.
 */
const WALK_SPEED = 0.9;
const WALK_CYCLE_RATE = 0.22 * WALK_SPEED;
/** Frames per full leg cycle at the base's cadence. */
const STRIDE_FRAMES = (2 * Math.PI) / WALK_CYCLE_RATE;
/** Rig body width in track units, and how far one stride carries it. */
const BODY_W = 28;
const UNITS_PER_STRIDE = BODY_W * 2.8;

/** Frame the pair finishes walking and comes to rest in the centre. */
const ARRIVE_FRAME = Math.round(
  ((WALK_TO - WALK_FROM) / UNITS_PER_STRIDE) * STRIDE_FRAMES,
);
/** How long the walk→face-forward turn takes once they have arrived. */
const TURN_BLEND = 16;
/** Beat after the turn before the press begins. */
const PRESS_DELAY = 2;
/** How long the overhead press takes. */
const PRESS_DUR = 18;

const PRESS_START = ARRIVE_FRAME + TURN_BLEND + PRESS_DELAY;
const PRESS_END = PRESS_START + PRESS_DUR;

/**
 * ── Carry geometry, in rig-local units ─────────────────────────────────
 * The board rests ON the shoulder (y≈44, just above the 48 shoulder pivot) and
 * the hands steady its edge from just underneath.
 *
 * CARRY_Y is the board's underside while walking. HOLD_Y is its underside once
 * pressed overhead — and it is DERIVED from where the hands end up, not chosen:
 * at full extension the hands reach y=2, so the board sits there plus a hair of
 * ink clearance. LIFT_RISE therefore falls out of the two poses rather than
 * being a number that has to be re-tuned whenever the arms change.
 *
 * The head's crown is at y=8, so holding at y=2 still puts the board clearly
 * ABOVE the head — while keeping the raised arm to a believable ~59 units
 * rather than the ~73 a higher hold would need on a rig only 124 tall.
 */
const CARRY_Y = 42.5;
const HOLD_Y = 3.5;
const LIFT_RISE = CARRY_Y - HOLD_Y; // 39

/**
 * One carrier. Authored entirely in UNMIRRORED local space; `side` only decides
 * whether the finished rig is flipped, so no coordinate below ever has to be
 * reasoned about in two orientations at once.
 *
 *  - `walk`   1 → 0 across the arrival, so legs, bob and lean settle together.
 *  - `facing` 0 → 1 squares the body to camera (spine straightens, feet spread).
 *             The head stays featureless throughout, as in the base rig.
 *  - `lift`   0 → 1 presses the arms from the shoulder-carry pose to overhead.
 *
 * Note the arms do NOT swing during the walk. You cannot swing your arms while
 * steadying a board on your shoulder, and a carrier whose arms pump while the
 * board floats above them is exactly the incoherence this layout is meant to
 * avoid. Legs, cadence and bob still match the base rig exactly.
 */
const Carrier: React.FC<{
  color: string;
  cycle: number;
  walk: number;
  facing: number;
  lift: number;
  bob: number;
  side: -1 | 1;
}> = ({ color, cycle, walk, facing, lift, bob, side }) => {
  const getLegPoints = (phaseOffset: number) => {
    const ph = cycle + phaseOffset;
    return {
      thighRotation: Math.sin(ph) * 32 * walk,
      kneeRotation: Math.max(0, Math.sin(ph - Math.PI / 2)) * 40 * walk,
    };
  };
  const legL = getLegPoints(0);
  const legR = getLegPoints(Math.PI);

  // Walking the rig is in profile (spine leans, legs hang off one hip); facing
  // forward it straightens and the feet plant either side of centre.
  const hipX = interpolate(facing, [0, 1], [52, 50]);
  const footSpread = 12 * facing;

  /* ── Arms: shoulder-carry → overhead press ────────────────────────────
     Both arms take the same pose, mirrored into a symmetric pair about the
     shoulder, so the board is supported evenly at both edges.

     Carry (lift=0): forearm up to (70,41) — just under the board's underside at
     CARRY_Y=42.5, i.e. fingers curled over the edge.
     Press (lift=1): arm straightens up and OUT to (84,2) — which is what
     defines HOLD_Y above.

     The head spans x=36..64 at r=14, so the hands clear it by a wide margin.
     Pressing straight up from the shoulder would drive both forearms through
     the skull, and merely grazing it still reads as arms clamped around the
     face — hence the generous outward reach. The limb also EXTENDS as it lifts
     (shoulder→hand grows from ~22 to ~59 units), so the raised arm is one long
     diagonal rather than a short folded elbow, which is what actually sets the
     width of the press. */
  const upperX = interpolate(lift, [0, 1], [62, 72]);
  const upperY = interpolate(lift, [0, 1], [42, 30]);
  const handX = interpolate(lift, [0, 1], [70, 84]);
  const handY = interpolate(lift, [0, 1], [41, 2]);

  return (
    <g transform={side === 1 ? undefined : "translate(100 0) scale(-1 1)"}>
      {/* Filter sits INSIDE the moving transform's parent, never on the same
          node as a translate: feTurbulence is sampled in filter space, so a
          filter on a translating group makes the noise crawl across the ink as
          it moves. Splitting them samples the noise in the rig's own frame. */}
      <g filter="url(#inkFig-dtv2)" transform={`translate(0, ${bob})`}>
        {/* Head */}
        <circle cx="50" cy="22" r="14" stroke={color} strokeWidth="4.5" fill="none" />

        {/* Head stays featureless in both orientations, as the base rig draws
            it — the turn is carried by the body squaring up, not by a face. */}

        {/* Spine */}
        <line x1="50" y1="38" x2={hipX} y2="72" stroke={color} strokeWidth="4.5" />

        {/* Back arm — mirrored about the shoulder so the pair opens symmetrically */}
        <g transform="translate(50 48) scale(-1 1) translate(-50 -48)">
          <line x1="50" y1="48" x2={upperX} y2={upperY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          <line x1={upperX} y1={upperY} x2={handX} y2={handY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* Legs */}
        <g transform={`rotate(${legR.thighRotation} ${hipX} 72)`}>
          <line x1={hipX} y1="72" x2={hipX + footSpread} y2="92" stroke={color} strokeWidth="4.5" />
          <g transform={`translate(${hipX + footSpread}, 92) rotate(${legR.kneeRotation})`}>
            <line
              x1="0"
              y1="0"
              x2={interpolate(facing, [0, 1], [8, 2])}
              y2="22"
              stroke={color}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>
        </g>
        <g transform={`rotate(${legL.thighRotation} ${hipX} 72)`}>
          <line x1={hipX} y1="72" x2={hipX - footSpread} y2="92" stroke={color} strokeWidth="4.5" />
          <g transform={`translate(${hipX - footSpread}, 92) rotate(${legL.kneeRotation})`}>
            <line
              x1="0"
              y1="0"
              x2={interpolate(facing, [0, 1], [8, -2])}
              y2="22"
              stroke={color}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Front arm */}
        <g>
          <line x1="50" y1="48" x2={upperX} y2={upperY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          <line x1={upperX} y1={upperY} x2={handX} y2={handY} stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
};

export const DrawnTitleV2: React.FC<WhiteboardLayoutProps> = ({
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
  const fps = 30;
  const { height, width } = useVideoConfig();

  /* ── Choreography scalars ─────────────────────────────────────────── */

  // Leg cycle freezes on arrival so the legs don't keep stepping in place.
  const cycleFrame = Math.min(frame, ARRIVE_FRAME);
  const cycle = cycleFrame * WALK_CYCLE_RATE;

  // LINEAR travel — a constant ground speed is what keeps every stride the same
  // length. Easing here would stretch and squash the stride against the
  // (unchanged) leg cycle, making the pair skate on entry and mince on arrival.
  const midX = interpolate(frame, [0, ARRIVE_FRAME], [WALK_FROM, WALK_TO], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const walk = 1 - interpolate(frame, [ARRIVE_FRAME, ARRIVE_FRAME + TURN_BLEND], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const facing = 1 - walk;

  const lift = interpolate(frame, [PRESS_START, PRESS_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /* Each carrier bobs on its own slightly-offset phase — exactly in step reads
     mechanical, and a half-cycle apart would see-saw the board between them.
     0.35 rad is a natural "two people walking together" offset.

     The BOARD takes the MEAN of the two bobs. The mean of two sines of equal
     frequency is itself a clean sine (slightly reduced amplitude, shifted
     phase), so the board rides smoothly rather than fighting two masters. The
     residual difference between either shoulder and the board stays under half
     a unit, which is invisible at this stroke width and reads as the give you'd
     actually see in a shared carry. */
  const bobA = Math.sin(cycle * 2) * 3 * walk;
  const bobB = Math.sin((cycle + 0.35) * 2) * 3 * walk;
  const carryBob = (bobA + bobB) / 2;

  /* Settle: a small overshoot as the press tops out, then a slow breathing
     strain so the held pose isn't frozen. Both are tiny — the board carries the
     copy, so legibility beats liveliness. */
  const settle =
    Math.sin(
      interpolate(frame, [PRESS_END, PRESS_END + 10], [0, Math.PI], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ) * -1.2;
  const strain = ((1 - Math.cos(frame * 0.06)) / 2) * 0.8 * lift;

  /* ── Rig-unit → page-px scale ─────────────────────────────────────────
     The figure svg spans the full frame on a 300×124 viewBox under
     `xMidYMax meet`, so its scale is min(boxW/300, boxH/124) px per rig unit.
     Everything above is authored in rig units; this is what carries those
     numbers over to the DOM board. */
  const figBoxH = height * (p ? 0.223 : 0.287);
  const s = Math.min(width / FIG_TRACK_W, figBoxH / FIG_TRACK_H);
  /* MUST match the figure svg's own `bottom` below — the board's contact point
     is derived from it, so the two drifting apart would float the board off the
     carriers' hands. Portrait sits the whole staging higher up the tall frame. */
  const figBottomPx = height * (p ? 0.2 : 0.06);

  /* Half the distance between the carriers, in track units. Derived from the
     board's real width so they stand near its ends in BOTH orientations — the
     board is far wider than the figure track, and the two differ enough between
     landscape and portrait that a single constant would put the pair under the
     board's middle in one of them. */
  const boardWidthPx = width * (p ? 0.86 : 0.64);
  const pairHalfGap = (boardWidthPx * (0.5 - CARRY_INSET)) / s;

  /* Where the board's underside should be this frame, in rig units. */
  const boardTargetY =
    interpolate(lift, [0, 1], [CARRY_Y, HOLD_Y]) + carryBob + settle - strain;

  /* Where the board's underside sits AT REST, in rig units.
     The box is positioned by CSS percentages of the frame, so this is a pure
     function of the frame size — no DOM measurement needed, and crucially none
     wanted: `getBoundingClientRect()` reports the element AFTER its transform,
     and since that transform is what we are computing, feeding the rect back in
     would form a feedback loop that walks the board off-screen every frame. */
  const boardBottomRigY =
    FIG_TRACK_H -
    (height - figBottomPx - height * ((p ? 0.06 : 0.17) + (p ? 0.42 : 0.46))) / s;

  /* The board's transform delta. x is 0 on arrival by construction (the pair
     stops at track centre, which is where the board's CSS box already is), so
     only the entrance offset and the vertical carry need expressing. */
  const boardDX = (midX - WALK_TO) * s;
  const boardDYRaw = (boardTargetY - boardBottomRigY) * s;
  /* Clamp so the press can never drive the board off the top of the frame. */
  const boardTopPx = height * (p ? 0.06 : 0.17);
  const boardDY = Math.max(boardDYRaw, -(boardTopPx - height * 0.02));
  const boardTransform = `translate(${boardDX}px, ${boardDY}px)`;

  /* ── Copy reveal ───────────────────────────────────────────────────────
     The board draws and writes itself WHILE being carried in, not after it
     lands: it is a physical object the figures are already holding, so it
     should arrive finished rather than materialising once parked. */
  const boardProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const groundProgress = interpolate(frame, [2, ARRIVE_FRAME * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleStart = 22;
  const titleDur = Math.ceil(title.length * (fps / CHARS_PER_SEC));
  const titleChars = Math.min(
    title.length,
    Math.max(
      0,
      Math.floor(
        interpolate(frame, [titleStart, titleStart + titleDur], [0, title.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );

  const noteStart = titleStart + titleDur + 6;
  const noteProgress = interpolate(frame, [noteStart, noteStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visibleTitle = title.slice(0, titleChars);

  /* ── Auto-fit ──────────────────────────────────────────────────────
     The title is progressively SLICED in via titleChars, so measuring the
     visible div would chase a moving (and initially empty) target — a hidden
     full-text mirror is measured instead, matching the base `drawn_title`.
     The narration is present in full from frame 0 (only opacity animates) so it
     is safe to measure directly. An explicitly chosen size is honored exactly
     (minPx === targetPx no-ops the hook).

     Both live INSIDE the board, sharing its fixed inner height, so their budgets
     are split shares of the board rather than each assuming the whole box —
     otherwise a long title and a long narration would each fit their own check
     and still overflow the board together. Board height is 46% of the frame in
     landscape, 42% in portrait; padding and the divider take ~18% of that,
     leaving roughly 55/27 to split between title and narration.

     NOTE: `frame` must never enter these dep arrays. The hook probes layout and
     gates on delayRender; re-running it per frame would thrash the renderer.
     The board is animated purely by `transform`, which does not affect layout,
     so the measurements below stay valid for the whole scene. */
  const boardH = height * (p ? 0.42 : 0.46);
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNoteRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 73 : 59);
  const fitNoteTarget = descriptionFontSize ?? (p ? 33 : 27);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(boardH * 0.55),
  );
  const { px: fitNotePx } = useFitText(
    fitNoteRef,
    fitNoteTarget,
    descriptionFontSizeIsUserSet ? fitNoteTarget : Math.round(fitNoteTarget * 0.5),
    [narration, fitNoteTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(boardH * 0.27),
  );

  /* The board frame svg and the copy box must move as ONE rigid object, so they
     share this box geometry and the same transform.
     The box is centred horizontally (left = (100 - width) / 2): the carriers
     stop at track centre and the board rides on them, so any left/right bias in
     the box would show up as the board hanging off the pair. */
  const boardBox: React.CSSProperties = {
    position: "absolute",
    left: p ? "7%" : "18%",
    top: p ? "6%" : "17%",
    width: p ? "86%" : "64%",
    height: p ? "42%" : "46%",
  };

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      {/* Shared filter defs + paper grain */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="grain-dtv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.055" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-dtv2" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="31" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkFig-dtv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="12" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" />
          </filter>
          <filter id="inkBoard-dtv2" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="4" seed="41" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="4.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-dtv2)" fill="none" />
      </svg>

      {/* Hand-drawn board frame, carried in with the copy */}
      <svg
        style={{
          ...boardBox,
          overflow: "visible",
          pointerEvents: "none",
          transform: boardTransform,
          willChange: "transform",
        }}
        viewBox="0 0 1000 460"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g filter="url(#inkBoard-dtv2)" strokeLinecap="round">
          {/* Solid white face, so the board reads as a physical panel being
              carried rather than an outline the paper shows through. Fades in
              with the frame's draw-on. */}
          <rect
            x={6}
            y={6}
            width={988}
            height={448}
            rx={10}
            fill="#FFFFFF"
            fillOpacity={0.96 * boardProgress}
            stroke="none"
          />
          <rect
            x={6}
            y={6}
            width={988}
            height={448}
            rx={10}
            fill="none"
            stroke={textColor}
            strokeWidth={9}
            strokeOpacity={0.22}
            strokeDasharray={BOARD_PERIMETER}
            strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
          />
          <rect
            x={6}
            y={6}
            width={988}
            height={448}
            rx={10}
            fill="none"
            stroke={textColor}
            strokeWidth={5}
            strokeDasharray={BOARD_PERIMETER}
            strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
          />
        </g>
        {/* Accent tick marks in the board's top corners, drawn last */}
        <g
          stroke={accentColor}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          opacity={interpolate(boardProgress, [0.75, 1], [0, 0.5], { extrapolateLeft: "clamp" })}
        >
          <path d="M40,44 L82,44 M40,44 L40,86" />
          <path d="M960,44 L918,44 M960,44 L960,86" />
        </g>
      </svg>

      {/* Title + narration, both written INSIDE the board and moving with it.
          Position/size MUST stay in lockstep with the board frame svg above —
          this box is the frame's interior, hence the shared `boardBox`. */}
      <div
        style={{
          ...boardBox,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? "3%" : "2.5%",
          padding: p ? "5% 7%" : "4% 6%",
          boxSizing: "border-box",
          textAlign: "center",
          zIndex: 10,
          transform: boardTransform,
          willChange: "transform",
        }}
      >
        {/* Hidden full-title mirror — titleChars slices the visible copy in
            progressively, so it cannot be measured directly. */}
        <div
          ref={fitTitleRef}
          aria-hidden
          style={{
            position: "absolute",
            visibility: "hidden",
            width: "86%",
            fontWeight: 700,
            lineHeight: 1.08,
            fontSize: fitTitlePx,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: textColor,
            fontWeight: 700,
            lineHeight: 1.08,
            fontSize: fitTitlePx,
            letterSpacing: "0.01em",
            filter: "url(#ink-dtv2)",
            width: "100%",
            flexShrink: 0,
          }}
        >
          {visibleTitle}
        </div>

        {/* Short divider rule between title and narration, drawn on once the
            title has finished writing. */}
        <svg
          style={{
            width: p ? "44%" : "34%",
            height: 10,
            flexShrink: 0,
            overflow: "visible",
            opacity: noteProgress,
          }}
          viewBox="0 0 300 10"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,5 Q75,2 150,6 Q225,10 300,4"
            fill="none"
            stroke={accentColor}
            strokeWidth={4}
            strokeLinecap="round"
            filter="url(#ink-dtv2)"
            strokeDasharray={340}
            strokeDashoffset={340 * (1 - noteProgress)}
          />
        </svg>

        {/* Narration, on the board beneath the title */}
        <div
          ref={fitNoteRef}
          style={{
            color: textColor,
            fontSize: fitNotePx,
            fontWeight: 500,
            lineHeight: 1.4,
            width: "100%",
            textAlign: "center",
            filter: "url(#ink-dtv2)",
            opacity: noteProgress,
          }}
        >
          {narration}
        </div>
      </div>

      {/* The two carriers. The svg spans the FULL frame width so the walk can be
          expressed in frame-relative units — the same reason and the same
          sizing as the base rig, so the figures render at `drawn_title` scale.
          Under `meet` the scale is min(boxW/300, boxH/124); these percentages
          make that resolve to the base's own scale in both orientations. */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "20%" : "6%",
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
        {/* Each carrier is translated to its own side of the pair midpoint. The
            rig is drawn about local x=50, so subtracting 50 centres it. */}
        <g transform={`translate(${midX - pairHalfGap - 50}, 0)`}>
          <Carrier
            color={textColor}
            cycle={cycle}
            walk={walk}
            facing={facing}
            lift={lift}
            bob={bobA}
            side={1}
          />
        </g>
        <g transform={`translate(${midX + pairHalfGap - 50}, 0)`}>
          <Carrier
            color={textColor}
            cycle={cycle + 0.35}
            walk={walk}
            facing={facing}
            lift={lift}
            bob={bobB}
            side={-1}
          />
        </g>
      </svg>

      {/* Ground line under the figures */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "19.4%" : "5.4%",
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
          d="M 30,12 Q 240,16 480,12 Q 720,8 970,13"
          fill="none"
          stroke={textColor}
          strokeWidth={5}
          strokeOpacity={0.25}
          strokeLinecap="round"
          filter="url(#inkBoard-dtv2)"
          strokeDasharray={1000}
          strokeDashoffset={1000 * (1 - groundProgress)}
        />
      </svg>
    </AbsoluteFill>
  );
};
