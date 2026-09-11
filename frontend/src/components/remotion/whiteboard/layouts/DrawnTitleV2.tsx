import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

/**
 * drawn_title__v2 — "Sign Raise".
 *
 * Variant of `drawn_title`. Same props, different composition: the title board
 * is a PRE-BUILT sign — it does not draw itself into being — carried on two
 * thin handles, one at each end. TWO stick figures walk in from the left
 * holding those handles at waist height, stop at centre, and raise the sign up
 * overhead.
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
 * Contact is an invariant, not a tuned number: the sign's tilt and the hands'
 * position are interpolated from the SAME `raise` scalar, so the hands cannot
 * drift off the post mid-lift.
 *
 * Filter IDs carry a `-dtv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

const CHARS_PER_SEC = 30;

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
 * ── The board's CSS box, as fractions of the frame ─────────────────────
 * Named because they are read in three places that must agree: the wrapper's
 * own style, the handle-length derivation, and the `useFitText` budgets.
 */
/* Landscape's top edge is raised (0.16 → 0.10) to buy the taller board its
   room. The board's bottom edge must stay ABOVE the carriers' svg box top
   (frame − GROUND_BOTTOM − FIG_BOX_H), or the panel sits over their heads
   instead of riding above them — so top and height are constrained together
   and cannot be tuned independently. */
const BOARD_TOP_L = 0.10;
const BOARD_TOP_P = 0.08;
const BOARD_H_FRAC_L = 0.48;
const BOARD_H_FRAC_P = 0.46;

/** Where the ground line sits, as a fraction of frame height from the bottom. */
const GROUND_BOTTOM_L = 0.054;
const GROUND_BOTTOM_P = 0.194;

/**
 * Height of the carriers' svg box, as a fraction of frame height. This is what
 * sets the figures' on-screen size (under `meet` the scale is
 * min(boxW/300, boxH/124)) AND, through `s`, the rig-unit → px conversion the
 * sign's transform depends on — so it is named rather than repeated, and the
 * style below reads it instead of carrying its own literal.
 *
 * Landscape runs larger than portrait: the 16:9 frame gives the pair far more
 * horizontal room than vertical, so at the portrait fraction they read as small
 * against a board that spans most of the width.
 */
const FIG_BOX_H_L = 0.36;
const FIG_BOX_H_P = 0.223;

/**
 * How far in from each end of the board its handle is mounted, as a fraction of
 * the board's width. The carriers stand under their own handle, so this also
 * sets how far apart the pair walks. Handles right at the corners would look
 * like the board is being pinched; a tenth in reads as a mounted grip.
 */
const HANDLE_INSET = 0.2;

/**
 * ── Carry geometry, in rig-local units ─────────────────────────────────
 * The board's UNDERSIDE while walking, and once raised.
 *
 * Both are above the head's crown (y=8): a board carried by handles hangs from
 * the fists but its panel rides ABOVE the carriers, and one at head height
 * would simply occlude them. Walking, it clears the crown by a few units;
 * raised, it lifts clear of the figures entirely.
 *
 * The handles bridge the gap from the board's underside down to the fist, so
 * their length is (grip handY − board Y) — see `handleLenPx`. Both ends of that
 * subtraction move on the same `raise`, which is what keeps the fist on the end
 * of the handle rather than floating off it.
 */
const CARRY_BOARD_Y = 44;
/* The raised height. Its distance from CARRY_BOARD_Y is the board's TRAVEL, and
   that travel must equal the hand's (GRIP_DOWN.handY − GRIP_UP.handY) — the
   handle is a rigid, constant-length link, so if the two disagree the fist
   slides off its end mid-lift. Change this and GRIP_UP.handY together, by the
   same amount, or the linkage breaks. */
const HOLD_BOARD_Y = -6;

/**
 * Stride cadence copied verbatim from the base `drawn_title`: `frame * 0.22 *
 * speed` with speed 0.9. Same rate, same phase, same knee action.
 *
 * The GROUND speed is faster than the base's shuffle. The base drifts its figure
 * about half a body-width per stride, which never crosses a frame; carrying the
 * board in at that rate would take ~6s and a scene can be as short as 5s
 * (`FPS * 5` in WhiteboardVideo).
 *
 * The stride length is what buys the schedule. The whole beat — walk in, turn,
 * raise, settle — has to finish inside 150 frames with margin, and at 2.8
 * body-widths the walk alone ate 89 of them, pushing the raise past frame 129.
 * At 4.2 the pair arrives around frame 60 and the sign is up by ~100, leaving
 * the last third of even the shortest scene to read the finished board. The
 * reused leg cycle still tracks: this is a brisk, purposeful carry rather than
 * a skate, because the cadence is unchanged and only the distance per cycle
 * grows.
 */
const WALK_SPEED = 0.9;
const WALK_CYCLE_RATE = 0.22 * WALK_SPEED;
/** Frames per full leg cycle at the base's cadence. */
const STRIDE_FRAMES = (2 * Math.PI) / WALK_CYCLE_RATE;
/** Rig body width in track units, and how far one stride carries it. */
const BODY_W = 28;
const UNITS_PER_STRIDE = BODY_W * 4.2;

/** Frame the pair finishes walking and comes to rest in the centre. */
const ARRIVE_FRAME = Math.round(
  ((WALK_TO - WALK_FROM) / UNITS_PER_STRIDE) * STRIDE_FRAMES,
);
/** How long the walk→face-forward turn takes once they have arrived. */
const TURN_BLEND = 16;
/** Beat after the turn before the lift begins. */
const RAISE_DELAY = 2;
/** How long the pivot-up takes. */
const RAISE_DUR = 22;

const RAISE_START = ARRIVE_FRAME + TURN_BLEND + RAISE_DELAY;
const RAISE_END = RAISE_START + RAISE_DUR;

/**
 * ── Grip geometry, in rig-local units ──────────────────────────────────
 * Where the carriers' hands are on their handle. Both ends of the motion are
 * expressed here, and the HANDLE'S BOTTOM is placed from the same numbers, so
 * hands and sign are two views of one scalar (`raise`) and cannot drift apart.
 *
 * Carry (raise=0): hands down at the side, about waist height — how you carry
 * something heavy by a handle while walking.
 * Raised (raise=1): arms extended up and slightly out, sign held overhead. The
 * head spans x=36..64 at r=14, so a hand at x≈76 clears it comfortably;
 * pressing straight up would drive the forearms through the skull.
 */
const GRIP_DOWN = { upperX: 66, upperY: 58, handX: 74, handY: 78 };
/* handY moves in lockstep with HOLD_BOARD_Y (see the note there): both travel
   50 units, so the handle stays a fixed length and the fist stays on it.
   upperY (the elbow) is scaled to the SAME proportion of the hand's travel it
   had before — a fixed offset would straighten the arm out as the lift shrank. */
const GRIP_UP = { upperX: 70, upperY: 39, handX: 74, handY: 28 };

/**
 * One carrier. Authored entirely in UNMIRRORED local space; `side` only decides
 * whether the finished rig is flipped, so no coordinate below ever has to be
 * reasoned about in two orientations at once.
 *
 *  - `walk`   1 → 0 across the arrival, so legs, bob and lean settle together.
 *  - `facing` 0 → 1 squares the body to camera (spine straightens, feet spread).
 *             The head stays featureless throughout, as in the base rig.
 *  - `lift`   0 → 1 sweeps the arms from the low grip up the raised post.
 *
 * Note the arms do NOT swing during the walk. They are held ready to take the
 * post, and a carrier whose arms pump while walking up to a sign they are about
 * to lift reads as two unrelated actions. Legs, cadence and bob still match the
 * base rig exactly.
 */
const Carrier: React.FC<{
  color: string;
  cycle: number;
  walk: number;
  facing: number;
  lift: number;
  bob: number;
  /** Which way the BODY points. */
  side: -1 | 1;
  /**
   * Which way the CARRYING ARM reaches, relative to the body. +1 = the rig's
   * own forward side, -1 = across the body.
   *
   * Separate from `side` because the front and back carrier face OPPOSITE
   * directions while both still gripping the same load between them: the front
   * one looks out along the direction of travel and reaches back, the back one
   * looks in at the load and reaches forward. Folding the two into one flag
   * forced both figures to face the same way to keep hold of their handles.
   */
  gripSide: -1 | 1;
}> = ({ color, cycle, walk, facing, lift, bob, side, gripSide }) => {
  const getLegPoints = (phaseOffset: number) => {
    const ph = cycle + phaseOffset;
    return {
      thighRotation: Math.sin(ph) * 32 * walk,
      kneeRotation: Math.max(0, Math.sin(ph - Math.PI / 2)) * 40 * walk,
    };
  };
  const legL = getLegPoints(0);
  const legR = getLegPoints(Math.PI);

  /* The rig stays in PROFILE throughout — it never squares up to camera. A
     carrier who turns to face front has to hold the sign across their body,
     which is not what either pose here is doing; staying side-on keeps the
     carrying arm reading as a carrying arm. `facing` therefore only settles the
     stance (feet plant slightly apart when stopped) rather than rotating the
     body. */
  const hipX = 52;
  const footSpread = 4 * facing;

  /* ── Arms: ONE carries, one swings ────────────────────────────────────
     The FORWARD arm holds the handle the whole time, sweeping from a low carry
     up to a raised hold on the same `lift` the sign moves on — so the fist
     stays on the end of the handle.

     The BACK arm is free. It swings with the gait like the base rig's does,
     and settles to the side once the pair stops. Carrying something one-handed
     is exactly why the other arm can swing at all: the earlier two-handed
     version had to freeze both arms, which made the walk read as stiff. */
  const upperX = interpolate(lift, [0, 1], [GRIP_DOWN.upperX, GRIP_UP.upperX]);
  const upperY = interpolate(lift, [0, 1], [GRIP_DOWN.upperY, GRIP_UP.upperY]);
  const handX = interpolate(lift, [0, 1], [GRIP_DOWN.handX, GRIP_UP.handX]);
  const handY = interpolate(lift, [0, 1], [GRIP_DOWN.handY, GRIP_UP.handY]);

  /* Free arm's swing, in degrees about the shoulder. Same `sin(cycle) * 30`
     amplitude the base `drawn_title` uses, faded out with `walk` so it comes to
     rest rather than stopping mid-swing. */
  const freeSwing = Math.sin(cycle) * 30 * walk;

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

        {/* FREE arm — hangs at the far side of the body and swings with the
            gait. Drawn before the legs so it sits behind them, which is what
            puts it on the figure's far side in profile. */}
        <g transform={`rotate(${freeSwing} 50 48)`}>
          <line x1="50" y1="48" x2="46" y2="62" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
          <line x1="46" y1="62" x2="44" y2="78" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
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

        {/* CARRYING arm, gripping the handle. Drawn last so it reads as
            nearest the camera. `gripSide` mirrors it about the shoulder when it
            has to reach ACROSS the body — which is what lets this figure face
            one way while its hand stays on the load. */}
        <g transform={gripSide === 1 ? undefined : "translate(100 0) scale(-1 1)"}>
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

  const raise = interpolate(frame, [RAISE_START, RAISE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /* Each carrier bobs on its own slightly-offset phase — exactly in step reads
     mechanical. 0.35 rad is a natural "two people walking together" offset.
     Both fade out with `walk`, so the pair is steady once they take the post. */
  const bobA = Math.sin(cycle * 2) * 3 * walk;
  const bobB = Math.sin((cycle + 0.35) * 2) * 3 * walk;

  /* The sign takes the MEAN of the two carriers' bobs. The mean of two sines of
     equal frequency is itself a clean sine, so the sign rides smoothly rather
     than fighting two masters, and the residual gap to either hand stays well
     under a stroke width — which reads as the give in a shared carry. */
  const carryBob = (bobA + bobB) / 2;

  /* Settle: a small overshoot as the raise tops out, so the sign arrives with
     some weight rather than easing to a dead stop. Tiny — the board carries the
     copy, so legibility beats liveliness. */
  const settle =
    Math.sin(
      interpolate(frame, [RAISE_END, RAISE_END + 12], [0, Math.PI], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ) * -1.4;
  /* A slow breathing strain on the held pose so it isn't frozen. */
  const strain = ((1 - Math.cos(frame * 0.06)) / 2) * 0.9 * raise;

  /* ── Rig-unit → page-px scale ─────────────────────────────────────────
     The figure svg spans the full frame on a 300×124 viewBox under
     `xMidYMax meet`, so its scale is min(boxW/300, boxH/124) px per rig unit.
     Everything above is authored in rig units; this is what carries those
     numbers over to the DOM board. */
  const figBoxH = height * (p ? FIG_BOX_H_P : FIG_BOX_H_L);
  const s = Math.min(width / FIG_TRACK_W, figBoxH / FIG_TRACK_H);
  /* MUST match the figure svg's own `bottom` below — the post's foot is derived
     from it, so the two drifting apart would float the sign off the ground.
     Portrait sits the whole staging higher up the tall frame. */
  const figBottomPx = height * (p ? 0.2 : 0.06);

  /* Half the distance between the carriers, in track units. Derived from the
     board's real width so each stands under its own END of the sign — the board
     is far wider than the figure track, and the two differ enough between
     orientations that a single constant would put the pair under the board's
     middle in one of them. The handles then follow the fists (see
     `handleFracBack` / `handleFracFront`), rather than the fists having to find
     fixed handles. */
  const boardWidthPx = width * (p ? 0.86 : 0.64);
  /* Each figure stands OUTBOARD of its own handle by exactly the reach of its
     carrying arm, and is mirrored to face inward — so the near one reaches
     right and the far one reaches left, both landing on the handle between
     them. Subtracting the reach here is what puts the fist ON the handle
     rather than a body-width past it. */
  /* Each figure stands OUTBOARD of its own handle by exactly the reach of its
     carrying arm, and is mirrored to face inward — so the near one reaches
     right and the far one reaches left, both landing on the handle between
     them. The reach is subtracted because each rig's carrying arm reaches
     inboard; the fist then lands exactly on its own handle. */
  const armReachRig = GRIP_DOWN.handX - 50;
  const handleHalfGapRig = (boardWidthPx * (0.5 - HANDLE_INSET)) / s;
  const pairHalfGap = handleHalfGapRig - armReachRig;

  /* ── The sign as ONE box ───────────────────────────────────────────────
     Board, copy and both handles live inside a single wrapper running from the
     board's top edge down past the handles' bottom ends. That wrapper is what
     moves, so the sign is rigid by construction rather than by three siblings
     agreeing on a transform. */
  const boardHeightPx = height * (p ? BOARD_H_FRAC_P : BOARD_H_FRAC_L);
  /* Handle length: from the board's underside down to the carrying fist. Both
     ends move on `raise` by the same amount (the board rises by
     CARRY_BOARD_Y − HOLD_BOARD_Y, the hand by GRIP_DOWN.handY − GRIP_UP.handY),
     so the handle is a CONSTANT length and the fist stays on its end throughout
     — which is the whole point of deriving it rather than picking a number. */
  const handleLenPx = (GRIP_DOWN.handY - CARRY_BOARD_Y) * s;
  const signHeightPx = boardHeightPx + handleLenPx;

  /* Where each handle sits across the board, as a fraction of its width.
     Derived from where the FISTS are, not chosen: the carriers stand
     `pairHalfGap` either side of centre and their fists are a few rig units
     outboard of their own centreline, so this is that position expressed in the
     board's own coordinates. Deriving it is what guarantees the handle lands in
     the hand in both orientations, where the board's width differs. */
  /* Where each handle sits across the board, as a fraction of its width.
     DERIVED from where the fist actually is, not chosen: the carrier's body
     centre is at `pairHalfGap` from the sign's centre and its fist reaches
     `armReachRig` inboard of that, so the fist — and therefore the handle — is
     at (pairHalfGap − armReachRig) rig units in. Converting that to the board's
     own width is what guarantees the handle lands in the hand in BOTH
     orientations, where the board's width differs. Setting the two from
     independent constants left the fists visibly inboard of the handles. */
  /* Each handle sits where ITS OWN carrier's fist lands, so the two are not
     necessarily symmetric about the board's centre.

     The fist's offset from the body centre depends on BOTH mirrors: `side`
     flips the whole rig and `gripSide` flips the carrying arm within it, so the
     net direction is their product. The back figure (side=+1, gripSide=+1)
     reaches +armReach; the front one (side=-1, gripSide=-1) also nets +1 in its
     own frame but is drawn mirrored, so in page space it reaches the other way.
     Expressing each handle from its own carrier's net reach is what keeps both
     fists ON their handle — a single symmetric inset put one of them off. */
  const handleFracFor = (bodyX: number, netReach: number) =>
    0.5 + ((bodyX - WALK_TO + netReach) * s) / boardWidthPx;
  /* Back carrier is at −pairHalfGap and reaches inboard (+); front carrier is
     at +pairHalfGap and, being mirrored, also reaches inboard (−). */
  /* Both carriers stand identically, so both fists land the same way relative
     to their own body and one reach sign serves both. The two fractions are
     still computed separately because each is anchored to its OWN carrier's
     position, which is what keeps the handles on the hands as the pair walks
     in. */
  /* Trimmed by the stroke half-width so the handle passes through the middle
     of the drawn fist rather than just past its outer edge. */
  const gripNudge = 3;
  const handleFracBack = handleFracFor(WALK_TO - pairHalfGap, armReachRig - gripNudge);
  const handleFracFront = handleFracFor(WALK_TO + pairHalfGap, armReachRig - gripNudge);

  /* Where the sign's UNDERSIDE (the board's bottom edge) should be this frame,
     in rig units — interpolated on the same `raise` as the hands, so the
     handles' lower ends stay in the carriers' fists throughout. */
  const boardTargetY =
    interpolate(raise, [0, 1], [CARRY_BOARD_Y, HOLD_BOARD_Y]) + carryBob + settle - strain;

  /* Where the board's underside sits AT REST, in rig units.
     The box is positioned by CSS percentages of the frame, so this is a pure
     function of the frame size — no DOM measurement needed, and crucially none
     wanted: `getBoundingClientRect()` reports the element AFTER its transform,
     and since that transform is what we are computing, feeding the rect back in
     would form a feedback loop that walks the sign off-screen every frame. */
  const boardTopPx = height * (p ? BOARD_TOP_P : BOARD_TOP_L);
  const boardBottomRigY =
    FIG_TRACK_H - (height - figBottomPx - (boardTopPx + boardHeightPx)) / s;

  /* The sign's transform delta. x is 0 on arrival by construction (the pair
     stops at track centre, which is where the sign's CSS box already is), so
     only the entrance offset and the vertical carry need expressing. */
  const signDX = (midX - WALK_TO) * s;
  const signDYRaw = (boardTargetY - boardBottomRigY) * s;
  /* Clamp so the raise can never drive the sign off the top of the frame. The
     board's CSS top is where it sits at REST, and the raise lifts it from
     there, so the ceiling is that top less a small margin. */
  const signDY = Math.max(signDYRaw, -(boardTopPx - height * 0.015));

  /* ── Copy reveal ───────────────────────────────────────────────────────
     The sign is PRE-BUILT — it does not draw itself — so the copy can start
     writing on immediately rather than waiting for a frame to appear first. */
  const groundProgress = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleStart = 8;
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
     and still overflow the board together. Padding and the divider take ~18% of
     the board, leaving roughly 55/27 to split between title and narration.

     NOTE: `frame` must never enter these dep arrays. The hook probes layout and
     gates on delayRender; re-running it per frame would thrash the renderer.
     The board is animated purely by `transform`, which does not affect layout,
     so the measurements below stay valid for the whole scene. */
  const boardH = boardHeightPx;
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNoteRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 62 : 51);
  const fitNoteTarget = descriptionFontSize ?? (p ? 32 : 27);
  /* ── The copy box, measured rather than guessed ──────────────────────
     `useFitText` checks ONE element against ONE budget and cannot know what
     else shares the board, so two budgets that each pass can still overflow it
     together. Here 0.55 + 0.27 of the board left only 0.18 for padding — but
     the copy box below pads `4%` and gaps `2.5%`, and BOTH resolve against the
     container's WIDTH, not its height. On an ~1536px-wide board that is ~123px
     of vertical space unaccounted for: landscape needed 530px inside a 497px
     board, so long copy spilled past the frame.

     Derive the usable height once, from the same px values the box uses, and
     split that. */
  const boardPadYPx = Math.round(boardH * (p ? 0.06 : 0.05));
  const boardGapPx = Math.round(boardH * (p ? 0.04 : 0.035));
  const copyInnerHPx = Math.max(1, boardH - boardPadYPx * 2 - boardGapPx);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    /* Shares of the USABLE inner height summing to 0.96, not 1.0. The 4% slack
       absorbs per-term `Math.round` drift and browser line-height rounding, so
       the pair lands inside the box rather than exactly on its edge. */
    Math.round(copyInnerHPx * 0.64),
  );
  const { px: fitNotePx } = useFitText(
    fitNoteRef,
    fitNoteTarget,
    descriptionFontSizeIsUserSet ? fitNoteTarget : Math.round(fitNoteTarget * 0.5),
    [narration, fitNoteTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(copyInnerHPx * 0.32),
  );

  /* The board frame svg, its copy box and the post must all move as ONE rigid
     object — they are a single physical sign — so they share this box geometry,
     the same transform and the same pivot origin.
     The box is centred horizontally: the post rises from its bottom-centre and
     the carriers stand either side of that post, so any left/right bias in the
     box would put the sign off the pair. */
  /* The ONE box that moves: board + copy + both handles, translated as a rigid
     unit. The box is centred horizontally, since the pair stops at track centre
     and the sign rides between them. */
  const signWrapper: React.CSSProperties = {
    position: "absolute",
    left: p ? "7%" : "18%",
    top: `${(p ? BOARD_TOP_P : BOARD_TOP_L) * 100}%`,
    width: p ? "86%" : "64%",
    height: signHeightPx,
    transform: `translate(${signDX}px, ${signDY}px)`,
    willChange: "transform",
    zIndex: 6,
  };
  /* The board's own slot INSIDE that wrapper: full width, occupying the top
     `boardHeightPx` and leaving the rest for the handles. */
  const boardBox: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: boardHeightPx,
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

      {/* ── The sign: board + copy + two thin carrying handles ──────────
          One wrapper holds all three, so they move as a rigid object. */}
      <div style={signWrapper}>
        {/* Two thin handles, one under each end of the board, running down to
            the carriers' fists. Deliberately THIN — they are grips, not posts;
            a thick shaft reads as a signpost planted in the ground, which is
            not what is happening here.

            Their inset matches HANDLE_INSET, the same constant that decides how
            far apart the pair walks, so each carrier is always directly under
            the handle they are holding. */}
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: boardHeightPx,
            width: "100%",
            height: handleLenPx,
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 1,
          }}
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <g filter="url(#inkBoard-dtv2)" fill="none" strokeLinecap="round">
            {[handleFracBack, handleFracFront].map((f) => (
              <line
                key={f}
                x1={f * 1000}
                // Starts above 0 so it tucks up behind the board's bottom rail
                // with no seam at the join.
                y1={-8}
                x2={f * 1000}
                y2={100}
                stroke={textColor}
                strokeWidth={4}
                strokeOpacity={0.8}
                // The box is stretched by preserveAspectRatio="none", so a
                // stroke drawn here would be scaled unevenly; this keeps the
                // handle the same visual thickness in both orientations.
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>

        {/* Hand-drawn board face. PRE-BUILT — it does not draw itself on; it
            is a finished object the figures are already carrying. */}
        <svg
        style={{
          ...boardBox,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 2,
        }}
        viewBox="0 0 1000 460"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g filter="url(#inkBoard-dtv2)" strokeLinecap="round">
          {/* Solid white face, so the board reads as a physical panel rather
              than an outline the paper shows through. */}
          <rect
            x={6}
            y={6}
            width={988}
            height={448}
            rx={10}
            fill="#FFFFFF"
            fillOpacity={0.96}
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
          />
        </g>
        {/* Accent tick marks in the board's top corners */}
        <g stroke={accentColor} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.5}>
          <path d="M40,44 L82,44 M40,44 L40,86" />
          <path d="M960,44 L918,44 M960,44 L960,86" />
        </g>
      </svg>

        {/* Title + narration, both written INSIDE the board. Position/size MUST
            stay in lockstep with the board frame svg above — this box is the
            frame's interior, hence the shared `boardBox`. */}
        <div
        style={{
          ...boardBox,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          /* Vertical gap and padding in PX, horizontal stays a percentage: a
             percentage resolves against WIDTH for BOTH axes, so on a board far
             wider than it is tall the vertical insets came out much larger than
             intended and the text budgets above could not see them. These are
             the same values `copyInnerHPx` subtracts, so the box and the
             budgets can no longer disagree. */
          gap: `${boardGapPx}px`,
          padding: `${boardPadYPx}px ${p ? "7%" : "6%"}`,
          boxSizing: "border-box",
          textAlign: "center",
          zIndex: 3,
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
      </div>

      {/* The two carriers. The svg spans the FULL frame width so the walk can be
          expressed in frame-relative units. Under `meet` the scale is
          min(boxW/300, boxH/124), so this height is what sets the figures' size
          — and it is the SAME value `figBoxH` reads to build `s`, which is what
          converts the rig-unit choreography into the sign's page-px transform.
          The two must not diverge or the sign will float off the hands. */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "20%" : "6%",
          left: 0,
          width: "100%",
          height: `${(p ? FIG_BOX_H_P : FIG_BOX_H_L) * 100}%`,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 20,
        }}
        viewBox={`0 0 ${FIG_TRACK_W} ${FIG_TRACK_H}`}
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        aria-hidden
      >
        {/* Each carrier is translated to its own side of the post. The rig is
            drawn about local x=50, so subtracting 50 centres it.

            The two face OPPOSITE ways, as a real pair carrying a load between
            them does: the FRONT (left) one faces outward in the direction of
            travel, the BACK (right) one faces inward toward the load. Both
            still reach the handle, because each rig's carrying arm is on its
            own inboard side either way — the mirror decides which way the body
            points, not where the fist lands. */}
        <g transform={`translate(${midX - pairHalfGap - 50}, 0)`}>
          <Carrier
            color={textColor}
            cycle={cycle}
            walk={walk}
            facing={facing}
            lift={raise}
            bob={bobA}
            /* BACK of the pair (they walk rightward, so the LEFT figure
               trails). It faces IN — rightward, at the load ahead of it — and
               its carrying arm reaches forward on its own natural side. */
            side={1}
            gripSide={1}
          />
        </g>
        <g transform={`translate(${midX + pairHalfGap - 50}, 0)`}>
          <Carrier
            color={textColor}
            cycle={cycle + 0.35}
            walk={walk}
            facing={facing}
            lift={raise}
            bob={bobB}
            /* FRONT of the pair. Identical stance to the back one — same body
               orientation, same carrying arm — because both are walking the
               same way and holding the same load the same way. Mirroring this
               figure threw its arm out in front of it, which read as a
               different action rather than the same one. */
            side={1}
            gripSide={1}
          />
        </g>
      </svg>

      {/* Ground line under the figures and the post's foot. Both the post's
          length and the figure svg's own `bottom` are derived from this, so it
          is the scene's single ground reference. */}
      <svg
        style={{
          position: "absolute",
          bottom: `${(p ? GROUND_BOTTOM_P : GROUND_BOTTOM_L) * 100}%`,
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
