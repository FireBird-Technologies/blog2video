import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const InkDefs: React.FC<{ id?: string }> = ({ id = "ink_dtv2" }) => (
  <defs>
    <filter id={id} x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="11" result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="paper_dtv2">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" result="noise" />
      <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
      <feComponentTransfer in="gray" result="lighter">
        <feFuncA type="linear" slope="0.06" />
      </feComponentTransfer>
      <feComposite in="lighter" in2="SourceGraphic" operator="over" />
    </filter>
  </defs>
);

const BrokenGround: React.FC<{ color: string; p: boolean }> = ({ color, p }) => {
  return (
    <svg
      style={{
        position: "absolute",
        bottom: p ? "12%" : "10%",
        left: 0,
        width: "100%",
        height: 60,
        overflow: "visible",
      }}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
    >
      <filter id="brokenGroundInk_dtv2" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.1 0.08" numOctaves="4" seed="25" result="crackNoise" />
        <feDisplacementMap in="SourceGraphic" in2="crackNoise" scale="14" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <path
        d="M -50,30 Q 250,34 500,30 Q 750,26 1050,30"
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeOpacity="0.4"
        filter="url(#brokenGroundInk_dtv2)"
      />
      <path
        d="M -50,30 Q 250,34 500,30 Q 750,26 1050,30"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeOpacity="0.8"
        filter="url(#brokenGroundInk_dtv2)"
      />
    </svg>
  );
};

/**
 * One running stick figure.
 *
 * `dir` is -1 for the figure entering from the LEFT (running rightwards) and +1
 * for the one entering from the RIGHT. It runs in facing its direction of
 * travel, plants short of centre, pivots to face front, then sweeps both arms
 * up toward the title and waves them.
 *
 * Limbs are two-segment with a hinged joint, so knees and elbows bend rather
 * than the limbs staying rigid: the thigh rotates about the hip and the shin
 * rotates again about the knee, and likewise upper arm / forearm about the
 * shoulder and elbow.
 */
// Rig proportions in viewBox units. The box is 150 tall, which fits the hat
// crown (y=-7) down to the feet (KNEE_Y + SHIN = 138) with room to spare.
// Legs come to ~1.24x the torso length, which keeps the figure from reading
// squat now that the torso is long.
const SHOULDER_Y = 44;
const HIP_Y = 86;
const KNEE_Y = 112;
const SHIN = 26;

const Runner: React.FC<{
  dir: -1 | 1;
  frame: number;
  color: string;
  runEnd: number;
  turnEnd: number;
  raiseStart: number;
  raiseEnd: number;
  /** Half the distance between the two figures once planted, in viewBox units. */
  gap: number;
}> = ({ dir, frame, color, runEnd, turnEnd, raiseStart, raiseEnd, gap }) => {
  const CENTER = 200;

  // ── Travel ──────────────────────────────────────────────────────────────
  const runT = interpolate(frame, [0, runEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - runT, 3); // decelerate into the plant
  const startX = CENTER + dir * 250;
  const restX = CENTER + dir * gap;
  const x = interpolate(eased, [0, 1], [startX, restX]);

  // ── Turn to face front ──────────────────────────────────────────────────
  const turnT = interpolate(frame, [runEnd, turnEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // `facing` is +1 when the figure faces screen-right. The one entering from
  // the left (dir -1) travels rightwards, so it faces +1. The whole rig is
  // mirrored by this as a constant ±1 — never interpolated through zero, which
  // would flatten the figure to an invisible sliver mid-turn. The raised arm
  // pose is symmetric, so keeping the mirror on after the turn is harmless.
  const facing = dir === -1 ? 1 : -1;
  // Shoulders/hips are narrow side-on and splay open as the figure turns front.
  const bodyWidth = interpolate(turnT, [0, 1], [0.42, 1]);

  // ── Gait ────────────────────────────────────────────────────────────────
  const cycle = frame * 0.42;
  // Ease the gait out over the last few frames of the run rather than snapping
  // `stride` from 1 to 0 — a hard cut would pop the limbs from mid-stride to
  // standing in a single frame.
  const stride = interpolate(frame, [runEnd - 8, runEnd + 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Runners bob twice per stride cycle; once planted, breathe gently.
  const bob =
    Math.abs(Math.sin(cycle)) * -4 * stride +
    Math.sin(frame * 0.07) * 1.2 * (1 - stride);
  // Lean into the run, straighten up on the turn.
  const lean = interpolate(turnT, [0, 1], [facing * -8, 0]) * Math.max(stride, 1 - turnT);

  // `side` is -1 for the screen-left leg. At rest the legs splay outward a few
  // degrees instead of dropping straight down: parallel vertical legs hanging
  // off the hip bar close into a solid rectangle and stop reading as legs.
  const leg = (phase: number, side: -1 | 1) => {
    const restSplay = -side * 7 * (1 - stride);
    return {
      thigh: Math.sin(cycle + phase) * 42 * stride + restSplay,
      knee: Math.max(0, Math.sin(cycle + phase - Math.PI / 2)) * 58 * stride,
    };
  };
  const legA = leg(0, 1);
  const legB = leg(Math.PI, -1);

  // ── Arms ────────────────────────────────────────────────────────────────
  // Running: opposite-phase pump with a tightly bent elbow.
  const pump = Math.sin(cycle + Math.PI) * 46 * stride;
  const raiseT = interpolate(frame, [raiseStart, raiseEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Slow wave once the arms are up; each figure leads slightly differently.
  const wave = Math.sin((frame - raiseEnd) * 0.22 + (dir === 1 ? Math.PI / 3 : 0)) * 13 * raiseT;

  // Upper arm swings from "pumping at the side" to "raised toward the title".
  //
  // The arm segment is drawn pointing DOWN (+y) from the shoulder and SVG
  // rotate() is clockwise, so 0° hangs straight down and a POSITIVE angle
  // swings the hand toward screen-LEFT (-x). `side` -1 is the screen-left arm,
  // hence the negation below.
  //
  // The raised angle (140°) is solved from forward kinematics rather than
  // eyeballed: with a 22-unit upper arm and forearm off the shoulder, it puts
  // the hand at roughly (∓28, 10) — clear of the HAT BRIM, which is the widest
  // part of the silhouette at x ±19, and still clear once the wave swings it
  // 13° further in. Swinging nearer ±180 raises the hand higher but drags it
  // back inward, where it clips the brim and then the face.
  const armAngle = (side: -1 | 1) => {
    // At rest the arms hang a little away from the torso rather than straight
    // down through it; while running that rest pose is overridden by the pump.
    // Note the sign matches `up` below: for the screen-left arm (side -1) both
    // are positive, so the hand starts OUTSIDE the hip and the raise sweeps it
    // up and outward. Flipping this makes the arm cross the torso on the way
    // up, which reads as opening the hands inward.
    const rest = -side * 12;
    const run = interpolate(stride, [0, 1], [rest, pump * side]);
    const up = -side * 140;
    return interpolate(raiseT, [0, 1], [run, up]) + wave * side;
  };
  // Elbow is sharply bent while running (78°) and relaxes when standing (54°).
  // Raised, it straightens almost fully — the FK solve above assumes a nearly
  // straight arm, and any real bend drags the hand back down over the head.
  const elbowBend = interpolate(raiseT, [0, 1], [interpolate(stride, [0, 1], [54, 78]), 2]);

  return (
    <g
      filter="url(#inkFig_dtv2)"
      transform={`translate(${x}, ${bob})`}
      stroke={color}
      strokeWidth="4.5"
      strokeLinecap="round"
      fill="none"
    >
      {/* Mirror the whole rig by `facing` so each figure runs toward the other.
          The mirror is applied to the GAIT layer only and eases out with the
          turn (facing → 1), so it never scales through zero. */}
      <g transform={`scale(${facing < 0 ? -1 : 1}, 1) rotate(${lean * facing})`}>
        {/* Head */}
        <circle cx="0" cy="22" r="14" />
        {/* Hat — a brim across the top of the skull plus a crown. Sits at y=10
            (the head spans y 8..36), and the brim is wider than the head so it
            still reads at small sizes. The raised arms clear it: the FK solve
            puts the hands at y≈6, x≈∓19, outside the brim's ±19. */}
        <line x1="-19" y1="10" x2="19" y2="10" />
        <path d="M -11,10 L -8,-3 Q 0,-7 8,-3 L 11,10" />
        {/* Spine — runs from the shoulder line down to the hips. */}
        <line x1="0" y1="36" x2="0" y2={HIP_Y} />

        {/* Shoulder and hip bars. Without these the limbs, which are offset to
            ±9 / ±7, visibly float away from the spine at x=0 when the figure
            stands still. Both scale with `bodyWidth` so they vanish side-on. */}
        <line x1={-9 * bodyWidth} y1={SHOULDER_Y} x2={9 * bodyWidth} y2={SHOULDER_Y} />
        <line x1={-7 * bodyWidth} y1={HIP_Y} x2={7 * bodyWidth} y2={HIP_Y} />

        {/* Legs — thigh rotates at the hip, shin hinges again at the knee.
            `bodyWidth` splays the hips apart as the figure turns front-on. */}
        {([-1, 1] as const).map((side) => {
          // legB is built with side -1 and legA with +1; keep that pairing so
          // the rest splay leans each leg away from the body, not across it.
          const l = side === -1 ? legB : legA;
          const hipX = side * 7 * bodyWidth;
          return (
            <g key={side} transform={`translate(${hipX}, 0) rotate(${l.thigh} 0 ${HIP_Y})`}>
              <line x1="0" y1={HIP_Y} x2="0" y2={KNEE_Y} />
              <g transform={`translate(0, ${KNEE_Y}) rotate(${l.knee})`}>
                <line x1="0" y1="0" x2="0" y2={SHIN} />
                {/* Foot points along the rig's local +x (see nose comment) */}
                <line x1="0" y1={SHIN} x2="8" y2={SHIN} />
              </g>
            </g>
          );
        })}

        {/* Arms — upper arm at the shoulder, forearm hinged at the elbow.
            Shoulders open outward as the body turns to face front. */}
        {([-1, 1] as const).map((side) => (
          <g
            key={side}
            transform={`translate(${side * 9 * bodyWidth}, 0) rotate(${armAngle(side)} 0 ${SHOULDER_Y})`}
          >
            <line x1="0" y1={SHOULDER_Y} x2="0" y2={SHOULDER_Y + 22} />
            <g transform={`translate(0, ${SHOULDER_Y + 22}) rotate(${-elbowBend * side})`}>
              <line x1="0" y1="0" x2="0" y2="22" />
            </g>
          </g>
        ))}
      </g>
    </g>
  );
};

/**
 * Motion variant of DrawnTitle ("Big Reveal").
 *
 * Same markup, props and typography as the base layout — only the animation
 * differs: the title wipes in instead of typing out, and instead of one figure
 * walking across the bottom, TWO figures run in from opposite sides (each
 * facing its direction of travel), plant either side of centre, turn to face
 * front, then raise both arms toward the title and wave them.
 */
export const DrawnTitleV2: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  // ── Beat map ────────────────────────────────────────────────────────────
  // 0-42    two figures run in from both sides, facing their travel direction
  // 42-56   they plant and turn to face front
  // 20-56   title wipes in left→right
  // 56-74   both arms sweep up to point at the title
  // 74+     arms wave; narration wipes in
  const RUN_END = 42;
  const TURN_END = 56;
  const RAISE_START = 56;
  const RAISE_END = 74;
  const TITLE_IN = [20, 56] as const;
  const LINE_IN = [46, 76] as const;
  const NARR_IN = [80, 116] as const;

  const titleProgress = interpolate(frame, [TITLE_IN[0], TITLE_IN[1]], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationProgress = interpolate(frame, [NARR_IN[0], NARR_IN[1]], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineW = interpolate(frame, [LINE_IN[0], LINE_IN[1]], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleClipRight = 100 - titleProgress * 100;
  const narrationClipRight = 100 - narrationProgress * 100;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px"
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <InkDefs />
        <filter id="grain_dtv2">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain_dtv2)" fill="none" />

        {/* Decorative corner cross-hatches for portrait */}
        {p && (
          <g stroke={textColor} strokeWidth="2" strokeOpacity="0.15" filter="url(#ink_dtv2)">
            <path d="M40,60 L80,100 M80,60 L40,100" />
            <path d="M880,880 L920,920 M920,880 L880,920" transform="translate(40, -40)" />
          </g>
        )}
      </svg>

      {/* Main Content Area */}
      <div
        style={{
          position: "absolute",
          // The block is anchored to the BOTTOM of a region that stops above
          // the figures, rather than to the top of the frame. Combined with
          // justifyContent "flex-end" this means extra title/narration lines
          // grow UPWARD into the empty space instead of downward into the
          // stickmen — long copy can never collide with the raised arms.
          top: 0,
          left: 0,
          right: 0,
          // Figure band top sits at 45.5% (landscape) / 54.5% (portrait) from
          // the bottom; these leave ~3% clearance above it.
          bottom: p ? "58%" : "49%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          textAlign: "center",
          // The bottom padding is the gap between the last line of narration
          // and the top of the figures; without it `flex-end` would butt the
          // text right up against them.
          // Side padding kept tight so long titles and narration have room:
          // at 14% the inner box was only 922px of a 1280 frame, and the
          // narration's own 76% cap cut that to 700px — barely half the width.
          padding: p ? "8% 6% 4% 6%" : "5% 9% 3% 9%",
          zIndex: 10,
        }}
      >
        {/* Title — marker wipe reveal */}
        <div style={{ position: "relative", maxWidth: "100%" }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              lineHeight: 1.1,
              fontSize: titleFontSize ?? (p ? 81 : 61),
              letterSpacing: "0.01em",
              opacity: 0,
            }}
          >
            {title}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(0 ${titleClipRight}% 0 0)`,
              color: textColor,
              fontWeight: 700,
              lineHeight: 1.1,
              fontSize: titleFontSize ?? (p ? 81 : 61),
              letterSpacing: "0.01em",
              filter: "url(#ink_dtv2)",
            }}
          >
            {title}
          </div>
        </div>

        {/* Animated Underline */}
        <svg
          style={{
            width: p ? 440 : 860,
            maxWidth: "90%",
            height: 14,
            marginTop: p ? 30 : 20,
            marginBottom: p ? 20 : 0,
            overflow: "visible"
          }}
          viewBox="0 0 720 14"
          preserveAspectRatio="none"
        >
          <filter id="inkLine_dtv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <path
            d="M 0,7 Q 180,4 360,8 Q 540,12 720,7"
            fill="none"
            stroke={accentColor}
            strokeWidth="9"
            strokeOpacity="0.22"
            strokeLinecap="round"
            filter="url(#inkLine_dtv2)"
            strokeDasharray={800}
            strokeDashoffset={800 * (1 - lineW / 100)}
          />
          <path
            d="M 0,7 Q 180,4 360,8 Q 540,12 720,7"
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#inkLine_dtv2)"
            strokeDasharray={800}
            strokeDashoffset={800 * (1 - lineW / 100)}
          />
        </svg>

        {/* Narration Text — wipes in after the underline is drawn */}
        <div
          style={{
            marginTop: p ? 30 : 26,
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 37 : 27),
            fontWeight: 500,
            maxWidth: p ? "100%" : "92%",
            lineHeight: 1.45,
            position: "relative",
          }}
        >
          <div style={{ opacity: 0 }}>{narration}</div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(0 ${narrationClipRight}% 0 0)`,
              filter: "url(#ink_dtv2)",
            }}
          >
            {narration}
          </div>
        </div>
      </div>

      {/* Background/Foreground Grounds */}
      <BrokenGround color={textColor} p={p} />

      {/* TWO STICK FIGURES: run in from both sides, plant, turn to face front,
          then raise both arms toward the title and wave them. */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "12.5%" : "11.5%",
          left: 0,
          width: "100%",
          height: p ? "42%" : "34%",
          pointerEvents: "none",
          zIndex: 100,
          overflow: "visible",
        }}
        viewBox="0 0 400 150"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
      >
        <filter id="inkFig_dtv2">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="9" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" />
        </filter>

        {([-1, 1] as const).map((dir) => (
          <Runner
            key={dir}
            dir={dir}
            frame={frame}
            color={textColor}
            runEnd={RUN_END}
            turnEnd={TURN_END}
            raiseStart={RAISE_START}
            raiseEnd={RAISE_END}
            gap={p ? 62 : 88}
          />
        ))}
      </svg>

    </AbsoluteFill>
  );
};
