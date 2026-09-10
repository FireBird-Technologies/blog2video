import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

/**
 * stick_figure_scene__v2 — "Chalk Talk".
 *
 * Variant of `stick_figure_scene`. Same props, different composition: the
 * board is a HANGING sign — two ropes drop it from the top of the frame,
 * instead of the base's standing tripod easel — with both the title AND
 * narration written on it, stacked one above the other. The board hangs
 * still — no pendulum sway.
 *
 * The figure is a FRONT-FACING stickman juggling three balls in a slow cascade.
 * It keeps the base `stick_figure_scene`'s stroke weight, head radius and
 * overall proportions (and its 420×370 viewBox, which the layout's
 * `bottom`/`width` coupling below depends on), but stands square to camera
 * rather than in profile: symmetric stance, both arms working.
 *
 * The figure is PRE-BUILT — it fades in whole rather than sketching itself on
 * stroke by stroke, since it is a person already mid-juggle when the shot
 * begins. Its hands and its balls run off one shared phase, so the catch beat
 * always lands on the hand the ball is actually arriving at.
 *
 * Filter IDs carry a `-sfv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

const BOARD_PERIMETER = 2 * (544 + 404);

/**
 * Figure viewBox, matching the base `stick_figure_scene`'s own 420×370 box —
 * the figure svg's `bottom` offset and the ground line's are derived from this
 * height (see the comments at the svg below), so it must not change.
 */
const FIG_VIEWBOX_W = 420;

/** Body centreline. The rig is symmetric about it, since it faces the camera. */
const BODY_X = FIG_VIEWBOX_W / 2;

/**
 * ── Juggling cascade ──────────────────────────────────────────────────
 * Frames for ONE ball to travel hand to hand. The three balls share a single
 * trajectory, phase-offset by 1/3 of a period — which is exactly what a
 * three-ball cascade is: at any instant one is being thrown, one is at apex and
 * one is being caught. Deriving all three from one arc is what keeps them in
 * sync; three independently-tuned curves drift apart within a few seconds.
 *
 * Slow. At 30fps a 54-frame throw is nearly two seconds hand-to-hand, which is
 * a lazy, readable juggle rather than a blur. The scene is background action
 * behind a board of copy, so legibility beats virtuosity.
 */
const THROW_PERIOD = 54;
/**
 * ── Where the hands are ────────────────────────────────────────────────
 * The catch/throw points. CLOSE IN and just below the shoulders: a juggler's
 * hands work in front of the ribs, not out at arm's length. The arms are
 * correspondingly short — each is one straight-ish stroke barely longer than
 * the head is wide.
 *
 * The balls are thrown between exactly these two points, so a catch always
 * lands in a hand.
 */
const HAND_SPREAD = 80;
const HAND_Y = 150;

/** Shoulder height. Each arm is ONE gently bowed stroke from here to the hand —
 *  no elbow. Articulated rigs kinked or collapsed at some phase of the throw;
 *  a single curve reads correctly at every hand position. */
const SHOULDER_Y = 126;

/**
 * How much of the shoulder→hand span the arm actually covers, and how far the
 * hand is pulled FORWARD (in toward the body's centreline) from the throw
 * point.
 *
 * The balls are thrown between the HAND_SPREAD points, but the drawn hand sits
 * inboard of them by ARM_TUCK: the arms therefore read as held in front of the
 * ribs rather than flung out sideways, while the pattern keeps its width. The
 * arm is then drawn 1.2× the distance to that tucked point, so it is a
 * reasonable limb length rather than a stub.
 */
const ARM_TUCK = 22;
const ARM_LENGTH = 1.2;
/** How far the arm bows outward at its midpoint. A suggestion of a bend on what
 *  is otherwise a short, near-straight stroke. */
const ARM_BOW = 7;

/**
 * Apex height above the hands. BOTH directions use this same height, so every
 * ball genuinely lifts — an earlier pass gave leftward throws only 30% of it as
 * a way to keep the streams apart, which made half the balls barely rise at all.
 *
 * It has to clear the head (circle cy=66 r=30, crown y=36) by more than a ball
 * radius. This is the MIDDLE ball's height; the other two are ARC_STAGGER
 * above and below it (see below), so the tallest throw peaks at
 * HAND_Y − ARC_H − ARC_STAGGER.
 *
 * The tallest throw must stay INSIDE the 370-tall viewBox: `ink-sfv2` has a
 * bounded filter region and clips what leaves it, so a ball past y=0 simply
 * vanishes and the pattern looks like it has lost one. With hands at 150,
 * ARC_H 128 and ARC_STAGGER 40, the highest ball peaks at y=-18 and its top
 * edge at y=-40 — just outside, which the `overflow: visible` box still draws.
 *
 * No ball ever dips below HAND_Y, by construction — the arc is a sine that
 * returns to zero at the catch.
 */
const ARC_H = 128;

/**
 * Phase spacing between the three balls, in throw-periods.
 *
 * The balls are NEVER held — each is always in flight, launching again the
 * instant it lands, so the pattern juggles continuously.
 *
 * Balls may freely OVERLAP as they pass one another; that is not a constraint,
 * which is what lets them be drawn large and readable. What must never happen
 * is two balls landing on EXACTLY the same point, because then only two are
 * visible and the pattern looks like it has dropped one. Putting all three on
 * one identical path does exactly that: with a 2-lap direction cycle, every
 * simple phase fraction (1/3, 1/2, 2/3 …) superimposes a pair perfectly, and a
 * fine sweep over phase alone never gets the closest approach above ~6 units.
 *
 * ARC_STAGGER is what actually fixes it — see below.
 */
const BALL_PHASE = 2 / 3;

/**
 * How much taller/shorter the outer two balls' arcs are than the middle one's.
 *
 * The three balls trace NESTED paths rather than sharing one, so no two are
 * ever at the same point no matter the phase. That is the only reliable way to
 * keep all three visible: it removes the coincidence geometrically instead of
 * trying to dodge it by timing.
 *
 * A real cascade has exactly this quality — the throws are not all identical —
 * so it reads correctly as well as rendering correctly.
 */
const ARC_STAGGER = 40;

/**
 * Front-facing stickman running a three-ball cascade.
 *
 * The figure is PRE-BUILT — it does not draw itself in. It is a person standing
 * in the scene, already mid-juggle when the shot begins; sketching the body on
 * while the balls are already flying read as two unrelated events. Only the
 * balls fade in, and they do so together with the figure's own opacity.
 */
const JugglingStickman: React.FC<{
  color: string;
  accent: string;
  bgColor: string;
  frame: number;
  progress: number;
}> = ({ color, accent, bgColor, frame, progress }) => {
  const handLX = BODY_X - HAND_SPREAD;
  const handRX = BODY_X + HAND_SPREAD;

  /* Each ball's own phase, a third of a period apart.
     `lap` counts completed throws and its PARITY picks the direction, so
     successive throws alternate hands — the defining feature of a cascade (a
     fountain, where each hand throws only to itself, has no parity flip).
     `t` is 0→1 along the current arc, with no pause at either end. */
  const balls = [0, 1, 2].map((i) => {
    const phase = frame / THROW_PERIOD + i * BALL_PHASE;
    const lap = Math.floor(phase);
    /* `t` runs 0→1 across one throw with no pause at either end, so the moment
       a ball lands it is already launching again — a continuous juggle. */
    const t = phase - lap;
    /* `lap` parity alternates the direction, which is what makes this a cascade
       (each hand throws to the other) rather than a fountain. */
    const rightward = lap % 2 === 0;
    const fromX = rightward ? handLX : handRX;
    const toX = rightward ? handRX : handLX;
    return {
      i,
      // Straight hand to hand — a ball always leaves from and lands in a hand.
      x: fromX + (toX - fromX) * t,
      /* Same height in BOTH directions, so every ball lifts the same way and
         comes back to exactly HAND_Y — but each BALL gets its own height, so
         the three trace nested arcs and never coincide. */
      y: HAND_Y - (ARC_H + (i - 1) * ARC_STAGGER) * Math.sin(Math.PI * t),
    };
  });

  /* Hands dip on the catch beat, driven by the SAME phase the balls are — so a
     hand is at its lowest exactly when a ball reaches it, rather than bobbing on
     a rhythm of its own. A ball lands in a given hand once per period, and the
     two hands are half a period apart.

     The dip is generous (16 units) because it is the arm's whole visible
     motion: it is what makes the hand read as absorbing a catch and pushing the
     next throw away, rather than sitting at a fixed point while balls teleport
     in and out of it. */
  const catchDip = (offset: number) =>
    Math.max(0, Math.sin(Math.PI * 2 * (frame / THROW_PERIOD) + offset)) * 16;
  const dipL = catchDip(0);
  const dipR = catchDip(Math.PI);
  const handLY = HAND_Y + dipL;
  const handRY = HAND_Y + dipR;
  /* Each arm's control point: the midpoint of shoulder→hand, pushed OUTWARD
     (away from the body) and slightly down, which is what gives the single line
     its bow. Derived from the hand's live position, so the curve keeps its
     shape as the hand dips on the catch rather than the bend being pinned to a
     fixed point. */
  const armCurve = (handX: number, handY: number, dir: -1 | 1) => {
    /* Pull the drawn hand IN from the throw point, then extend the arm 1.2×
       along that shortened direction. The result is a limb of believable length
       held close to the front of the body — not one stretched out to wherever
       the balls happen to be caught. */
    const tuckedX = handX - dir * ARM_TUCK;
    const endX = BODY_X + (tuckedX - BODY_X) * ARM_LENGTH;
    const endY = SHOULDER_Y + (handY - SHOULDER_Y) * ARM_LENGTH;
    const midX = (BODY_X + endX) / 2;
    const midY = (SHOULDER_Y + endY) / 2;
    return `M${BODY_X},${SHOULDER_Y} Q${midX + dir * ARM_BOW},${midY + ARM_BOW * 0.5} ${endX},${endY}`;
  };

  /* ── Body motion ───────────────────────────────────────────────────────
     A standing juggler is never quite still. Two small, slow movements, both
     tied to the throw cycle so the body reads as working with the balls rather
     than idling on a separate clock:

     - `sway` rocks the weight side to side once per full cycle (two throws),
       which is the rhythm a juggler's weight actually shifts on.
     - `bounce` is a slight vertical give on every catch, so the knees absorb
       the same beat the hands do — hence twice the sway's frequency.

     Both are a couple of units. Any more and the figure starts to wander
     against a fixed ground line and a fixed board. */
  const cyclePhase = Math.PI * 2 * (frame / THROW_PERIOD);
  const sway = Math.sin(cyclePhase / 2) * 3.5;
  const bounce = (1 - Math.cos(cyclePhase)) * 1.6;

  return (
    <g
      filter="url(#ink-sfv2)"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
      /* Bolder than the base rig's 5. This figure stands alone against a large
         empty half of the frame rather than beside a busy easel, so it carries
         more weight without competing with the board's copy. */
      strokeWidth={7}
      fill="none"
      /* One opacity for the whole rig — figure and balls appear together as a
         finished thing, instead of the body being drawn on stroke by stroke. */
      opacity={progress}
    >
      {/* ── Everything above the hips sways and gives; the FEET do not.
             Grouping it this way is what keeps the stance planted while the
             body moves — swaying the whole rig would slide the feet along the
             ground line. ── */}
      <g transform={`translate(${sway}, ${bounce})`}>
        {/* Head and spine */}
        <circle cx={BODY_X} cy={66} r={30} />
        <line x1={BODY_X} y1={98} x2={BODY_X} y2={218} />

        {/* Arms — one curved line each, shoulder straight out to hand. */}
        <path d={armCurve(handLX, handLY, -1)} />
        <path d={armCurve(handRX, handRY, 1)} />
      </g>

      {/* Legs — a symmetric planted stance, not a stride: the figure is
          standing still and working with its arms. The hips take a fraction of
          the sway so the legs stay attached to the spine above them, while the
          feet stay put. */}
      <path d={`M${BODY_X + sway * 0.6},218 L${BODY_X - 35},308`} />
      <path d={`M${BODY_X + sway * 0.6},218 L${BODY_X + 35},308`} />

      {/* === THE THREE BALLS === */}
      {balls.map((b) => (
        <g key={b.i}>
          <circle cx={b.x} cy={b.y} r={22} stroke={accent} strokeWidth={5} fill={bgColor} />
          <path
            d={`M${b.x - 9},${b.y - 7} Q${b.x},${b.y - 1} ${b.x + 9},${b.y - 7}`}
            stroke={accent}
            strokeWidth={3}
            strokeOpacity={0.5}
          />
        </g>
      ))}
    </g>
  );
};

export const StickFigureSceneV2: React.FC<WhiteboardLayoutProps> = ({
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
  const { height } = useVideoConfig();

  // The board draws and swings gently into place, the title writes on inside
  // it, the figure fills in, and the narration follows the title on the same
  // board rather than a separate band below.
  const chartProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [24, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationOp = interpolate(frame, [42, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /* The figure fades in as a finished thing. Quick, because there is nothing to
     watch being drawn — it just needs to not pop. The ground line still uses
     this to sweep in behind it. */
  const figProgress = interpolate(frame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The board hangs STILL — no pendulum sway. Kept as a named constant rather
  // than stripping the two `rotate(...)` transforms below, because the ropes
  // and the board must always share one identical rotation to stay visually
  // attached; routing both through this single value keeps that invariant
  // intact (and makes re-enabling a sway a one-line change).
  const swayAngle = 0;

  /* ── Auto-fit (title + narration) ──────────────────────────────────
     Both render the full prop text directly from frame 0 (only opacity
     animates) — no slice-reveal — so a direct ref is safe, matching the
     `stick_figure_scene` base. Both now share the board's fixed height, so
     their budgets are split shares of it rather than each assuming the whole
     box — the same approach used for `drawn_title__v2`'s board. */
  const boardHeightFrac = p ? 0.46 : 0.62;
  const boardH = height * boardHeightFrac;
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 63 : 54);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 31 : 28);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(boardH * 0.4),
  );
  const { px: fitNarrationPx } = useFitText(
    fitNarrationRef,
    fitNarrationTarget,
    descriptionFontSizeIsUserSet ? fitNarrationTarget : Math.round(fitNarrationTarget * 0.5),
    [narration, fitNarrationTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(boardH * 0.28),
  );

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
          <filter id="grain-sfv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.055" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-sfv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="85" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkEasel-sfv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="4" seed="58" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-sfv2)" fill="none" />
      </svg>

      {/* Everything from the ropes down to the board swings together as one
          rigid unit, pivoting from the ropes' anchor point at the top of the
          frame — a hanging sign sways as a whole, not just its board. */}
      <div
        style={{
          position: "absolute",
          left: p ? "6%" : "8%",
          top: 0,
          width: p ? "76%" : "50%",
          height: p ? "12%" : "13%",
          // The pivot point is the top edge of this box (where the ropes
          // anchor), so a CSS transform on a full-height wrapper below handles
          // the sway; this box only exists to size the rope SVG.
        }}
      >
        {/* ── Ropes: two, from the top of the frame down to the board's top
            corners. A single hand-drawn stroke each — no chain links — with a
            slight wobble so it reads as soft cord rather than a ruler-straight
            line. ────────────────────────────────────────────────────────── */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 4,
            transform: `rotate(${swayAngle}deg)`,
            transformOrigin: "50% 0%",
          }}
          viewBox="0 0 560 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {[120, 440].map((cx) => (
            <path
              key={cx}
              d={`M ${cx - 3},0 Q ${cx + 4},35 ${cx - 3},65 Q ${cx - 7},85 ${cx},100`}
              fill="none"
              stroke={textColor}
              strokeWidth={3.5}
              strokeOpacity={0.55}
              strokeLinecap="round"
              filter="url(#inkEasel-sfv2)"
              strokeDasharray={130}
              strokeDashoffset={130 * (1 - chartProgress)}
            />
          ))}
        </svg>
      </div>

      {/* The board itself, and everything written on it, also swings — same
          rotation, sharing the ropes' pivot at the top of the frame. */}
      <div
        style={{
          position: "absolute",
          left: p ? "6%" : "8%",
          top: p ? "12%" : "13%",
          width: p ? "76%" : "50%",
          height: `${boardHeightFrac * 100}%`,
          transform: `rotate(${swayAngle}deg)`,
          transformOrigin: `50% ${p ? "-26%" : "-21%"}`,
        }}
      >
        {/* Hanging board, drawn corner-to-corner */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 4,
          }}
          viewBox="0 0 560 404"
          preserveAspectRatio="none"
          aria-hidden
        >
          <g filter="url(#inkEasel-sfv2)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect
              x={8}
              y={8}
              width={544}
              height={388}
              rx={8}
              stroke={textColor}
              strokeWidth={10}
              strokeOpacity={0.2}
              strokeDasharray={BOARD_PERIMETER}
              strokeDashoffset={BOARD_PERIMETER * (1 - chartProgress)}
            />
            <rect
              x={8}
              y={8}
              width={544}
              height={388}
              rx={8}
              stroke={textColor}
              strokeWidth={5}
              strokeDasharray={BOARD_PERIMETER}
              strokeDashoffset={BOARD_PERIMETER * (1 - chartProgress)}
            />
            {/* Eyelets where the ropes attach */}
            <circle cx={120} cy={8} r={9} strokeWidth={4} strokeOpacity={0.5} />
            <circle cx={440} cy={8} r={9} strokeWidth={4} strokeOpacity={0.5} />
          </g>
        </svg>

        {/* Title + narration, both written ON the board, stacked */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4%",
            padding: "6% 8%",
            boxSizing: "border-box",
            textAlign: "center",
            zIndex: 8,
          }}
        >
          <div
            ref={fitTitleRef}
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: fitTitlePx,
              lineHeight: 1.08,
              width: "100%",
              opacity: titleOp,
              filter: "url(#ink-sfv2)",
              flexShrink: 0,
            }}
          >
            {title}
          </div>

          {/* Underline scribble between title and narration */}
          <svg
            style={{ width: "38%", height: 12, flexShrink: 0, overflow: "visible", opacity: titleOp }}
            viewBox="0 0 300 12"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M0,6 Q75,2 150,7 Q225,12 300,5"
              fill="none"
              stroke={accentColor}
              strokeWidth={5}
              strokeLinecap="round"
              filter="url(#ink-sfv2)"
              strokeDasharray={340}
              strokeDashoffset={340 * (1 - titleOp)}
            />
          </svg>

          <div
            ref={fitNarrationRef}
            style={{
              color: textColor,
              fontSize: fitNarrationPx,
              lineHeight: 1.35,
              width: "100%",
              opacity: narrationOp,
              transform: `translateY(${interpolate(narrationOp, [0, 1], [10, 0])}px)`,
              filter: "url(#ink-sfv2)",
            }}
          >
            {narration}
          </div>
        </div>
      </div>

      {/* ── Juggling figure, standing beside the board ──────────────────
          The viewBox is the base `stick_figure_scene`'s own 420×370, kept so
          the feet stay at y=308 and the offsets below remain valid. 16.8% of
          the box sits BELOW the feet, so `bottom` is offset to put them
          exactly on the scene's ground line rather than the svg's own lower
          edge. */}
      <svg
        style={{
          position: "absolute",
          // Coupled to the ground line's `bottom` below: the base rig puts the
          // feet at y=308 of its 370-tall viewBox, i.e. 16.8% of the box sits
          // BELOW the feet, so this offset is (ground% − 16.8% of svg height)
          // to plant the feet exactly on that line. Change one, recompute the
          // other.
          bottom: p ? "4.6%" : "0.5%",
          right: p ? "2%" : "4%",
          // The figure scales with this width (the box is `meet` on a fixed
          // viewBox), so this is the size control. The rig is symmetric about
          // the viewBox centre and its juggling arc reaches well above the
          // head, so the svg is deliberately wider than the figure itself —
          // the arc needs room inside the box or the balls clip at the apex.
          width: p ? "78%" : "38%",
          height: "auto",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 10,
        }}
        viewBox={`0 0 ${FIG_VIEWBOX_W} 370`}
        fill="none"
        aria-hidden
      >
        <JugglingStickman
          color={textColor}
          accent={accentColor}
          bgColor={bgColor}
          frame={frame}
          progress={figProgress}
        />
      </svg>

      {/* Ground line under the board's shadow + figure */}
      <svg
        style={{
          position: "absolute",
          // Portrait sits the ground near the bottom of the tall frame; at the
          // old 23.4% it floated mid-frame with a large dead band beneath it.
          // The figure's own `bottom` above is derived from this value.
          bottom: p ? "10%" : "8.4%",
          left: 0,
          width: "100%",
          height: 22,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 6,
        }}
        viewBox="0 0 1000 22"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M 20,11 Q 260,15 500,11 Q 740,7 980,12"
          fill="none"
          stroke={textColor}
          strokeWidth={5}
          strokeOpacity={0.24}
          strokeLinecap="round"
          filter="url(#inkEasel-sfv2)"
          strokeDasharray={1010}
          strokeDashoffset={1010 * (1 - figProgress)}
        />
      </svg>
    </AbsoluteFill>
  );
};
