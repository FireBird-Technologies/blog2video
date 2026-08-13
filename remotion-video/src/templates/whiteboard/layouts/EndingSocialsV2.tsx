import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

/**
 * Variant of EndingSocials ("Signpost").
 *
 * This differs from the base in LAYOUT as well as motion, so it reads as a
 * different ending rather than a restyled one.
 *
 * - Composition: the base is a single centred column — title, rule, figure,
 *   socials — stacked down the middle. Here the frame is split: a LEFT-ALIGNED
 *   copy column (title, rule under its left edge, subtext, socials as a row,
 *   extra CTAs as small tags) sits beside a SIGNPOST standing on a shared
 *   ground line to the right. Portrait recentres the post beneath the copy.
 * - The CTA is not a card the figure holds; it is a SIGN that ends up hanging
 *   from the post's cross-arm, carrying both the button text and the URL. Any
 *   EXTRA CTAs are already fitted on a lower arm when the scene opens — only
 *   the main one drops in and gets hung, so the business stays readable.
 * - Motion: the copy column fades in immediately, then he runs in on a real
 *   stride cycle, the sign falls and lands (squashing and jolting him on
 *   impact), he crouches and picks it up, raises it onto the hooks, lets it
 *   swing, then steps back and points at it. Every transition is smoothstepped
 *   (see `smooth`) so it eases in and out instead of starting and stopping
 *   at full speed.
 *
 * Every limb is two-segment with a solved joint (see `solveJoint`), so knees
 * and elbows actually bend — single straight hip-to-foot lines are what made
 * the earlier run read as a rigid scissor.
 */
// Limb segment lengths for this rig's 100×150 viewBox.
//
// These must EXCEED the furthest reach each limb is asked for, or the IK
// clamps and the limb renders dead straight with no visible joint. Measured
// across the whole animation: the carry arm reaches up to 65 units (down to
// the board on the ground) and the legs up to 62 (hip y=90 to foot y=145 plus
// the stride swing), so segment pairs of 35 and 34 leave a little headroom.
const UPPER_ARM = 35;
const FOREARM = 35;
const THIGH = 34;
const SHIN = 34;

/**
 * Smoothstep — eases a 0..1 ramp so it starts and ends at zero velocity.
 *
 * A raw `interpolate` ramp is linear: the value jumps straight to full speed on
 * the first frame and stops dead on the last, which reads as a pop at both
 * ends. Passing the ramp through this makes every transition ease in and out,
 * which is what makes the figure's motion look smooth rather than mechanical.
 */
function smooth(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Two-bone IK: given a root (shoulder/hip) and an end point (hand/ankle),
 * find the joint (elbow/knee) that keeps both segments at fixed length.
 *
 * Drawing a limb as a single straight line — as this layout previously did for
 * both arms and both legs — is what makes it read as stubby and rigid: there is
 * no joint to bend, so the run is a scissor and the arm never articulates.
 *
 * `bendSign` selects which of the two mirror solutions to use.
 */
function solveJoint(
  sx: number, sy: number,
  ex: number, ey: number,
  upper: number, lower: number,
  bendSign: 1 | -1,
) {
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.max(1e-3, Math.min(Math.hypot(dx, dy), upper + lower - 0.01));
  const a = (dist * dist + upper * upper - lower * lower) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x: sx + ux * a - bendSign * uy * h,
    y: sy + uy * a + bendSign * ux * h,
  };
}

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
  descriptionFontSize
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // ── Beat map ────────────────────────────────────────────────────────────
  //   0 – 40   stickman runs in from the left and plants beside the post
  //  44 – 64   the sign falls in from above and hits the ground
  //  64 – 82   the sign bounces and settles; the impact jolts him
  //  70 – 92   he crouches, picks it up and raises it to carry height
  //  92 – 112  he lifts it onto the cross-arm hooks and lets go
  // 112 +      he steps back and points at it; the copy column writes in
  const RUN_END = 40;
  const DROP_START = 44;
  const DROP_END = 64;
  const PICK_START = 70;
  const PICK_END = 92;

  // --- Animation Timings ---
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const entrance = interpolate(frame, [6, 34], [0, 1], { extrapolateRight: "clamp" });
  // The copy column fades in at the START — title, subtext and socials are
  // established up front, so the scene reads as "here is the message" while the
  // stickman does the sign business beside it, rather than the viewer waiting
  // ~4s with an empty left half.
  const subtextIn = interpolate(frame, [14, 40], [0, 1], { extrapolateRight: "clamp" });
  const socialsIn = interpolate(frame, [24, 52], [0, 1], { extrapolateRight: "clamp" });
  // The extra CTAs are already hanging on the post from the start (see below),
  // so they fade up with the post rather than waiting for the main sign.
  const extraCardsIn = interpolate(frame, [18, 44], [0, 1], { extrapolateRight: "clamp" });

  // --- 1. Run in from the left ---
  const walkT = interpolate(frame, [4, RUN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ease-out on the approach so he decelerates into the plant.
  const walkEased = 1 - Math.pow(1 - walkT, 3);
  const walkInX = interpolate(walkEased, [0, 1], [p ? -320 : -420, 0]);
  // Ease the gait out over the last frames rather than cutting it, so the legs
  // do not snap from mid-stride to standing in one frame.
  const stride = smooth(
    interpolate(frame, [RUN_END - 10, RUN_END + 4], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // The whole rig fades up as it enters.
  const stickmanPop = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" });

  // --- 2. The board falls, lands and bounces ---
  const dropT = interpolate(frame, [DROP_START, DROP_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Gravity: accelerate downward (t²) rather than fall linearly.
  const dropFall = 1 - Math.pow(1 - dropT, 2);
  // Settle bounce — a decaying hop after impact.
  const settleT = interpolate(frame, [DROP_END, DROP_END + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bounce = Math.abs(Math.sin(settleT * Math.PI * 2)) * (1 - settleT) * 14;
  // The board squashes on impact and springs back — the classic squash-and-
  // stretch that sells a landing as having weight.
  const squash = Math.max(0, 1 - settleT * 5);
  const boardScaleY = 1 - squash * 0.22;
  const boardScaleX = 1 + squash * 0.16;
  // Board tumbles a little as it falls, then straightens on the ground.
  const dropSpin = interpolate(dropT, [0, 1], [-14, 0]);

  // IMPACT REACTION — the landing jolts the stickman: he flinches down and
  // recoils, decaying over ~14 frames. Without this the board thuds down and
  // the figure ignores it, which reads as two unrelated animations.
  const impactT = interpolate(frame, [DROP_END, DROP_END + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const impact = frame < DROP_END ? 0 : Math.sin(impactT * Math.PI * 3) * (1 - impactT);
  const jolt = impact * 7;

  // --- 3. Pick it up ---
  const pickT = interpolate(frame, [PICK_START, PICK_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ease-in-out so the lift starts and finishes gently.
  const pickEased = pickT < 0.5
    ? 2 * pickT * pickT
    : 1 - Math.pow(-2 * pickT + 2, 2) / 2;
  // The body crouches into the pick-up and straightens as it lifts.
  const crouch = Math.sin(pickT * Math.PI) * 16;

  // --- 4. Idle / stride motion ---
  const strideCycle = frame * 0.34;
  const idleCycle = frame * 0.07;
  const heavyBob =
    Math.sin(strideCycle * 2) * 6 * stride +
    Math.sin(idleCycle) * 3.5 * (1 - stride);
  const legSway =
    Math.cos(strideCycle) * 6 * stride +
    Math.cos(idleCycle) * 2 * (1 - stride);

  // Rotation of the board once it is being carried.
  const swayRotation = interpolate(heavyBob, [-7, 7], [-4, 4]) * pickEased;

  // --- 5. Hang the sign, then present it ---
  // After the pick-up he raises the board onto the signpost hooks, lets go,
  // and steps back to point at it. This replaces the base layout's "hold the
  // board and wave" ending.
  const HANG_END = PICK_END + 20;
  const hangT = smooth(
    interpolate(frame, [PICK_END, HANG_END], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // Board swings on its hooks after being let go, settling to rest.
  const hangSwing = Math.sin((frame - HANG_END) * 0.22) * 7 *
    Math.max(0, 1 - (frame - HANG_END) / 40) * (frame > HANG_END ? 1 : 0);
  // He steps back from the post once the sign is up.
  const stepBack = smooth(
    interpolate(frame, [HANG_END + 2, HANG_END + 24], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // …then raises the free arm to point at the sign, holding the gesture.
  const pointIn = smooth(
    interpolate(frame, [HANG_END + 14, HANG_END + 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const waveIn = pointIn;
  const waveAngle = Math.sin((frame - HANG_END - 26) * 0.2) * 8 * pointIn;

  const subtext = (narration ?? "").trim();
  const markerFont = (fontFamily ?? "").trim() || "'Patrick Hand', system-ui, sans-serif";

  // CTA cards (1-3). Only render cards with toggle on + a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const firstCard = cards[0];
  const extraCards = cards.slice(1);
  const showWebsiteCta = !!firstCard;
  const resolvedCta = firstCard?.ctaButtonText.trim() || "Get started";
  const resolvedWebsiteLink = firstCard?.websiteLink ?? "";

  // --- Stickman Bone Map ---
  // `crouch` dips the whole upper body during the pick-up and returns it.
  const hipX = 50 + legSway;
  const hipY = 90 + heavyBob + crouch * 0.35 + jolt * 0.5;
  const shoulderX = hipX + (legSway * 0.5);
  const shoulderY = 60 + (heavyBob * 0.4) + crouch + jolt;
  const headX = shoulderX + (legSway * 0.2);
  const headY = 30 + (heavyBob * 0.2) + crouch * 1.1 + jolt * 1.2;

  // Feet stride apart while running, then plant.
  const footSpread = Math.sin(strideCycle) * 14 * stride;

  // The carrying hand reaches DOWN to the board on the ground during the
  // pick-up, then lifts to carry height. The horizontal offset is kept modest
  // (38) so the reach stays inside the arm's span in BOTH poses — a wider one
  // over-extends on the reach-down and the arm renders as a rigid stick.
  const carryHandX = shoulderX + 38 + legSway;
  const carryHandY = interpolate(pickEased, [0, 1], [shoulderY + 48, shoulderY + 8]);

  // The free hand hangs and swings while running, then rises to POINT up and
  // across at the hung sign. Expressed as a POSITION so the arm bends at the
  // elbow to reach it rather than pivoting as one rigid stick.
  const freeHandX = interpolate(
    pointIn,
    [0, 1],
    [shoulderX - 22 - Math.sin(strideCycle) * 12 * stride, shoulderX + 34],
  );
  const freeHandY = interpolate(
    pointIn,
    [0, 1],
    [shoulderY + 32 + Math.cos(strideCycle) * 8 * stride, shoulderY - 26],
  );

  // Knee/ankle targets. The legs run a real stride cycle — thigh swings from
  // the hip, shin hinges again at the knee — instead of two straight lines
  // from hip to foot, which is what made the run read as a rigid scissor.
  const legPose = (phase: number, side: -1 | 1) => {
    const ph = strideCycle + phase;
    // Ankle travels forward and back through the cycle.
    const ankleX = hipX + Math.sin(ph) * 16 * stride;
    // The foot may only lift while it is travelling FORWARD (the swing phase);
    // while it travels back it is the planted stance foot and stays down.
    // sin(ph) is increasing exactly where cos(ph) > 0, so cos gates the lift.
    // Using sin(ph - PI/2) here instead lifted the foot while it moved
    // backwards, which read as the figure moonwalking against its own travel.
    const lift = Math.max(0, Math.cos(ph)) * 20 * stride;
    // Standing: the feet settle a little apart so BOTH stay visible instead of
    // converging into a single line under the hips. Squared so it stays ~0
    // while the gait is still running — a linear ramp pulls the foot backwards
    // fast enough to briefly cancel the forward swing during the hand-off.
    const stanceSplay = side * 11 * Math.pow(1 - stride, 2);
    return { x: ankleX + stanceSplay, y: 145 - lift };
  };
  const legA = legPose(0, 1);
  const legB = legPose(Math.PI, -1);


  // ── Signpost geometry (landscape %; portrait recentres below) ────────────
  const GROUND_PCT = p ? 84 : 82;      // ground line, % from the top
  // Where the post stands, % across. The extra CTA signs hang to the RIGHT of
  // it, so this has to leave room before the frame edge. The original 72% was
  // only safe because signs were content-sized; a long CTA label ran off the
  // canvas. With the fixed widths below the rightmost element lands at ~1142px
  // on a 1280 canvas, leaving ~138px of margin.
  const POST_X_PCT = p ? 50 : 67;

  // Fixed sign widths, in the signpost box's 400-unit space. Verified against
  // the frame: with the post at 62%, the main sign spans ~704–984px and the
  // extras end at ~1078px on a 1280 canvas, both clear of the edge. Fixed
  // rather than content-sized so a long CTA cannot widen the sign at all.
  const MAIN_SIGN_W = p ? 300 : 280;
  const EXTRA_SIGN_W = p ? 230 : 220;

  // Sign text caps. Long CTA labels and URLs wrap to a second line and then
  // ellipsize, rather than growing the sign until it leaves the frame.
  const clampLines = (lines: number): React.CSSProperties => ({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    wordBreak: "break-word",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Ground line — shared by the copy column and the signpost, so the
          whole scene sits in one space rather than a floating centred stack. */}
      <div
        style={{
          position: "absolute",
          left: p ? "8%" : "5%",
          right: p ? "8%" : "5%",
          top: `${GROUND_PCT}%`,
          height: 5,
          borderRadius: 3,
          backgroundColor: `${textColor || "#111"}33`,
          opacity: fade,
        }}
      />

      {/* ── COPY COLUMN — left-aligned, unlike the base's centred stack ──── */}
      <div
        style={{
          position: "absolute",
          left: p ? "8%" : "6%",
          top: p ? "8%" : "12%",
          width: p ? "84%" : "48%",
          textAlign: "left",
          opacity: fade,
          zIndex: 3,
        }}
      >
        <div style={{
            fontSize: titleFontSize ?? (p ? 74 : 61),
            fontWeight: 700,
            color: textColor || "#111111",
            fontFamily: markerFont,
            opacity: entrance,
            transform: `translateX(${interpolate(entrance, [0, 1], [-24, 0])}px)`,
            lineHeight: 1.08,
          }}>
          {title}
        </div>

        {/* Rule sits UNDER the left edge of the title, not centred */}
        <div style={{
            height: 6,
            width: interpolate(entrance, [0, 1], [0, p ? 220 : 300]),
            borderRadius: 999,
            backgroundColor: `${accentColor}66`,
            marginTop: 14,
          }}
        />

        {subtext ? (
          <div style={{
              marginTop: 22,
              fontSize: descriptionFontSize ?? (p ? 35 : 24),
              color: `${textColor || "#111111"}CC`,
              fontFamily: markerFont,
              opacity: subtextIn,
              transform: `translateX(${interpolate(subtextIn, [0, 1], [-16, 0])}px)`,
              maxWidth: p ? "100%" : 560,
              lineHeight: 1.35,
            }}>
            {subtext}
          </div>
        ) : null}

        {/* Socials — a left-aligned row, set well below the copy so the block
            reads as a distinct footer rather than crowding the subtext. */}
        <div style={{
          marginTop: p ? 64 : 56,
          opacity: socialsIn,
          transform: `translateX(${interpolate(socialsIn, [0, 1], [-16, 0])}px)`,
        }}>
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={textColor || "#111"}
            maxPerRow={p ? 3 : 3}
            fontFamily={markerFont}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>

      {/* ── THE SIGNPOST + STICKMAN ─────────────────────────────────────── */}
      {showWebsiteCta ? (
        <div
          style={{
            position: "absolute",
            left: `${POST_X_PCT}%`,
            top: `${GROUND_PCT}%`,
            transform: "translate(-50%, -100%)",
            zIndex: 2,
            opacity: fade,
          }}
        >
          <div style={{ position: "relative", width: p ? 340 : 400, height: p ? 330 : 360 }}>

            {/* The post itself — drawn on, then stands */}
            <svg
              viewBox="0 0 400 360"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
              fill="none"
            >
              <g stroke={textColor || "#111"} strokeWidth={7} strokeLinecap="round">
                {/* Upright */}
                <line
                  x1={250} y1={356} x2={250} y2={70}
                  strokeDasharray={300}
                  strokeDashoffset={300 * (1 - entrance)}
                />
                {/* Cross-arm the sign hangs from */}
                <line
                  x1={170} y1={78} x2={330} y2={78}
                  strokeDasharray={170}
                  strokeDashoffset={170 * (1 - entrance)}
                />
                {/* Hooks for the main sign */}
                <line x1={196} y1={78} x2={196} y2={96} strokeWidth={4} opacity={hangT} />
                <line x1={304} y1={78} x2={304} y2={96} strokeWidth={4} opacity={hangT} />
                {/* Lower cross-arm — the extra CTAs are already hanging here
                    when the scene opens; only the MAIN sign is the one that
                    falls and gets fitted. */}
                {extraCards.length > 0 ? (
                  <line
                    x1={250} y1={186} x2={286} y2={186}
                    strokeDasharray={140}
                    strokeDashoffset={140 * (1 - extraCardsIn)}
                  />
                ) : null}
                {/* Ground shadow at the base of the post */}
                <line x1={222} y1={356} x2={278} y2={356} strokeWidth={5} strokeOpacity={0.35} />
              </g>
            </svg>

            {/* EXTRA CTAs — already fitted on the lower arm from the start.
                Two hang side by side; a third stacks below them. */}
            {extraCards.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 264,
                  top: 176,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                  opacity: extraCardsIn,
                }}
              >
                {extraCards.map((card, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: p ? "7px 12px" : "8px 14px",
                    border: `3px solid ${textColor || "#111"}`,
                    borderRadius: 9,
                    backgroundColor: "#FFFFFF",
                    color: textColor || "#111",
                    fontFamily: markerFont,
                    boxShadow: `4px 4px 0px ${accentColor}33`,
                    // Hard cap: long labels wrap and then ellipsize instead of
                    // stretching the sign off the right of the frame.
                    width: EXTRA_SIGN_W,
                    boxSizing: "border-box",
                    textAlign: "center",
                    // Each hangs at a slightly different angle, like real signs.
                    transform: `rotate(${idx % 2 === 0 ? -2.5 : 2}deg)`,
                  }}>
                    <span style={{
                      fontSize: p ? 19 : 20,
                      fontWeight: 800,
                      lineHeight: 1.15,
                      ...clampLines(2),
                    }}>
                      {card.ctaButtonText.trim() || "Get started"}
                    </span>
                    <span style={{
                      fontSize: p ? 12 : 13,
                      fontWeight: 600,
                      opacity: 0.7,
                      lineHeight: 1.2,
                      ...clampLines(2),
                    }}>
                      {card.websiteLink}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* THE SIGN BOARD — falls, is picked up, then hangs from the arm.
                Its position lerps from "held at carry height" to "on the
                hooks", so the hand hands it over rather than it teleporting. */}
            {(() => {
              // Ground rest position (where it lands), in this 400×360 box.
              const groundY = 318;
              const carryY = 190;
              const hangY = 120;
              const fallY = interpolate(dropFall, [0, 1], [-380, groundY]);
              // fall → land → carried up → hung on the post
              const yAfterPick = interpolate(pickEased, [0, 1], [fallY + bounce, carryY]);
              const y = interpolate(hangT, [0, 1], [yAfterPick, hangY]);
              // Kept LEFT of the post until it is hung, so the falling/landing sign
              // never crosses the extra CTAs already fitted on the lower arm.
              const x = interpolate(hangT, [0, 1], [118, 250]);
              const rot = interpolate(hangT, [0, 1], [
                interpolate(pickEased, [0, 1], [dropSpin, swayRotation]),
                hangSwing,
              ]);
              return (
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${boardScaleX}, ${boardScaleY})`,
                    transformOrigin: "50% 0%",
                    opacity: frame < DROP_START ? 0 : 1,
                  }}
                >
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: p ? "12px 22px" : "14px 28px",
                    border: `4px solid ${textColor || "#111"}`,
                    borderRadius: 12,
                    backgroundColor: "#FFFFFF",
                    color: textColor || "#111",
                    fontFamily: markerFont,
                    boxShadow: `6px 6px 0px ${accentColor}44`,
                    // Capped so a long CTA or URL wraps to a second line and
                    // then ellipsizes instead of widening past the frame.
                    width: MAIN_SIGN_W,
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}>
                    <span style={{
                      fontSize: p ? 26 : 30,
                      fontWeight: 800,
                      lineHeight: 1.15,
                      ...clampLines(2),
                    }}>
                      {resolvedCta}
                    </span>
                    <span style={{
                      fontSize: p ? 15 : 16,
                      fontWeight: 600,
                      opacity: 0.75,
                      marginTop: 2,
                      lineHeight: 1.2,
                      ...clampLines(2),
                    }}>
                      {resolvedWebsiteLink}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* THE STICKMAN — runs in, drops back after hanging the sign */}
            <svg
              viewBox="0 0 100 150"
              style={{
                position: "absolute",
                left: interpolate(stepBack, [0, 1], [96, 26]) + walkInX,
                bottom: -6,
                width: 150,
                height: 225,
                overflow: "visible",
                opacity: stickmanPop,
                zIndex: 2,
              }}
              fill="none"
            >
              <g stroke={textColor || "#111"} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                {/* Legs — hip → knee → ankle, with feet */}
                {[legB, legA].map((ankle, i) => {
                  const knee = solveJoint(hipX, hipY, ankle.x, ankle.y, THIGH, SHIN, -1);
                  return (
                    <g key={i}>
                      <path d={`M${hipX},${hipY} L${knee.x.toFixed(1)},${knee.y.toFixed(1)} L${ankle.x.toFixed(1)},${ankle.y.toFixed(1)}`} />
                      <line x1={ankle.x} y1={ankle.y} x2={ankle.x + 9} y2={ankle.y} />
                    </g>
                  );
                })}

                {/* Spine + head */}
                <line x1={hipX} y1={hipY} x2={shoulderX} y2={shoulderY} />
                <circle cx={headX} cy={headY} r={15} />

                {/* Working arm — reaches the board, lifts it, then hangs it */}
                {(() => {
                  // Once hanging, the hand rises to the cross-arm.
                  const hx = interpolate(hangT, [0, 1], [carryHandX, shoulderX + 30]);
                  const hy = interpolate(hangT, [0, 1], [carryHandY, shoulderY - 30]);
                  const elbow = solveJoint(shoulderX, shoulderY, hx, hy, UPPER_ARM, FOREARM, -1);
                  return (
                    <path d={`M${shoulderX},${shoulderY} L${elbow.x.toFixed(1)},${elbow.y.toFixed(1)} L${hx.toFixed(1)},${hy.toFixed(1)}`} />
                  );
                })()}

                {/* Free arm — swings on the run, then POINTS at the sign */}
                <g transform={`rotate(${-waveAngle} ${shoulderX} ${shoulderY})`}>
                  {(() => {
                    const elbow = solveJoint(shoulderX, shoulderY, freeHandX, freeHandY, UPPER_ARM, FOREARM, 1);
                    return (
                      <path d={`M${shoulderX},${shoulderY} L${elbow.x.toFixed(1)},${elbow.y.toFixed(1)} L${freeHandX.toFixed(1)},${freeHandY.toFixed(1)}`} />
                    );
                  })()}
                </g>
              </g>
            </svg>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
