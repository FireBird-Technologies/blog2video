import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";
import { useFitText } from "../components/useFitText";

/**
 * ending_socials__v2 — "Signboard".
 *
 * Variant of `ending_socials`. Same props, different composition: a two-column
 * stage sharing ONE ground line. The left column carries the hand-drawn
 * signboard on two posts with the title written on it and the subtext
 * underneath; the right column has the CTA cards, each planted on its own post
 * in the same ground. The socials sit centred in a drawn row along the bottom,
 * spanning both columns.
 *
 * A stickman rides a unicycle across the scene, entering from the right and
 * exiting left — the only moving figure, passing IN FRONT of the planted signs.
 *
 * Portrait stacks the two columns vertically, CTAs on top and the big board
 * with its posts beneath — side-by-side columns are unreadable at 9:16.
 *
 * ── The single ground line ─────────────────────────────────────────────
 * Every planted thing terminates on ONE line, which is why it lives outside
 * both columns rather than being drawn per-column. Rather than relying on flex
 * to stretch every stake down to it — which collapsed to zero height somewhere
 * in the nesting every time it was tried — each post's LENGTH is computed from
 * the same GROUND_BOTTOM fraction the line itself is positioned by, so posts,
 * card stakes and the unicycle's wheel all meet the same y by construction.
 *
 * `resolveCtas` + `SocialIcons` are reused verbatim so multi-CTA behaviour and
 * platform handling match the base exactly.
 *
 * Filter IDs carry a `-esv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

// The board carries both the title and the subtext, so it is deeper than a
// title-only sign would be.
//
// The RATIO is what matters: the board is rendered at its column's full width
// with `height: auto`, so BOARD_H/BOARD_W sets how tall it comes out. It also
// feeds `signBoardHPx`, from which the posts' length and the CTA column's
// vertical centring are derived — so deepening the board here automatically
// shortens the posts to keep their feet on the same ground line.
const BOARD_W = 900;
const BOARD_H = 540;
const BOARD_PERIMETER = 2 * (BOARD_W + BOARD_H);

/**
 * Where the shared ground line sits, as a fraction of frame height from the
 * bottom. The stage's own bottom padding is set to match, so the flex row's
 * bottom edge — and therefore every column's feet — lands on it.
 */
const GROUND_BOTTOM_L = 0.22;
/* Portrait keeps a DEEPER strip below the ground than it first appears it
   should: the 9:16 frame is tall, and sitting the line near the very bottom
   left the rider crammed against the socials footer with the board's posts
   stretched most of the frame. Lifting it gives the rider room to read and
   shortens the posts to a believable length. */
const GROUND_BOTTOM_P = 0.2;

/**
 * ── The unicyclist's crossing ──────────────────────────────────────────
 * Right → left, LINEAR. The wheel's rotation is derived from the distance
 * travelled (see `wheelSpin` below) rather than being a free-running spin, so
 * the wheel cannot slip against the ground — the same principle that keeps the
 * template's walking figures from skating.
 *
 * The crossing is paced to fill the whole scene rather than darting across it:
 * it starts almost immediately and finishes at frame 290. The rider is
 * background texture behind the signs, and a fast one pulls the eye off the
 * copy.
 *
 * Note the crossing may now outlast a scene cut to the 150-frame floor
 * (`FPS * 5` in WhiteboardVideo) — the rider simply exits mid-stride on a very
 * short scene, which reads fine, rather than the whole scene being paced around
 * the shortest possible cut.
 */
const RIDE_START = 4;
const RIDE_END = 290;
/** Rider track viewBox. Wide enough that both ends sit fully off-stage. */
const RIDE_VIEW_W = 1000;
const RIDE_VIEW_H = 260;
const RIDE_FROM = RIDE_VIEW_W + 120;
const RIDE_TO = -160;
/** Wheel radius in track units; the hub sits one radius above the ground. */
const WHEEL_R = 40;
/** Ground y within the rider's viewBox — the wheel's contact point. */
const RIDE_GROUND_Y = RIDE_VIEW_H - 6;
/** Hub centre, one radius up from the contact point. */
const HUB_Y = RIDE_GROUND_Y - WHEEL_R;

/** Where the arms attach, horizontally — on the spine, not beside it. */
const SHOULDER_X = -3;
/**
 * How far BELOW the top of the spine the shoulder joint sits. The head is
 * centred another ~20 above that, so a drop of 10 puts the arms clearly on the
 * torso; attaching them at the spine's top made them appear to hang off the
 * neck.
 */
const SHOULDER_DROP = 10;

/**
 * A stickman on a unicycle, drawn about a local x=0 so the caller can place it
 * by a single translate.
 *
 * Everything above the hub — seat post, body, arms — leans as one about the
 * CONTACT POINT, which is how a real rider balances: the whole machine tips,
 * not just the torso. The legs are excluded from that group and instead track
 * the pedals, so the feet stay on the cranks through the lean.
 *
 * `spin` is degrees of wheel rotation, derived by the caller from distance
 * travelled — this component never invents its own rate, so the wheel cannot
 * slip against the ground.
 */
const Unicyclist: React.FC<{
  ink: string;
  accent: string;
  spin: number;
  lean: number;
  frame: number;
}> = ({ ink, accent, spin, lean, frame }) => {
  /* Pedal positions: the two cranks are half a turn apart and rotate WITH the
     wheel, so the feet rise and fall in step with the rolling. */
  const rad = (spin * Math.PI) / 180;
  const CRANK_R = 17;
  const pedal = (phase: number) => ({
    x: Math.cos(rad + phase) * CRANK_R,
    y: HUB_Y + Math.sin(rad + phase) * CRANK_R,
  });
  const pedalNear = pedal(0);
  const pedalFar = pedal(Math.PI);

  const hipY = HUB_Y - 64;
  const shoulderY = hipY - 46;

  /* Knees: placed forward of the hip and above the pedal, so each leg reads as
     a bent limb driving the crank rather than a straight line to the foot. */
  const knee = (pd: { x: number; y: number }) => ({
    x: (pd.x + 0) / 2 + 22,
    y: (pd.y + hipY) / 2,
  });
  const kneeNear = knee(pedalNear);
  const kneeFar = knee(pedalFar);

  return (
    <g>
      {/* Rider + frame, leaning as one about the wheel's contact point. */}
      <g transform={`rotate(${lean} 0 ${RIDE_GROUND_Y})`}>
        {/* Seat post and saddle */}
        <line x1={0} y1={HUB_Y} x2={0} y2={hipY + 6} strokeWidth={5} />
        <line x1={-13} y1={hipY + 6} x2={13} y2={hipY + 6} strokeWidth={6} />

        {/* Spine and head */}
        <line x1={0} y1={hipY} x2={-4} y2={shoulderY} strokeWidth={5} />
        <circle cx={-6} cy={shoulderY - 20} r={17} strokeWidth={5} />

        {/* Arms out for balance — ONE STRAIGHT line each, shoulder to hand.
            No bend and no bow: a stick figure's arm is a single stroke, and
            every curved or elbowed version of this rig read as a limb doing
            something other than balancing.

            The shoulder joint sits a little BELOW the neck (SHOULDER_DROP), so
            the arms hang off the torso rather than sprouting from the head.

            Each arm paddles slowly, half a cycle apart, on a rhythm slower than
            the pedalling so the balance correction is its own motion rather
            than a second copy of the legs. */}
        {([1, -1] as const).map((dir) => {
          const swing = Math.sin(frame * 0.11 + (dir === 1 ? 0 : Math.PI));
          const shX = SHOULDER_X + dir * 46;
          // Hands sit BELOW the shoulder — the arm angles down and out.
          const handY = shoulderY + SHOULDER_DROP + 22 + swing * 11;
          return (
            <line
              key={dir}
              x1={SHOULDER_X}
              y1={shoulderY + SHOULDER_DROP}
              x2={shX}
              y2={handY}
              strokeWidth={5}
              strokeOpacity={dir === 1 ? 1 : 0.6}
            />
          );
        })}

        {/* Legs — hip → knee → pedal. Drawn inside the lean so they stay
            attached to the hip, and re-targeted every frame at the rotating
            cranks so the feet track the pedals. */}
        <path
          d={`M0,${hipY} L${kneeFar.x},${kneeFar.y} L${pedalFar.x},${pedalFar.y}`}
          strokeWidth={5}
          strokeOpacity={0.55}
        />
        <path
          d={`M0,${hipY} L${kneeNear.x},${kneeNear.y} L${pedalNear.x},${pedalNear.y}`}
          strokeWidth={5}
        />
      </g>

      {/* The wheel. Its rim does NOT lean — the contact point is the pivot, so
          rotating the rim about its own hub is the only motion it needs. */}
      <circle cx={0} cy={HUB_Y} r={WHEEL_R} stroke={accent} strokeWidth={5} />
      <g transform={`rotate(${spin} 0 ${HUB_Y})`}>
        {[0, 60, 120].map((a) => {
          const t = (a * Math.PI) / 180;
          const dx = Math.cos(t) * (WHEEL_R - 4);
          const dy = Math.sin(t) * (WHEEL_R - 4);
          return (
            <line
              key={a}
              x1={-dx}
              y1={HUB_Y - dy}
              x2={dx}
              y2={HUB_Y + dy}
              stroke={accent}
              strokeWidth={3}
              strokeOpacity={0.45}
            />
          );
        })}
        {/* Hub */}
        <circle cx={0} cy={HUB_Y} r={4} stroke={accent} strokeWidth={3} />
      </g>
    </g>
  );
};

export const EndingSocialsV2: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const fade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const boardProgress = interpolate(frame, [4, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [28, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsOp = interpolate(frame, [70, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* The ground is drawn in first, so everything planted on it arrives on a
     floor that already exists rather than appearing to stand on nothing. */
  const groundIn = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── CTA stands ────────────────────────────────────────────────────────
     Each card is a sign planted in the ground: its post draws down into the
     floor and the card settles onto it. They come in STAGGERED rather than
     together — a row of identical cards appearing on the same frame reads as
     one object, not as three separate signs. */
  const CARD_STAGGER = 8;
  const cardIn = (idx: number) =>
    interpolate(frame, [38 + idx * CARD_STAGGER, 60 + idx * CARD_STAGGER], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  /* A slow sway on each planted card. Every sign gets its own PHASE OFFSET, so
     the row moves in a loose ripple instead of as one rigid block. It eases in
     on `cardIn` so the card is steady while it is still settling. */
  const cardWave = (idx: number) =>
    Math.sin(frame * 0.07 + idx * 1.1) * 2.2 * cardIn(idx);

  /* ── The unicyclist ────────────────────────────────────────────────────
     Linear travel, right → left. */
  const rideX = interpolate(frame, [RIDE_START, RIDE_END], [RIDE_FROM, RIDE_TO], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /* Rotation DERIVED from distance travelled: a wheel of radius r rolling a
     distance d turns d/r radians. Deriving it rather than picking a spin rate
     is what guarantees the wheel never slips against the ground, however the
     timing is retuned.

     NEGATED because the rider is rendered mirrored (`scale(-1, …)`) so it faces
     its direction of travel. A mirror flips apparent rotation, so the raw value
     — correct for an unmirrored figure moving left — would spin the wheel
     backwards against the ground once flipped. */
  const wheelSpin = -((rideX - RIDE_FROM) / WHEEL_R) * (180 / Math.PI);
  /* Balance wobble — a rider on one wheel is never perfectly still. Stops once
     the rider is off-stage so there is nothing animating off-frame. */
  const riding = rideX > RIDE_TO && rideX < RIDE_FROM;
  const leanDeg = riding ? Math.sin(frame * 0.1) * 3.5 : 0;

  const subtext = (narration ?? "").trim();
  const markerFont = (fontFamily ?? "").trim() || "'Patrick Hand', system-ui, sans-serif";
  const ink = textColor || "#111111";

  // CTA cards (1-3). Only render cards with the toggle on and a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );

  /* CTA card text scales with the description size, so raising or lowering
     `descriptionFontSize` moves the cards with the subtext instead of leaving
     them at a fixed size.

     It also scales DOWN with the card count: each card gets its own holder
     standing side by side, so N cards share the column's width. Without this
     three cards overrun each other and their labels clip. */
  /* No CTA at all is a valid configuration (the toggle can be off, or no link
     given). The holder column is then omitted entirely rather than rendered
     empty — an empty flex child still reserves its width, which pushed the sign
     off-centre and left a stray ground line floating beside it. */
  const hasCards = cards.length > 0;

  /* ── Board size ────────────────────────────────────────────────────
     Declared HERE, above the auto-fit hooks, because their text budgets are
     shares of the board's height. The sign column's rendered width is the
     stage inset 7% either side, times its share of what remains; the board's
     height then follows from the BOARD_H/BOARD_W ratio. */
  const stageInnerW = width * 0.86;
  const signColWidthPx = stageInnerW * (p ? 0.96 : hasCards ? 0.5 : 0.62);
  const signBoardHPx = signColWidthPx * (BOARD_H / BOARD_W);

  /* ── Auto-fit (title + subtext) ────────────────────────────────────
     Both render the full prop text directly from frame 0 (only opacity /
     transform animate) — no slice-reveal — so they can be measured directly,
     matching the `ending_socials` base. The title is bounded by the signboard
     it is written on. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitSubtextRef = React.useRef<HTMLDivElement>(null);
  // Landscape targets come down a notch from the single-column version: the
  // sign now occupies the left column rather than the full stage width.
  const fitTitleTarget = titleFontSize ?? (p ? 46 : 43);
  const fitSubtextTarget = descriptionFontSize ?? (p ? 29 : 24);
  /* ── The copy box, measured rather than guessed ──────────────────────
     `useFitText` checks ONE element against ONE budget; it has no idea what
     else shares the board. So two budgets that each "fit" can still burst the
     box once the padding and the gap between them are counted — which is
     exactly what happened here: 0.42 + 0.34 of the board, plus 0.1 padding top
     AND bottom, came to 0.96 of it before the gap was even considered.

     The gap was the invisible part. `gap: "4%"` on a COLUMN resolves against
     the container's WIDTH, not its height — on a ~990px-wide board that is
     ~33px of vertical space nothing budgeted for. (The padding below already
     carries a comment warning about this exact trap for `padding`; the gap
     slipped through it.) Landscape needed 509px inside a 495px board, portrait
     549px inside 535px — hence copy spilling past the frame.

     So: derive the space that actually exists, once, and split THAT. */
  const boardPadYPx = Math.round(signBoardHPx * 0.1);
  const boardGapPx = Math.round(signBoardHPx * 0.06);
  const copyInnerHPx = Math.max(1, signBoardHPx - boardPadYPx * 2 - boardGapPx);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    /* Shares of the USABLE inner height summing to 0.96, not 1.0. The 4% slack
       absorbs per-term `Math.round` drift (four roundings can land 1-2px over)
       and line-height rounding in the browser, so the pair lands inside the box
       rather than exactly on its edge. */
    Math.round(copyInnerHPx * 0.54),
  );
  const { px: fitSubtextPx } = useFitText(
    fitSubtextRef,
    fitSubtextTarget,
    descriptionFontSizeIsUserSet ? fitSubtextTarget : Math.round(fitSubtextTarget * 0.5),
    [subtext, fitSubtextTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(copyInnerHPx * 0.42),
  );


  /* Cards stack one per row now, so they no longer compete for horizontal
     space and do not need to shrink as the count grows. A mild step is kept for
     three cards only, where the STACK's own height starts to matter. */
  const cardScale = cards.length >= 3 ? 0.86 : 1;
  const ctaButtonPx = Math.round(
    Math.max(11, Math.min(p ? 50 : 43, fitSubtextTarget * (p ? 1.05 : 1.15)) * cardScale),
  );
  const ctaLinkPx = Math.round(
    Math.max(9, Math.min(p ? 34 : 29, fitSubtextTarget * (p ? 0.75 : 0.8)) * cardScale),
  );

  /* Roughly how tall a CTA card renders: its two lines of type plus the padding
     and borders around them. The stand starts here, just under the card, and
     runs to the ground.

     It is an ESTIMATE by construction — measuring the real card would need a
     layout probe, and the numbers it feeds (where a post begins) tolerate a few
     pixels of slack, since the post's top is tucked behind the card anyway. The
     one thing that must be exact is where it ENDS, and that comes from
     `bottom: 0`, not from this. A label that wraps to two lines simply hides a
     little more of the post's top. */
  const cardBlockPx = Math.round(
    ctaButtonPx * 1.15 + ctaLinkPx * 1.25 + ctaButtonPx * 0.9 + 12,
  );
  /* Button label auto-fit — ONE fixed hook per card slot (cards cap at 3, via
     `resolveCtas().slice(0, 3)`), not a hook inside `.map`, since hooks cannot
     be called conditionally or a variable number of times.

     Without this, a long button label WRAPS (no `nowrap` on that div, by
     design, so it doesn't force the card wider than its column) to two or more
     lines at `ctaButtonPx`. `cardBlockPx` above only budgets for one line of
     button text, so a wrapped label renders the card taller than every other
     measurement in this file assumes — the CTA stack's own reserved height,
     the board's push-down offset, the post length — all still think the card
     is `cardBlockPx` tall. The real, taller card then spills past whichever
     boundary those numbers were guarding, which is what let a 3-card stack's
     bottom card overlap the socials footer below the ground line.

     Fitting the label against a ONE-LINE height budget makes the font shrink
     instead of wrap, so the card's real rendered height stays at what
     `cardBlockPx` already assumes. */
  const ctaBtnRef0 = React.useRef<HTMLDivElement>(null);
  const ctaBtnRef1 = React.useRef<HTMLDivElement>(null);
  const ctaBtnRef2 = React.useRef<HTMLDivElement>(null);
  const ctaBtnRefs = [ctaBtnRef0, ctaBtnRef1, ctaBtnRef2] as const;
  const ctaBtnText0 = cards[0]?.ctaButtonText.trim() || "";
  const ctaBtnText1 = cards[1]?.ctaButtonText.trim() || "";
  const ctaBtnText2 = cards[2]?.ctaButtonText.trim() || "";
  const ctaBtnOneLinePx = Math.round(ctaButtonPx * 1.15 * 1.08);
  const fitBtn0 = useFitText(
    ctaBtnRef0,
    ctaButtonPx,
    Math.round(ctaButtonPx * 0.55),
    [ctaBtnText0, ctaButtonPx],
    ctaBtnOneLinePx,
  );
  const fitBtn1 = useFitText(
    ctaBtnRef1,
    ctaButtonPx,
    Math.round(ctaButtonPx * 0.55),
    [ctaBtnText1, ctaButtonPx],
    ctaBtnOneLinePx,
  );
  const fitBtn2 = useFitText(
    ctaBtnRef2,
    ctaButtonPx,
    Math.round(ctaButtonPx * 0.55),
    [ctaBtnText2, ctaButtonPx],
    ctaBtnOneLinePx,
  );
  const ctaBtnFits = [fitBtn0, fitBtn1, fitBtn2] as const;
  /* The STACK's height, not one card's. Cards are one-per-row now, so in
     portrait (where the stack sits above the board) the space reserved for it
     has to cover every card plus the gaps between them — using just
     `cardBlockPx` for a 3-card stack left two cards' worth of height
     unaccounted for and the top card rendered off the top of the frame. */
  const ctaStackBlockPx = hasCards
    ? cardBlockPx * cards.length + (p ? 14 : 18) * Math.max(0, cards.length - 1)
    : 0;

  /* How long each CTA stake is: the drop from the bottom of the card down to
     the ground line.

     The CTA column is pinned to the TOP of the stage (the row's `flex-start`),
     so the card's bottom sits at stagePadTop + cardBlockPx, and the ground is
     at stageHeight. The difference is the stake. Deriving it from the same
     GROUND_BOTTOM fraction the ground line itself is positioned by is what
     makes the two meet. */
  const stageHeightPx = height * (1 - (p ? GROUND_BOTTOM_P : GROUND_BOTTOM_L));
  const stagePadTopPx = height * (p ? 0.08 : 0.05);
  /* The signboard's own posts, derived the same way. The board's rendered
     height follows from its width and the 900×420 viewBox it is drawn in, so
     the drop to the ground is the stage height less the board's top and its own
     height. Both posts and stakes therefore terminate on one y without either
     needing to know about the other. */
  /* Landscape: the board hangs from the top of the stage, so its posts span
     everything below it. Portrait: the CTA row sits ABOVE the board, so the
     board starts lower by that row's height and its posts are correspondingly
     shorter — subtracting the same `cardBlockPx` + stake + gap the CTAs occupy
     is what keeps the posts landing on the ground rather than through it. */
  /* Portrait drops the board WELL down the frame: the CTA cards sit at the top
     with clear air under them, and the board hangs below with its posts running
     to the ground. A quarter of the frame's height of separation is what stops
     the two reading as one stacked block. */
  /* Portrait's column gap, in px. Named because BOTH the flex `gap` below and
     the post-length derivation read it — expressing it as a percentage in one
     place and a guess in the other is exactly what left the posts short of the
     ground. */
  /* Was 0.14 — a 269px void at 1920 tall. That figure was set when the CTAs sat
     SIDE BY SIDE in one short row; stacked one per row the block is now three
     times deeper, so the same gap on top of it pushed the cards to the ceiling
     and left a dead band between them and the board.
     Because `signTopOffsetPx` and `signPostLenPx` both derive from this, closing
     the gap automatically lengthens the board's posts to keep their feet on the
     same ground line. */
  const portraitColGapPx = height * 0.05;
  const signTopOffsetPx = p
    ? stagePadTopPx + ctaStackBlockPx + portraitColGapPx
    : stagePadTopPx;
  /* No cap: the post is exactly the gap between the board's underside and the
     ground, whatever that works out to. In portrait the board's own offset
     (`signTopOffsetPx`) is what keeps that gap reasonable — capping the post
     instead just left it dangling short of the ground. */
  const signPostLenPx = Math.max(
    24,
    stageHeightPx - signTopOffsetPx - signBoardHPx,
  );
  /* Landscape only: how tall the CTA column's box is, measured down from the
     stage top (`alignSelf: flex-start` on that column) — which is also where
     its `justifyContent: flex-end` anchor ends up, i.e. where a lone card
     sits and where 2nd/3rd cards stack upward FROM.

     A LITTLE PAST the sign column's half height (0.58, not 0.5), not the
     full thing: the full height put the anchor at the very foot of the sign,
     right next to the ground and the socials footer below it — a single card
     already sat low, and each extra card pushed the stack further down
     toward the footer instead of away from it. The extra 0.08 over an exact
     half nudges the whole stack down a bit further from centre — enough to
     clear the stage's top padding with a 3-card stack (`overflow: visible`
     above lets it extend slightly past this box if it still needs to,
     instead of clipping) — while staying well clear of the ground. Stopping
     the box at roughly the MIDDLE puts a lone card near level with the
     board's centre and gives a growing stack the box's other half — all of
     it above that middle — to extend upward into, well clear of the ground
     under normal copy.

     Single-card case: a lone CTA has no stack growing above it, so parking
     it at the same mid-height anchor as a multi-card stack leaves it looking
     low relative to the sign board beside it. Halving the anchor puts a lone
     card's bottom edge halfway between that mid-height position and the
     stage top, i.e. noticeably higher, without touching the 2/3-card anchor
     multi-card stacks still rely on. */
  const CTA_ANCHOR_FROM_TOP_L_BASE = (signBoardHPx + signPostLenPx) * 0.58;
  const CTA_ANCHOR_FROM_TOP_L =
    cards.length === 1 ? CTA_ANCHOR_FROM_TOP_L_BASE * 0.5 : CTA_ANCHOR_FROM_TOP_L_BASE;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor, fontFamily: markerFont }}>
      <WhiteboardBackground bgColor={bgColor} />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="grain-esv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.05" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink-esv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="96" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkSign-esv2" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="4" seed="67" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="4.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain-esv2)" fill="none" />
      </svg>

      {/* ── The scene's ONE ground line ───────────────────────────────────
          Drawn outside both columns, because everything planted in the scene
          terminates on it: the signboard's posts, every CTA stand, and the
          unicycle's wheel. The stage above is laid out so the columns' bottom
          edge coincides with this y (see `stageBottomPad`), which is what makes
          "share the ground" a layout invariant rather than a tuned offset. */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          bottom: `${(p ? GROUND_BOTTOM_P : GROUND_BOTTOM_L) * 100}%`,
          width: "100%",
          height: 20,
          overflow: "visible",
          pointerEvents: "none",
          opacity: fade,
          zIndex: 4,
        }}
        viewBox="0 0 1000 20"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M 10,10 Q 260,14 500,10 Q 740,6 990,11"
          fill="none"
          stroke={ink}
          strokeWidth={5}
          strokeOpacity={0.25}
          strokeLinecap="round"
          filter="url(#inkSign-esv2)"
          strokeDasharray={1010}
          strokeDashoffset={1010 * (1 - groundIn)}
        />
      </svg>

      {/* ── The unicyclist ────────────────────────────────────────────────
          Sits ABOVE the signs in z-order, so it passes IN FRONT of the board
          and the CTA cards as it crosses. Its box is bottom-aligned to the
          shared ground so the wheel's contact point rides exactly on the
          line. */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          bottom: `${(p ? GROUND_BOTTOM_P : GROUND_BOTTOM_L) * 100}%`,
          width: "100%",
          /* Portrait runs MUCH larger: a 9:16 frame is narrow, so a rider
             sized as a fraction of its width comes out tiny against the stacked
             board above it. */
          height: `${(p ? 130 : 22) * (RIDE_VIEW_H / RIDE_VIEW_W) * 100}%`,
          overflow: "visible",
          pointerEvents: "none",
          opacity: fade,
          zIndex: 20,
        }}
        viewBox={`0 0 ${RIDE_VIEW_W} ${RIDE_VIEW_H}`}
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        aria-hidden
      >
        {/* Filter on the STATIC parent, never on the translating group:
            feTurbulence samples in filter space, so a filter on a moving node
            makes the noise crawl across the ink as it travels. */}
        <g filter="url(#ink-esv2)" stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none">
          {/* Scaled about the wheel's CONTACT POINT, so the rider grows upward
              from the ground rather than sinking through it.

              Scaling here rather than on the svg's `height` is what actually
              changes the rider's size: the box is `xMidYMax meet` on a
              full-width track, so its rendered scale is set by the WIDTH and a
              taller box just adds slack above. Portrait needs the boost because
              the same track spans a much narrower frame.

              The NEGATIVE x scale mirrors the rider to face its direction of
              travel. The figure is drawn facing right (arm forward, knees
              ahead of the hip) but the crossing runs right → left, so without
              this it rides backwards — leaning and reaching away from where it
              is going. Mirroring about x=0 works because `Unicyclist` is
              authored about a local x=0; the outer `translate(rideX)` places
              it afterwards and is unaffected. */}
          <g
            transform={`translate(${rideX}, 0) translate(0, ${RIDE_GROUND_Y}) scale(${
              -(p ? 1.9 : 1)
            }, ${p ? 1.9 : 1}) translate(0, ${-RIDE_GROUND_Y})`}
          >
            <Unicyclist
              ink={ink}
              accent={accentColor}
              spin={wheelSpin}
              lean={leanDeg}
              frame={frame}
            />
          </g>
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          /* The stage ENDS on the ground line. Bounding it here — rather than
             letting it fill the frame and relying on bottom padding — is what
             gives the `flex:1` posts and stands inside it a definite height to
             stretch into; with `inset:0` plus padding they collapsed to zero
             and every stake vanished. */
          height: `${(1 - (p ? GROUND_BOTTOM_P : GROUND_BOTTOM_L)) * 100}%`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Portrait pins the title card to the top and the socials to the
          // bottom, letting the sign take the space between; landscape stays
          // vertically centred.
          /* Portrait pushes the whole stack DOWN to the bottom of the stage, so
             the capped-length posts still land on the ground line rather than
             leaving the board hanging near the top with a long gap under it.
             Landscape packs from the top, where its full-length posts span the
             stage anyway. */
          justifyContent: p ? "flex-end" : "flex-start",
          // No bottom padding: the stage's own height already ends on the
          // ground line, so its bottom edge IS the ground and everything inside
          // measures against it.
          /* Top padding in PX, not %, because the post lengths are derived
             from it:
             a percentage padding resolves against the element's WIDTH, so the
             two would disagree by whatever the aspect ratio happens to be. */
          padding: `${stagePadTopPx}px 7% 0`,
          gap: p ? 24 : 28,
          boxSizing: "border-box",
          opacity: fade,
          zIndex: 10,
        }}
      >
        {/* ── Two columns: sign + copy on the left, CTA stands on the
            right. Portrait stacks them instead. ─────────────────────── */}
        <div
          style={{
            display: "flex",
            /* Portrait puts the CTA cards ON TOP and the big board with its
               stands beneath them, so the board's posts still meet the ground.
               `column-reverse` gets that without reordering the DOM, which
               landscape (board on the left) still wants as-is. */
            flexDirection: p ? "column-reverse" : "row",
            /* STRETCH, not bottom-align: the posts and stands inside each
               column are `flex:1` and need their column to span the full height
               of this row (whose bottom IS the ground line) in order to reach
               it. `flex-end` sizes each column to its content instead, which
               leaves every stake with nothing to stretch into. */
            alignItems: "stretch",
            gap: p ? portraitColGapPx : "5%",
            width: "100%",
            minHeight: 0,
            /* The row FILLS the stage down to its bottom padding, which sits on
               the ground line. That is what makes every post inside it reach
               the ground: the stands are `flex:1` within their card column, so
               they stretch to whatever this row leaves them. Centring the row
               instead (as it was) left it floating above the ground and the
               stands ended in mid-air. */
            flex: 1,
            /* Portrait uses `column-reverse`, so its main-start is the BOTTOM
               and main-end is the TOP. `flex-start` packs the row against the
               bottom (the ground line), letting the CTA stack grow upward from
               there into the stage's top padding rather than being pushed
               flush against the literal top of the frame (`flex-end`, which is
               main-end in a reversed column) and clipping off-screen when the
               stack has more than one card. */
            justifyContent: p ? "flex-start" : "center",
          }}
        >
          {/* ── LEFT: signboard on two posts + subtext ──────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              /* With no CTA there is no second column to share the stage with,
                 so the sign centres instead of staying pinned to the left half.
                 It does NOT go full-width: the board's height scales with its
                 width, so 100% overflows the frame vertically. 62% keeps it at
                 roughly the size it has when a CTA column is present. */
              width: p ? "100%" : hasCards ? "50%" : "62%",
              // Top-aligned: the board sits at the top of the stage and its
              // posts, whose length is computed, hang down to the ground.
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                position: "relative",
                width: p ? "96%" : "100%",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* The board itself. */}
              <div style={{ position: "relative", zIndex: 3, flexShrink: 0 }}>

                <svg
                  style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
                  viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
                  aria-hidden
                >
                  <g filter="url(#inkSign-esv2)" strokeLinecap="round" strokeLinejoin="round">
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="#FFFFFF"
                      fillOpacity={0.92}
                    />
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="none"
                      stroke={ink}
                      strokeWidth={11}
                      strokeOpacity={0.2}
                      strokeDasharray={BOARD_PERIMETER}
                      strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
                    />
                    <rect
                      x={8}
                      y={8}
                      width={BOARD_W - 16}
                      height={BOARD_H - 16}
                      rx={10}
                      fill="none"
                      stroke={ink}
                      strokeWidth={6}
                      strokeDasharray={BOARD_PERIMETER}
                      strokeDashoffset={BOARD_PERIMETER * (1 - boardProgress)}
                    />
                  </g>
                </svg>

                {/* Title and subtext, both written on the board */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    /* Gap in PX for the same reason the padding is — a
                       percentage gap on a column resolves against WIDTH, so on
                       this board `4%` silently ate ~33px of VERTICAL space that
                       no text budget accounted for, and the copy overflowed.
                       Both values now feed `copyInnerHPx` above, so the budgets
                       and the box can no longer disagree. */
                    gap: `${boardGapPx}px`,
                    /* Vertical padding in PX from the board's own height rather
                       than a percentage: percentage padding resolves against
                       WIDTH, so on a board this wide a single figure gives very
                       different insets vertically and horizontally. */
                    padding: `${boardPadYPx}px 8%`,
                    boxSizing: "border-box",
                    opacity: titleOp,
                  }}
                >
                  <div
                    ref={fitTitleRef}
                    style={{
                      color: ink,
                      fontWeight: 800,
                      fontSize: fitTitlePx,
                      lineHeight: 1.08,
                      width: "100%",
                      textAlign: "center",
                      fontFamily: markerFont,
                      filter: "url(#ink-esv2)",
                    }}
                  >
                    {title}
                  </div>

                  {subtext ? (
                    <div
                      ref={fitSubtextRef}
                      style={{
                        fontSize: fitSubtextPx,
                        lineHeight: 1.25,
                        color: `${ink}CC`,
                        fontFamily: markerFont,
                        width: "100%",
                        textAlign: "center",
                      }}
                    >
                      {subtext}
                    </div>
                  ) : null}
                </div>
              </div>

                {/* The board's two posts. Same construction as the CTA
                    stakes: a computed length down to the shared ground line,
                    and NO ink filter — `inkSign-esv2` displaces by 4.2 user
                    units, and this box's units are stretched by
                    preserveAspectRatio="none" across the whole post, so the
                    filter smears a thin line out of its own region and nothing
                    draws.

                    `overflow: hidden` — NOT visible. The line is drawn with a
                    little slack past both ends of its own viewBox (y runs from
                    -10 to 300 against a 0-300 box) so its rounded caps land
                    cleanly ON the board's underside and the ground line rather
                    than a hair short. With `overflow: visible` that slack drew
                    unclipped: when the board gets pushed down further than the
                    stage has room for (a tall CTA stack pushes the sign's top
                    offset down, and `signPostLenPx` bottoms out at its 24px
                    floor), the post kept drawing at its full un-stretched
                    length and ran straight through the ground line instead of
                    stopping at it. Hidden overflow means the post is always
                    cut off exactly at the ground, however short the computed
                    length gets, instead of spilling past it. */}
                <svg
                  style={{
                    width: "100%",
                    height: signPostLenPx,
                    marginTop: -4,
                    overflow: "hidden",
                    pointerEvents: "none",
                    flexShrink: 0,
                  }}
                  viewBox="0 0 900 300"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {/* y runs past 300 so the stroke's rounded cap lands ON the
                      ground line rather than a hair above it. */}
                  <g fill="none" strokeLinecap="round">
                    {/* Thin, to match the CTA stakes — the whole scene is a row
                        of signs on the same kind of slim stake. Splayed
                        slightly outward, as a pair of legs under a wide board
                        would be. */}
                    <line
                      x1={190}
                      y1={-10}
                      x2={172}
                      y2={300}
                      stroke={ink}
                      strokeWidth={4}
                      strokeOpacity={0.8}
                      vectorEffect="non-scaling-stroke"
                      opacity={boardProgress}
                    />
                    <line
                      x1={710}
                      y1={-10}
                      x2={728}
                      y2={300}
                      stroke={ink}
                      strokeWidth={4}
                      strokeOpacity={0.8}
                      vectorEffect="non-scaling-stroke"
                      opacity={boardProgress}
                    />
                  </g>
                </svg>
            </div>

            {/* No ground line here — the scene has ONE, drawn outside both
                columns so the sign's posts and the CTA stands share it. */}
          </div>

          {/* ── RIGHT: one planted stand per CTA ─────────────────────────
              Each CTA is its own signpost driven into the same ground as the
              main board's posts, so the whole stage reads as a row of signs in
              one field rather than a board and a floating stack of cards. */}
          {hasCards ? (
          <div
            style={{
              position: "relative",
              display: "flex",
              /* ONE CARD PER ROW. Side by side, three cards had to share the
                 column's width and each shrank until its copy was unreadable
                 (that is what `cardScale` was compensating for). Stacked, every
                 card gets the full width and keeps its type size. */
              flexDirection: "column",
              /* Stretch, not centre: each card should span the column so they
                 read as a stack of equal signs rather than a ragged pile. */
              alignItems: "stretch",
              /* `flex-end` again — the stack's bottom card always sits at the
                 box's OWN bottom edge, and every extra card stacks upward
                 from there. What changed is WHERE that bottom edge is: it
                 used to sit almost on the ground (`signBoardHPx +
                 signPostLenPx`, minus a thin clearance), so growth had almost
                 no headroom and one extra card was already crowding the
                 footer. Now the box's bottom edge sits much higher —
                 `CTA_ANCHOR_FROM_TOP_L` below, roughly the sign column's
                 vertical middle — so a single card lands near that middle
                 (reading as "centred" for the common 1-card case) and a 2nd
                 or 3rd card stacks purely upward into the tall headroom above
                 it, never approaching the ground or the socials footer under
                 normal copy. */
              justifyContent: "flex-end",
              /* px, not a percentage — a `%` gap resolves against WIDTH even on
                 a column, which is the same trap that made the board copy
                 overflow above. */
              gap: p ? 14 : 18,
              width: p ? "100%" : "45%",
              /* Height is the BOARD's height, not the whole stage's: the cards
                 should centre against the board beside them, and the stage runs
                 on down to the ground line well below the board's bottom edge.
                 Stretching to the stage instead dropped them to the floor. */
              alignSelf: "flex-start",
              /* Landscape: match the SIGN COLUMN's full height — board plus the
                 posts under it — so `alignItems: center` puts the cards at the
                 vertical middle of the whole sign rather than of the board
                 alone. Using just the board's height centred them against a box
                 whose top is the stage top, which sat them too high.

                 In portrait the CTAs are their own row ABOVE the board, with
                 nothing beside them to centre against, so the height is left to
                 the content. */
              /* The box's BOTTOM edge is where the stack anchors
                 (`justifyContent: flex-end`) and therefore where it starts
                 growing upward FROM. Matching the sign column's full height
                 (`signBoardHPx + signPostLenPx`, which reaches all the way to
                 the ground) put that anchor right ON the ground line: a
                 single card already sat low, at the very foot of the sign,
                 and every extra card pushed the stack further down toward
                 the socials footer instead of up and away from it.

                 `CTA_ANCHOR_FROM_TOP_L` instead stops the box at roughly the
                 sign column's vertical MIDDLE, so the anchor — and a lone
                 card — sits at mid-height beside the board, and 2nd/3rd
                 cards stack upward from there into the headroom above,
                 nowhere near the ground or the footer under normal copy. */
              height: p ? undefined : CTA_ANCHOR_FROM_TOP_L,
              /* NOT `overflow: hidden`. A 3-card stack can genuinely be taller
                 than this box (the box is only half the sign column's
                 height), and clipping it here cut the top card's text off at
                 the frame edge instead of just letting the box's own height
                 be a soft target. Visible overflow means the stack pushes up
                 past the box's top edge in that case — still fully on-screen,
                 just extending into the stage's top padding — rather than
                 slicing a card in half. */
              overflow: "visible",
            }}
          >
            {/* Reversed: the FIRST card (idx 0) renders LAST in the DOM, which
               puts it at the bottom of this column — nearest the board — with
               each following card stacking above it. Rendered in prop order
               instead, card 0 landed at the far end (top in portrait, where
               this column sits above the board) and the stack grew DOWN toward
               the board as more cards were added, the opposite of what a stack
               anchored at the bottom (`justifyContent: flex-end`) should read
               as. `idx` below is still the ORIGINAL index (for `cardIn` /
               `cardWave` staggering and the `key`), only the render order is
               flipped. */}
            {[...cards].reverse().map((card, revIdx) => {
              const idx = cards.length - 1 - revIdx;
              return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  /* Centred, not top-pinned. The cards no longer have stakes
                     tying them to the ground, so there is nothing to justify
                     hanging them from the top of the column — centring sits
                     them against the middle of the board beside them. */
                  justifyContent: "center",
                  minWidth: 0,
                  /* FULL WIDTH of the column. The old
                     `maxWidth: 100/cards.length%` split the width between the
                     cards — correct when they sat side by side in a row, but
                     once stacked it capped three cards at a third of the column
                     each and left two thirds of it empty beside them. Stacked
                     cards do not share width; each gets all of it. */
                  flex: "0 0 auto",
                  width: "100%",
                }}
              >
                {/* The card, sitting on top of its post */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    /* Padding is capped relative to the card's own share of
                       the column. At three cards the un-capped 0.8× horizontal
                       padding alone exceeded the width each card gets, so the
                       box overflowed its column before any text was laid out. */
                    padding: `${Math.round(ctaButtonPx * 0.4)}px ${Math.round(
                      Math.min(ctaButtonPx * 0.7, 22),
                    )}px`,
                    border: `4px solid ${ink}`,
                    borderRadius: 10,
                    backgroundColor: "#FFFFFF",
                    boxShadow: `6px 6px 0px ${accentColor}44`,
                    /* Fills its holder, which is the column's full width. The
                       card used to be sized to its CONTENT so several could
                       share one row; stacked, that made each card only as wide
                       as its own label, so a three-card pile came out as three
                       different widths ragged down the column. One width for
                       all of them reads as a stack of matching signs. */
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    /* The card settles onto its post as the post draws in.
                       Both ride the SAME `cardIn` scalar, so the card can never
                       appear before the stand that holds it. */
                    transform: `translateY(${(1 - cardIn(idx)) * 18}px) scale(${
                      0.92 + cardIn(idx) * 0.08
                    }) rotate(${cardWave(idx)}deg)`,
                    // Pivot at the card's BOTTOM edge — that is where the post
                    // meets it, so the sway reads as the sign flexing on its
                    // stand rather than sliding off it.
                    transformOrigin: "50% 100%",
                    opacity: cardIn(idx),
                    minWidth: 0,
                    zIndex: 3,
                  }}
                >
                  <div
                    ref={ctaBtnRefs[idx]}
                    style={{
                      color: ink,
                      // Auto-fit, shrunk against a ONE-LINE height budget
                      // (`ctaBtnOneLinePx`) instead of the flat `ctaButtonPx`.
                      // A long label now shrinks to fit its line rather than
                      // wrapping to a second one and inflating the card past
                      // what `cardBlockPx` budgets for elsewhere in this file.
                      fontSize: ctaBtnFits[idx]?.px ?? ctaButtonPx,
                      fontWeight: 800,
                      fontFamily: markerFont,
                      textAlign: "center",
                      width: "100%",
                      lineHeight: 1.15,
                    }}
                  >
                    {card.ctaButtonText.trim() || "Get started"}
                  </div>
                  <div
                    style={{
                      fontSize: ctaLinkPx,
                      fontWeight: 600,
                      color: `${ink}CC`,
                      fontFamily: markerFont,
                      maxWidth: "100%",
                      textAlign: "center",
                      /* ONE line, ellipsised. A pasted link can be arbitrarily
                         long, and wrapping it grew the card several lines deep
                         and pushed it off the layout the rest of the scene is
                         built around. `nowrap` + `hidden` + `ellipsis` is the
                         combination that actually truncates — any one of them
                         alone lets the text wrap or spill instead. */
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>

                {/* NO stake under the CTA cards. They float free — only the
                    main signboard is planted. Giving every card its own stake
                    made the stage read as a hedge of identical posts and buried
                    the one sign that actually is planted. */}
              </div>
              );
            })}

          </div>
          ) : null}
        </div>

      </div>

      {/* ── Socials row, in the strip BELOW the ground line ────────────────
          Positioned absolutely rather than as a flex child, because the stage
          above now fills exactly down to the ground and has no room left for
          it. `SocialIcons` sizes each item as a fraction of its container, so
          the row is capped rather than left to span the full stage width. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          /* Pinned to the FOOTER of the frame, not floated inside the ground
             strip: the icons are a footer, so they sit at the very bottom with
             a small margin, below everything planted on the ground.

             The band has an explicit HEIGHT and bottom-aligns its content. The
             box grows upward from `bottom`, and `SocialIcons` wraps at
             `maxPerRow` — so with more socials than fit one row (5 against a
             maxPerRow of 4 was the reported case) the second row pushed the
             whole stack up over the ground line and into the figure. Fixing the
             height and aligning to the end makes a wrapped row grow DOWNWARD
             inside the band instead. The band still clears the ground line at
             GROUND_BOTTOM_L/P (0.22 / 0.20). */
          bottom: `${(p ? 7 : 8)}%`,
          height: `${(p ? 11 : 10)}%`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 7%",
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: p ? "100%" : 720,
            opacity: socialsOp * fade,
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={ink}
            maxPerRow={p ? 3 : 4}
            fontFamily={markerFont}
            aspectRatio={aspectRatio}
            // Smaller than the component defaults (46 / 64): the row is a
            // footer here, below the sign and the CTA stack.
            iconSize={p ? 46 : 34}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
