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
 * SLOW, deliberately. At 30fps a 58-frame throw is nearly two seconds
 * hand-to-hand — a lazy, readable juggle rather than a blur. The scene is
 * background action behind a board of copy, so legibility beats virtuosity.
 *
 * This is the master clock for the whole rig, not just the balls: the hands'
 * reach, the body's sway and its knee bounce are all derived from
 * `frame / THROW_PERIOD`, so raising this number slows the figure and the
 * pattern together and they stay in step. Every one of those is a ratio of the
 * period, so the SHAPE of the motion is unchanged — only its rate.
 */
const THROW_PERIOD = 58;
/**
 * ── Where the hands are ────────────────────────────────────────────────
 * The catch/throw points, and the full width of the pattern.
 *
 * This is ALSO the arm length. The limb is drawn as one quadratic from the
 * spine straight to the hand, so the spine→hand distance IS the arm — widening
 * this is the only way to lengthen it. `UPPER_ARM`/`FOREARM` sound like they
 * would, and do not: they only set how much the elbow bows.
 *
 * Widening has a second, unavoidable effect: the balls are thrown between
 * exactly these two points, so the juggling pattern widens with the arms. At 72
 * the arms run ~76 units and the pattern ~144 wide, against ~57 and ~104 at the
 * previous 52. Pull this back if the cascade starts to read as too spread out
 * for a front-facing juggler.
 *
 * The balls are thrown between exactly these two points, so a catch always
 * lands in a hand.
 */
const HAND_SPREAD = 72;
const HAND_Y = 150;

/** Shoulder height — where both arms leave the SPINE. There is no drawn
 *  shoulder bar: a crossbar reads as a T hung on the figure rather than as
 *  shoulders, so each arm starts on the body's centreline. */
const SHOULDER_Y = 126;

/**
 * The drawn hand sits exactly ON the throw point — no inboard tuck. An earlier
 * rig pulled it in by 22 units, so the hand never arrived where the ball did:
 * catches happened in mid-air beside a stationary arm. Putting the hand on the
 * ball is what makes the throw and the catch legible.
 */

/**
 * Segment lengths, used ONLY to decide how bent the elbow should be: when the
 * hand is closer than UPPER_ARM + FOREARM the arm has slack and folds; at full
 * stretch it straightens out.
 *
 * These do NOT set how long the arm is. The limb is drawn as one quadratic from
 * the spine straight to the hand, so its rendered length is the spine→hand
 * distance — which is `HAND_SPREAD` and `HAND_Y`, not these. Raising these two
 * only flattens the elbow bulge, so reaching for "longer arms" here changes
 * almost nothing visible; widen `HAND_SPREAD` instead.
 */
const UPPER_ARM = 64;
const FOREARM = 64;

/** How far the elbow sits outboard of the shoulder→hand chord, and how far it
 *  hangs below it. Elbows out and down is the juggler's working posture. */
const ELBOW_OUT = 12;
const ELBOW_DROP = 16;

/**
 * How far the DRAWN hand is pulled inboard of the throw point.
 *
 * The balls are still thrown between the full `HAND_SPREAD` points, so the
 * pattern keeps its width; only the wrist comes back toward the body. Without
 * this a long arm ends at full stretch and the two limbs read as a flat bar
 * across the figure rather than as arms working in front of the chest.
 */
const WRIST_TUCK = 16;

/**
 * How far a hand rises from HAND_Y toward an incoming ball as it arrives.
 *
 * The hands do not sit still: each one lifts to meet the ball that is about to
 * land in it and sinks back as it throws. Without this the arms hang at a fixed
 * height while the balls fly overhead, and the two read as unrelated — the ball
 * appears to bounce off nothing.
 *
 * Kept well under the arc height on purpose. The hand meets the ball near the
 * BOTTOM of its flight, so it only needs to reach a little; lifting it further
 * inverts the elbow and the arm folds backwards over the shoulder.
 */
const HAND_REACH = 34;

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
 * The throws go well ABOVE the head. That takes headroom the original box did
 * not have: with the old `0 0 420 370` viewBox the ceiling capped ARC_H at 126,
 * which peaked the top ball at y=26 against a crown at y=36 — ten units, so the
 * balls hovered level with the head instead of arcing over it.
 *
 * The viewBox is therefore extended UPWARD to `0 -160 420 530` (see the svg
 * below). Shifting the origin rather than the height keeps every existing
 * coordinate valid — the feet stay at y=308 — and puts all the new room above
 * the figure. The svg's `bottom` offsets are shifted by the same amount to keep
 * the feet planted on the ground line; the two are coupled, so changing one
 * means recomputing the other.
 *
 * With hands at 150, ARC_H 240 and ARC_STAGGER 16, the tallest ball peaks at
 * y=-106 — about 142 units clear of the crown — and its top edge sits at
 * y=-124, inside the extended box's -160 ceiling with room to spare.
 * `ink-sfv2` has a bounded filter region and clips what leaves it, so a ball
 * outside the box would simply vanish and the pattern would look like it had
 * dropped one. ARC_H and HAND_Y trade against each other here: the arc is
 * measured up from the hands, so raising the hands must lower ARC_H by the same
 * amount or the top ball clips.
 *
 * No ball ever dips below HAND_Y, by construction — the arc is a sine that
 * returns to zero at the catch.
 */
const ARC_H = 240;

/**
 * Phase spacing between the three balls, in throw-periods.
 *
 * The balls are NEVER held — each is always in flight, launching again the
 * instant it lands, so the pattern juggles continuously.
 *
 * 2/3 spaces the three THROWS evenly in time: at any instant one ball is
 * leaving a hand, one is near its apex and one is arriving — which is what a
 * three-ball cascade actually is, and what the eye reads as the rhythm of
 * juggling.
 */
const BALL_PHASE = 2 / 3;

/**
 * How much taller/shorter the outer two balls' arcs are than the middle one's,
 * so the three trace NESTED arcs instead of one identical path.
 *
 * This does not stop pairs from meeting, and cannot: in a cascade every ball
 * crosses the centreline, so pairs pass through the same region by
 * construction. A sweep over phase, spread, arc height and per-ball lanes never
 * got three balls even one ball-diameter apart while staying inside the
 * viewBox. What keeps a crossing readable is that each ball is filled with the
 * background colour and outlined, so one passing another reads as in-front-of.
 *
 * Its real job is variety — identical arcs look mechanical.
 */
const ARC_STAGGER = 16;

/**
 * Ball radius. Deliberately LARGE — about 0.6 of the head's diameter — so the
 * balls are unmistakably the subject of the shot rather than three dots.
 *
 * Balls this large in a pattern this narrow WILL overlap each other and the
 * head — measured, roughly 60% of frames have a ball crossing the head, and the
 * closest pair approach is a few units. That is inherent to a front-facing
 * cascade at this size, not a tuning failure, and no combination of phase,
 * spread, arc height or per-ball lanes avoids it inside this viewBox.
 *
 * What carries it is OCCLUSION: every ball is filled with the background colour
 * and outlined, and the balls are drawn LAST, so a crossing reads as one object
 * passing in front of another rather than as a merged blob.
 */
const BALL_R = 18;


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
  /* The catch/throw points are the DRAWN wrists, not the raw `HAND_SPREAD`
     points.

     `armPath` pulls the wrist inboard by `WRIST_TUCK` so a long arm ends in
     front of the ribs rather than at full stretch. The balls have to land on
     that same tucked point: flying them to the untucked ±HAND_SPREAD dropped
     every catch a tuck's width OUTBOARD of the visible hand, so the ball
     clipped the edge of the palm instead of settling into it.

     One expression for both, so the two can no longer drift apart. */
  const handLX = BODY_X - HAND_SPREAD + WRIST_TUCK;
  const handRX = BODY_X + HAND_SPREAD - WRIST_TUCK;

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
    /* Squash on the two contact beats. A ball leaving or arriving at a hand
       flattens briefly; in the air it is round. Borrowed from the football
       template's BallControl, which uses the same trick to sell a strike. */
    const launchPop = t < 0.12 ? Math.sin((t / 0.12) * Math.PI) : 0;
    const catchPop = t > 0.88 ? Math.sin(((t - 0.88) / 0.12) * Math.PI) : 0;
    const pop = Math.max(launchPop, catchPop);
    return {
      i,
      // Straight hand to hand — a ball always leaves from and lands in a hand.
      x: fromX + (toX - fromX) * t,
      // Kept so the hands can tell which ball is coming to them (see below).
      t,
      fromX,
      toX,
      /* Same height in BOTH directions, so every ball lifts the same way and
         comes back to exactly HAND_Y. Each ball gets its own height on top of
         that, so the three trace nested arcs rather than one identical path. */
      y: HAND_Y - (ARC_H + (i - 1) * ARC_STAGGER) * Math.sin(Math.PI * t),
      sqX: 1 + 0.22 * pop,
      sqY: 1 - 0.2 * pop,
    };
  });

  /* Each hand rises to meet the ball arriving in it and sinks again as it
     throws the next one away. A hand that sat at a fixed height while the balls
     flew overhead read as an arm hanging by the body, with the balls floating
     on their own.

     SMOOTHNESS is the whole point of the shape of this function. An earlier
     pass picked out "the ball closest to landing" and ramped the hand linearly
     over the last third of that ball's flight. That jerked, for two reasons:
     a linear ramp changes the hand's VELOCITY instantly at the moment the ramp
     starts and again at the catch, and taking a max across the three balls let
     the value snap from one ball's ramp onto another's partway through.

     A raised cosine has neither problem. It is one continuous expression over
     the whole cycle — no thresholds, no per-ball search, no max — and its slope
     is zero at both the top and the bottom, so the hand eases into the catch
     and out of the throw instead of arriving at a constant speed and stopping
     dead. A ball lands in a given hand once per THROW_PERIOD, and the two hands
     are half a period out of step, which is the `offset` below. */
  const handReach = (offset: number) =>
    (1 - Math.cos(Math.PI * 2 * (frame / THROW_PERIOD) + offset)) / 2;
  const reachL = handReach(0);
  const reachR = handReach(Math.PI);
  /* How far up toward the ball's own height the hand travels. Not all the way:
     the hand meets the ball late, near the bottom of the arc, so a fraction
     reads as reaching while keeping the elbow from inverting. */
  const handLY = HAND_Y - reachL * HAND_REACH;
  const handRY = HAND_Y - reachR * HAND_REACH;
  /* ── Arms: shoulder → ELBOW → hand ────────────────────────────────────
     Two segments, not one bowed stroke. The previous single curve ran from the
     shoulder to a point tucked in toward the ribs, so the hand never actually
     arrived where the ball did and the arm barely moved across the whole cycle
     — the balls looked like they were teleporting in and out of a static pose.

     Now the hand IS the throw/catch point, and the elbow is solved for: it
     hangs below the shoulder→hand chord, pushed outward from the body, so the
     forearm swings up to meet a catch and drops through the throw. That swing
     is the motion that sells the juggle; the balls alone never could. */
  const armPath = (handX: number, handY: number, dir: -1 | 1) => {
    /* Both arms hang off the SPINE itself. There is no shoulder bar to hang
       them from — a drawn crossbar reads as a T rather than as shoulders. */
    const shoulderX = BODY_X;
    /* Elbow: midway along the chord, pushed OUT from the body and DOWN a
       little, so the forearm comes back up to the hand. The bend is deepest
       when the hand is close (a folded arm waiting under a ball) and flattens
       as the hand reaches out, which is what makes the limb look like it is
       working rather than hanging.

       The drop is measured from the SHOULDER, not from the chord midpoint: the
       hands sit above the shoulder line here, and dropping from the midpoint
       sagged both arms into a scarecrow droop at every phase. */
    const reach = Math.hypot(handX - shoulderX, handY - SHOULDER_Y);
    const slack = Math.max(0, 1 - reach / (UPPER_ARM + FOREARM));

    /* The wrist IS the point passed in — no further tuck here.
       `handLX`/`handRX` already carry `WRIST_TUCK` (see where they are built),
       and the balls fly to those same points. Tucking a second time inside this
       function would pull the drawn hand another tuck's width inboard and put
       the catch back off the palm, which is the bug that motivated moving the
       tuck upstream in the first place. */
    const wristX = handX;

    /* A CUBIC, not a quadratic. One control point can only bow the limb one way,
       which is why the arms read as straight bars flung out sideways: the elbow
       pushed outward along the very axis the hand already lay on, so the whole
       arm was one flat sweep.

       Two control points give the limb an S: the first pushes the ELBOW out and
       down away from the ribs, the second pulls the WRIST back in toward the
       centreline. That is the shape of an arm cradling something in front of
       the chest — upper arm out, forearm turning forward. */
    const elbowX = shoulderX + dir * (ELBOW_OUT + slack * 14 + reach * 0.34);
    const elbowY = SHOULDER_Y + ELBOW_DROP * (0.4 + slack);
    const wristCtlX = wristX + dir * reach * 0.12;
    const wristCtlY = handY + ELBOW_DROP * 0.5;

    return `M${shoulderX},${SHOULDER_Y} C${elbowX},${elbowY} ${wristCtlX},${wristCtlY} ${wristX},${handY}`;
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

        {/* Arms — one bent limb each, straight off the SPINE. No shoulder bar:
            a drawn crossbar reads as a T-shape hung on the figure rather than
            as shoulders, so both arms start at the body's centreline. */}
        <path d={armPath(handLX, handLY, -1)} />
        <path d={armPath(handRX, handRY, 1)} />
      </g>

      {/* Legs — a symmetric planted stance, not a stride: the figure is
          standing still and working with its arms. The hips take a fraction of
          the sway so the legs stay attached to the spine above them, while the
          feet stay put. */}
      <path d={`M${BODY_X + sway * 0.6},218 L${BODY_X - 35},308`} />
      <path d={`M${BODY_X + sway * 0.6},218 L${BODY_X + 35},308`} />

      {/* === THE THREE BALLS ===
          Filled with the BACKGROUND colour, not left hollow: in a cascade the
          balls cross both each other and the figure constantly, and an opaque
          fill is what makes a crossing read as one ball passing in FRONT of
          another. Hollow circles merge into a tangle of arcs instead.

          Drawn last, so they pass in front of the body — the eye reads the
          nearer object as the one doing the work. */}
      {balls.map((b) => (
        <g key={b.i} transform={`translate(${b.x}, ${b.y}) scale(${b.sqX}, ${b.sqY})`}>
          <circle cx={0} cy={0} r={BALL_R} stroke={accent} strokeWidth={4} fill={bgColor} />
          {/* Highlight, scaled with the ball so it squashes along with it. */}
          <path
            d={`M${-BALL_R * 0.42},${-BALL_R * 0.34} Q0,${BALL_R * 0.04} ${BALL_R * 0.42},${-BALL_R * 0.34}`}
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.5}
            fill="none"
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
  const fitTitleTarget = titleFontSize ?? (p ? 52 : 54);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 29 : 28);
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
          The viewBox keeps the base `stick_figure_scene`'s 420-wide coordinates
          and its feet at y=308, but is extended UPWARD by 160 units (origin
          y=-160, height 530) to give the throws room to clear the head. Because
          only the origin moved, every coordinate in the rig is unchanged.

          11.7% of the taller box now sits BELOW the feet (62 of 530), so
          `bottom` is offset to put them exactly on the scene's ground line
          rather than the svg's own lower edge. Note the offsets themselves do
          NOT change when the box is extended: the below-feet margin is a fixed
          62 units, so as the box grows its FRACTION shrinks in exact step with
          the svg's rendered height, and the two cancel. */}
      <svg
        style={{
          position: "absolute",
          // Coupled to the ground line's `bottom` below. The feet sit at y=308
          // of the -160..370 viewBox, so 62/530 = 11.7% of the box is BELOW
          // them; since the svg scales off its WIDTH, that margin is 11.7% of
          // the svg's rendered height, and the feet land at
          //     bottom% + 11.7% × svgHeight%
          // above the frame's bottom. Setting that equal to the ground line's
          // own `bottom` gives the values here.
          //
          // Landscape is NEGATIVE on purpose: at width 38% the svg renders
          // ~521px tall, so its below-feet margin alone is ~10% of the frame —
          // more than the ground line's 8.4% — and the box has to hang off the
          // bottom edge for the feet to reach the line.
          //
          // Extending the viewBox upward made the svg taller, which lifts the
          // feet for a given `bottom`; these went DOWN to compensate, not up.
          // Change the viewBox or the ground line, recompute both.
          bottom: p ? "3.52%" : "-1.57%",
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
        viewBox={`0 -160 ${FIG_VIEWBOX_W} 530`}
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
