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
 * The figure is the base `stick_figure_scene`'s own ball-bouncing rig, reused
 * verbatim and simply mirrored to face LEFT (toward the board) instead of
 * right. Its geometry and bounce timing are the base's, not re-derived here.
 *
 * Filter IDs carry a `-sfv2` suffix: SVG filter IDs are document-global, and
 * two scenes mounted in the same Player would otherwise collide.
 */

const BOARD_PERIMETER = 2 * (544 + 404);

/**
 * Figure viewBox width, matching the base `stick_figure_scene`'s own 420×370
 * box. Used as the mirror axis so the reused rig faces LEFT (see below).
 */
const FIG_VIEWBOX_W = 420;

/**
 * The ball-bouncing figure from the base `stick_figure_scene`, reused
 * VERBATIM — same joint coordinates, same 5px stroke, same
 * `abs(sin(frame * 0.1))` bounce, same arm/ball wiring — with exactly one
 * change: the whole group is mirrored about its own viewBox centre so it
 * faces LEFT (toward the board) instead of right.
 *
 * Nothing about the motion is re-derived here. Earlier passes tried to build
 * a bespoke dribble rig for this variant and it repeatedly came out wrong
 * (arm on the wrong side of the body, joints not meeting); reusing the base's
 * already-correct rig and only flipping it avoids all of that.
 */
const BouncingBallStickman: React.FC<{
  color: string;
  accent: string;
  bgColor: string;
  frame: number;
  progress: number;
}> = ({ color, accent, bgColor, frame, progress }) => {
  // ── Base rig's motion and joint geometry, copied exactly ───────────
  // Including the ball: it bobs up and down near the HAND and deliberately
  // never reaches the floor, exactly as in `stick_figure_scene`. (An earlier
  // pass here re-anchored it to bounce off the ground line; that is not what
  // the base does, so it has been reverted to the base's own math.)
  const bounceHeight = 120;
  const bounceRaw = Math.abs(Math.sin(frame * 0.1));
  const ballOffset = bounceRaw * bounceHeight;

  const shoulderY = 130;
  const handX = 220;
  const handY = 200 - (1 - bounceRaw) * 20;
  const elbowX = 165;
  const elbowY = 170;

  const dash = 500;
  const figOff = dash * (1 - progress);

  return (
    // scale(-1,1) about the viewBox centre flips the rig to face LEFT. The
    // base draws it facing right (arms and ball reach toward +x), so this is
    // the single transform that changes.
    <g
      transform={`translate(${FIG_VIEWBOX_W} 0) scale(-1 1)`}
      filter="url(#ink-sfv2)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* === STICK MAN === */}
      <circle
        cx={110}
        cy={66}
        r={30}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeDasharray={dash}
        strokeDashoffset={figOff}
      />
      <line
        x1={110}
        y1={98}
        x2={110}
        y2={218}
        stroke={color}
        strokeWidth={5}
        strokeDasharray={dash}
        strokeDashoffset={figOff}
      />

      {/* Arms — both start at the shoulder and bend at the elbow */}
      <path
        d={`M110,${shoulderY} L${elbowX},${elbowY} L${handX},${handY}`}
        stroke={color}
        strokeWidth={5}
        fill="none"
      />
      <path
        d={`M110,${shoulderY} L${elbowX - 15},${elbowY + 10} L${handX},${handY}`}
        stroke={color}
        strokeWidth={5}
        fill="none"
      />

      {/* Legs */}
      <path d="M110,218 L80,308" stroke={color} strokeWidth={5} fill="none" />
      <path d="M110,218 L140,308" stroke={color} strokeWidth={5} fill="none" />

      {/* === BOUNCING BALL === */}
      <g transform={`translate(0, ${-ballOffset})`}>
        <circle
          cx={handX}
          cy={handY - 25}
          r={25}
          stroke={accent}
          strokeWidth={5}
          fill={bgColor}
        />
        <path
          d={`M${handX - 10},${handY - 32} Q${handX},${handY - 25} ${handX + 10},${handY - 32}`}
          stroke={accent}
          strokeWidth={3}
          strokeOpacity={0.5}
          fill="none"
        />
      </g>
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
  const figProgress = interpolate(frame, [14, 46], [0, 1], {
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
  const fitTitleTarget = titleFontSize ?? (p ? 58 : 48);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 28 : 25);
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

      {/* ── Ball-bouncing figure, standing beside the board ─────────────
          The viewBox is the base `stick_figure_scene`'s own 420×370 (the rig
          is reused unmodified, so it has to keep the coordinate space it was
          drawn in). The base puts the feet at y=308 of that 370-tall box —
          i.e. 16.8% of the box sits BELOW the feet — so `bottom` is offset to
          put the feet exactly on the scene's ground line rather than the svg's
          own lower edge. */}
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
          // The base rig is drawn to fill a 44%-wide box; at the 13% used
          // before, the whole figure (and its bouncing ball) shrank to a
          // fraction of its intended size. These widths give a figure roughly
          // 34% (landscape) / 24% (portrait) of frame height.
          width: p ? "65%" : "30%",
          height: "auto",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 10,
        }}
        viewBox={`0 0 ${FIG_VIEWBOX_W} 370`}
        fill="none"
        aria-hidden
      >
        <BouncingBallStickman
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
