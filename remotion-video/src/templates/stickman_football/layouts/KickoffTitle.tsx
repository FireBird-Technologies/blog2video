import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const KickoffTitle: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const subline = (props as any).subline as string | undefined;

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  // Colors with fallbacks
  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  // Match the stickman_2 / whiteboard hand-drawn font family.
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  // Canvas dimensions (drawn in this coordinate space, scaled by the SVG viewBox)
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const cx = W / 2;

  // ── Choreography timeline (fractions of a FIXED 4-second window) ─────────────
  // The full motion always completes in 4 seconds, independent of the scene length;
  // after that, `f` clamps at 1 so the final "facing-camera, ball-in-hand" pose holds
  // for the remainder of the scene. T values are fractions of those 4 seconds.
  //   0.00–0.14  kicker centred, ball held in both hands
  //   0.14–0.18  ball drops from the hands to the feet
  //   0.18–0.22  leg wind-up → kick upward from the foot
  //   0.22–0.32  ball flies up (apex slightly right of centre)
  //   0.32       IMPACT → title + narration appear
  //   0.32–0.42  ball drops down and drifts slightly right
  //   0.42–0.52  ball bounces and settles to the right
  //   0.52–0.72  kicker bends and picks it up
  //   0.72–1.00  hold (faces camera, ball in right hand)
  const MOTION_FRAMES = 4 * fps;
  const f = Math.min(1, frame / MOTION_FRAMES);
  const T = {
    control: 0.06,
    release: 0.14,     // let the ball go from the hands
    footReady: 0.18,   // ball rests at the feet, leg wind-up begins
    windup: 0.18,
    kick: 0.22,        // foot strike upward
    flightEnd: 0.32,
    impact: 0.32,
    dropEnd: 0.42,
    bounceEnd: 0.52,
    bendStart: 0.52,
    pickup: 0.62,
    pickupEnd: 0.72,
  };

  const seg = (a: number, b: number, easing?: (t: number) => number) => {
    const t = interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return easing ? easing(t) : t;
  };
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeIn = (t: number) => t * t;
  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // --- Scene-level enter/exit ---
  const enter = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  // --- Pitch lines drift in ---
  const pitchProgress = seg(0, 0.16, easeOut);
  const pitchLeftX = interpolate(pitchProgress, [0, 1], [-30, 0]);
  const pitchRightX = interpolate(pitchProgress, [0, 1], [30, 0]);
  const pitchOpacity = pitchProgress;

  // ── Key world positions ──────────────────────────────────────────────────
  const groundY = H * 0.82;            // grass path baseline (feet rest here)
  const kickerX = cx;                  // kicker stays centred from the start
  const tossDrift = p ? 72 : 98;       // how far right the ball lands after the drop
  const impactX = cx + tossDrift * 0.38; // apex sits slightly right of centre
  const impactY = H * 0.30;            // upper-centre height
  const restX = cx + tossDrift;        // ball settles slightly to the right
  // ── Sizing (bumped up) ──────────────────────────────────────────────────────
  const ballR = 30;                    // bigger ball
  const FIG = p ? 2.2 : 1.5;           // larger stickman in portrait, normal in landscape
  const torsoLen = 52 * FIG;
  const headR = 20 * FIG;
  const headLen = 20 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;

  const restBallY = groundY - ballR;   // ball rests just above ground
  const shoulderApproxY = groundY - (thighLen + shinLen) - torsoLen;
  const initBallX = kickerX + 62;
  const initBallY = shoulderApproxY - 20;
  const footBallX = kickerX + 38;
  const footBallY = groundY - ballR;

  // Kicker stays centred — no run-up or run-forward.
  const manX = kickerX;
  const running = false;

  // ── Teammates: 4 extra stickmen run in as the ball is kicked — two from the
  // left and two from the right — then line up beside the centred kicker.
  const mainFinalX = kickerX;
  const lineGap = 150;
  const teammateDefs = [
    { side: -1, finalOffset: -lineGap * 1.8 },
    { side: -1, finalOffset: -lineGap * 3.0 },
    { side: 1, finalOffset: lineGap * 1.8 },
    { side: 1, finalOffset: lineGap * 3.0 },
  ];
  const teammates = teammateDefs.map((d, i) => {
    const finalX = mainFinalX + d.finalOffset;
    const enterStartX = d.side < 0 ? -120 : W + 120;
    const tStart = T.kick + i * 0.025;
    const tEnd = T.pickupEnd - 0.02;
    const prog = interpolate(f, [tStart, tEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const eased = easeOut(prog);
    const x = interpolate(eased, [0, 1], [enterStartX, finalX]);
    const isRunning = f >= tStart && prog < 0.999;
    const runBlend = isRunning ? 1 : 0;
    const visible = f >= tStart - 0.01;
    const facingDir = finalX >= enterStartX ? 1 : -1;
    return { x, runBlend, visible, phase: i * 1.7, facingDir };
  });

  // Gait (matched to the whiteboard DrawnTitle figure): the thigh swings fore/aft and
  // the knee bend LAGS the swing by 90° and only ever bends the shin backward, so the
  // trailing foot lifts and tucks cleanly. The vertical anchor is computed later so the
  // lowest foot always plants on the ground (no floating).
  const gaitCycle = frame * 0.34;
  const gaitLeg = (phaseOffset: number) => {
    const ph = gaitCycle + phaseOffset;
    return {
      thigh: Math.sin(ph) * 32,                                  // + = forward, − = behind the body
      knee: Math.max(0, Math.sin(ph - Math.PI / 2)) * 52 + 8,    // 90°-lagged backward bend (small constant float)
    };
  };
  const armSwing = running ? Math.sin(gaitCycle) * 26 : 0;

  // ── Kick state: hold → drop → leg wind-up → foot strike ─────────────────────
  const strikeEnd = T.kick + 0.025;
  const kickState = (() => {
    let kickLeg = 0, plantBend = 0, torsoBias = 0;
    if (f < T.windup) {
      kickLeg = 0;
    } else if (f < T.kick) {
      const wt = seg(T.windup, T.kick, easeIn);
      kickLeg = -0.42 * wt;
      plantBend = 0.2 * wt;
      torsoBias = 8 * wt;
    } else if (f < strikeEnd) {
      const st = seg(T.kick, strikeEnd);
      kickLeg = -0.42 + 1.46 * st;
      plantBend = 0.4;
      torsoBias = 8 * (1 - st);
    } else if (f < T.flightEnd) {
      const ft = seg(strikeEnd, T.flightEnd);
      kickLeg = 1.04 - ft * 0.54;
      plantBend = 0.3 * (1 - ft);
    } else {
      kickLeg = 0;
    }
    return { kickLeg, plantBend, torsoBias };
  })();

  // ── Ball trajectory ─────────────────────────────────────────────────────────
  const releaseProg = seg(T.release, T.footReady, easeIn);
  const flight = seg(T.kick, T.flightEnd, easeOut);
  const drop = seg(T.impact, T.dropEnd, easeIn);
  const bounce = seg(T.dropEnd, T.bounceEnd);
  const pickup = seg(T.pickup, T.pickupEnd, easeOut);

  const handHoldX = manX + 78;
  const handHoldY = groundY - (thighLen + shinLen) - 64;

  let ballX: number;
  let ballY: number;
  let ballHeld = false;
  if (f < T.release) {
    ballX = initBallX + Math.sin(tSec * 2.2) * 2;
    ballY = initBallY;
    ballHeld = true;
  } else if (f < T.footReady) {
    ballX = interpolate(releaseProg, [0, 1], [initBallX, footBallX]);
    ballY = interpolate(releaseProg, [0, 1], [initBallY, footBallY]);
    ballHeld = releaseProg < 0.72;
  } else if (f < T.kick) {
    ballX = footBallX;
    ballY = footBallY;
  } else if (f < T.flightEnd) {
    ballX = interpolate(flight, [0, 1], [footBallX, impactX]);
    const arcLift = Math.sin(flight * Math.PI) * (H * 0.04);
    ballY = interpolate(flight, [0, 1], [footBallY, impactY]) - arcLift;
  } else if (f < T.dropEnd) {
    ballX = interpolate(drop, [0, 1], [impactX, restX]);
    ballY = interpolate(drop, [0, 1], [impactY, restBallY]);
  } else if (f < T.bounceEnd) {
    ballX = restX;
    const hop = Math.sin(bounce * Math.PI) * (H * 0.12) * (1 - bounce * 0.45);
    ballY = restBallY - hop;
  } else if (f < T.pickupEnd) {
    ballX = interpolate(pickup, [0, 1], [restX, handHoldX]);
    ballY = interpolate(pickup, [0, 1], [restBallY, handHoldY]);
    if (pickup > 0.5) ballHeld = true;
  } else {
    ballX = handHoldX;
    ballY = handHoldY;
    ballHeld = true;
  }

  // Ball spin: fast at kick, decays through flight and the bounce.
  const spinActive = f >= T.kick && f < T.bounceEnd;
  const ballRot = spinActive ? (f - T.kick) * 2600 : 0;
  // Squish: on the foot strike, and again on each ground contact.
  const strikeProx = Math.max(0, 1 - Math.abs(f - T.kick) / 0.02);
  const dropProx = Math.max(0, 1 - Math.abs(f - T.dropEnd) / 0.02);
  const settleProx = Math.max(0, 1 - Math.abs(f - T.bounceEnd) / 0.02);
  const squish = Math.max(strikeProx, dropProx, settleProx);
  const ballSqX = 1 + 0.42 * squish;
  const ballSqY = 1 - 0.46 * squish;

  // Kick effect burst — brief flash of speed lines + dust right at the strike.
  const kickEffect =
    interpolate(f, [T.kick - 0.005, T.kick + 0.02], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(f, [T.kick + 0.02, T.kick + 0.08], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const mainFaceOpacity = 1;

  // "Lets Play!" pops in above the ball once it's in hand and the player faces camera.
  const letsPlayProgress = seg(T.pickupEnd, T.pickupEnd + 0.08, easeOut);
  const letsPlayOpacity = letsPlayProgress;
  const letsPlayRise = interpolate(letsPlayProgress, [0, 1], [10, 0]);

  // ── Impact flash at the upper-centre ────────────────────────────────────────
  const impactFlash =
    interpolate(f, [T.impact - 0.01, T.impact + 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(f, [T.impact + 0.05, T.impact + 0.14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Text reveal — triggered BY the impact ───────────────────────────────────
  const titleProgress = seg(T.impact, T.impact + 0.14, easeOut);
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = titleProgress;
  const underlineScale = seg(T.impact + 0.06, T.impact + 0.22, easeOut);
  const textBlockOpacity = seg(T.impact + 0.1, T.impact + 0.26, easeOut);

  const imageOpacity = seg(0, 0.16, easeOut);

  const titlePx = titleFontSize ?? (p ? 92 : 76);
  const descPx = descriptionFontSize ?? (p ? 52 : 38);
  const textBlockBottom = H * (p ? 0.55 : 0.56);
  const textMaxW = p ? W * 0.88 : W * 0.74;

  // ── Stickman body anchor ─────────────────────────────────────────────────
  const phaseHold = f >= T.pickupEnd;
  const preKickHold = f < T.release;
  const ballRelease = f >= T.release && f < T.footReady;
  const kickPhase = f >= T.footReady && f < T.bendStart;
  const breath = Math.sin(tSec * 1.3) * 1.2;
  const footY = groundY;            // feet rest on the grass path
  const dir = 1;                    // stickman faces right while playing
  const { kickLeg, plantBend, torsoBias } = kickState;
  const kickFwd = Math.max(0, kickLeg);

  // Build one running leg in HIP-LOCAL space (hip at origin). Returns knee/foot
  // offsets relative to the hip, with a proper human knee (shin flexes backward).
  const buildRunLegLocal = (g: { thigh: number; knee: number }) => {
    const thighRad = (g.thigh * Math.PI) / 180;          // 0 = straight down, + = forward
    const kneeX = Math.sin(thighRad) * thighLen;
    const kneeY = Math.cos(thighRad) * thighLen;
    const shinRad = thighRad - (g.knee * Math.PI) / 180;  // shin rotates BACK from thigh
    const footX = kneeX + Math.sin(shinRad) * shinLen;
    const footY2 = kneeY + Math.cos(shinRad) * shinLen;
    return { kneeX, kneeY, footX, footY: footY2 };
  };
  const runLegA = buildRunLegLocal(gaitLeg(0));
  const runLegB = buildRunLegLocal(gaitLeg(Math.PI));
  // Anchor the hip so the LOWER of the two feet plants exactly on the ground —
  // this kills the "walking in the air" float and creates a natural bob.
  const lowestLocalFoot = Math.max(runLegA.footY, runLegB.footY);

  // Hip height: while running, derived from the planted foot; otherwise a full
  // straight leg-length above the ground.
  const hipY = running
    ? groundY - lowestLocalFoot
    : groundY - (thighLen + shinLen);

  // Bend-over to pick up the ball: torso pitches forward, then straightens.
  // bend ramps up over bendStart→pickup, holds, then unwinds over pickup→pickupEnd.
  const bendDown = seg(T.bendStart, T.pickup, easeOut);
  const bendUp = seg(T.pickup, T.pickupEnd, easeIn);
  const bendForward = Math.max(0, bendDown - bendUp); // 0..1 forward pitch amount
  const bendDeg = bendForward * 62;                   // forward lean while picking up

  // Torso lean: leans back on the strike; pitches forward while bending to pick up;
  // upright while running / holding.
  const torsoLean = phaseHold
    ? 0
    : (-dir * (torsoBias + kickFwd * 6)) + dir * bendDeg + Math.sin(tSec * 0.6) * 2;
  const torsoRad = (torsoLean * Math.PI) / 180;
  const shoulderX = manX + Math.sin(torsoRad) * torsoLen;
  const shoulderY = hipY - Math.cos(torsoRad) * torsoLen + breath;
  const headX = shoulderX + Math.sin(torsoRad) * headLen;
  const headY = shoulderY - Math.cos(torsoRad) * headLen;

  // ── Leg geometry ────────────────────────────────────────────────────────────
  // Returns hip→knee→foot points for both legs depending on phase.
  const legs = (() => {
    if (running) {
      // Translate the hip-local running legs into world space. Both knees articulate;
      // the lower foot is planted (hipY was derived from it), so no floating.
      const place = (l: { kneeX: number; kneeY: number; footX: number; footY: number }) => ({
        kneeX: manX + l.kneeX,
        kneeY: hipY + l.kneeY,
        footX: manX + l.footX,
        footY: hipY + l.footY,
      });
      return { left: place(runLegA), right: place(runLegB) };
    }

    // Planted stance while holding, dropping, or standing after the kick.
    if (kickLeg === 0 && f < T.bendStart && (f < T.windup || f >= T.flightEnd)) {
      const spread = 22 * FIG;
      const plantLeg = (sign: number) => {
        const footX = manX + sign * spread;
        const kneeX = manX + sign * spread * 0.55;
        const kneeY = (hipY + footY) / 2 + 6;
        return { kneeX, kneeY, footX, footY };
      };
      return { left: plantLeg(-1), right: plantLeg(1) };
    }

    // Kick: one plant leg + one striking leg.
    const plantFootX = manX - dir * 18 * FIG;
    const plantKneeX = (manX + plantFootX) / 2 - dir * 3 + dir * plantBend * 9;
    const plantKneeY = (hipY + footY) / 2 + 4 + plantBend * 12;
    const plantFootY = footY - plantBend * 5;

    const restFootX = manX + dir * 18 * FIG;
    const backFootX = manX - dir * 30 * FIG;   // wind-up
    const backFootY = footY - 10 * FIG;
    const extFootX = manX + dir * 28 * FIG;     // short forward — mostly an upward pop
    const extFootY = footY - 78 * FIG;

    let kFootX: number, kFootY: number;
    if (kickLeg >= 0) {
      kFootX = restFootX + (extFootX - restFootX) * kickLeg;
      kFootY = footY + (extFootY - footY) * kickLeg;
    } else {
      const wt = Math.abs(kickLeg) / 0.38;
      kFootX = restFootX + (backFootX - restFootX) * wt;
      kFootY = footY + (backFootY - footY) * wt;
    }
    const kKneeX = (manX + kFootX) / 2 + dir * 8 * kickFwd;
    const kKneeY = (hipY + kFootY) / 2 - kickFwd * 10;

    return {
      left: { kneeX: plantKneeX, kneeY: plantKneeY, footX: plantFootX, footY: plantFootY },
      right: { kneeX: kKneeX, kneeY: kKneeY, footX: kFootX, footY: kFootY },
    };
  })();

  // ── Arm geometry ────────────────────────────────────────────────────────────
  const arms = (() => {
    if (preKickHold) {
      const bx = ballX;
      const by = ballY;
      return {
        left: {
          elbowX: shoulderX - 10,
          elbowY: shoulderY + 14,
          handX: bx - ballR * 0.95,
          handY: by + ballR * 0.35,
        },
        right: {
          elbowX: shoulderX + 30,
          elbowY: shoulderY + 10,
          handX: bx + ballR * 0.15,
          handY: by + ballR,
        },
      };
    }
    if (ballRelease) {
      const open = seg(T.release + 0.02, T.footReady, easeOut);
      const bx = ballX;
      const by = ballY;
      return {
        left: {
          elbowX: shoulderX - 12,
          elbowY: shoulderY + 16,
          handX: interpolate(open, [0, 1], [bx - ballR * 0.9, shoulderX - 22]),
          handY: interpolate(open, [0, 1], [by + ballR * 0.3, shoulderY + 34]),
        },
        right: {
          elbowX: shoulderX + 28,
          elbowY: shoulderY + 12,
          handX: interpolate(open, [0, 1], [bx + ballR * 0.2, shoulderX + 24]),
          handY: interpolate(open, [0, 1], [by + ballR, shoulderY + 32]),
        },
      };
    }
    if (kickPhase && bendForward <= 0.02) {
      const sw = kickFwd * 30 + Math.sin(tSec * 1.5) * 4;
      return {
        left: { elbowX: shoulderX - dir * 16, elbowY: shoulderY + 14, handX: shoulderX - dir * (22 + sw * 0.4), handY: shoulderY + 24 + sw * 0.3 },
        right: { elbowX: shoulderX + dir * 16, elbowY: shoulderY + 10, handX: shoulderX + dir * (20 + sw * 0.5), handY: shoulderY + 20 - sw * 0.5 },
      };
    }
    if (bendForward > 0.02) {
      // Bending to pick up: the right hand reaches down toward the ball on the ground.
      const reach = bendForward;
      return {
        left: { elbowX: shoulderX - 16, elbowY: shoulderY + 18, handX: shoulderX - 22, handY: shoulderY + 34 },
        right: {
          elbowX: shoulderX + 14,
          elbowY: shoulderY + 24,
          handX: interpolate(reach, [0, 1], [shoulderX + 22, ballX]),
          handY: interpolate(reach, [0, 1], [shoulderY + 30, Math.min(groundY - ballR, ballY)]),
        },
      };
    }
    if (phaseHold) {
      // Faces camera. Right arm is clearly bent at the elbow (L-shape): upper arm
      // drops out to the side, forearm angles up to cradle the ball at the right.
      // Left arm hangs with a soft elbow bend.
      const handX = handHoldX;
      const handY = handHoldY + ballR; // hand under the ball
      return {
        left: {
          elbowX: shoulderX - 26,
          elbowY: shoulderY + 30,
          handX: shoulderX - 18,
          handY: shoulderY + 56,
        },
        right: {
          // Elbow sits low and out to the side while the hand holds the ball high →
          // a sharp, obvious L-bend between the upper arm and the raised forearm.
          elbowX: shoulderX + 40,
          elbowY: shoulderY + 44,
          handX,
          handY,
        },
      };
    }
    if (running) {
      // Arms swing opposite the legs.
      return {
        left: { elbowX: shoulderX - 14, elbowY: shoulderY + 12, handX: shoulderX - 18 - armSwing * 0.3, handY: shoulderY + 26 },
        right: { elbowX: shoulderX + 14, elbowY: shoulderY + 12, handX: shoulderX + 18 + armSwing * 0.3, handY: shoulderY + 26 },
      };
    }
    // Idle at sides between phases.
    return {
      left: { elbowX: shoulderX - 16, elbowY: shoulderY + 14, handX: shoulderX - 22, handY: shoulderY + 34 },
      right: { elbowX: shoulderX + 16, elbowY: shoulderY + 14, handX: shoulderX + 22, handY: shoulderY + 34 },
    };
  })();

  const sw = 5.5; // thicker stroke to match the larger figure

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, background: bg, overflow: "hidden" }}>
      {/* Grass-green radial gradient wash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.12) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Optional mood image as circular vignette */}
      {imageUrl && (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: imageOpacity * 0.22, pointerEvents: "none" }}>
          <div style={{ width: p ? 420 : 560, height: p ? 420 : 560, borderRadius: "50%", overflow: "hidden", position: "relative" }}>
            <Img
              src={imageUrl}
              style={(() => {
                // Match the adjust-modal preview (and the shared ZoomCropImg): anchor
                // the zoom at the chosen focus point, and fall back to contain+centre
                // when zoomed out (<1) so the framing the user sets is what renders.
                const pos = imageObjectPosition ?? "50% 50%";
                const z = imageZoom ?? 1;
                const out = z < 1;
                return {
                  width: "100%", height: "100%",
                  objectFit: out ? "contain" : "cover",
                  objectPosition: out ? "center" : pos,
                  transform: `scale(${z})`,
                  transformOrigin: out ? "center center" : pos,
                };
              })()}
            />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.85) 100%)" }} />
          </div>
        </AbsoluteFill>
      )}

      {/* World SVG: pitch lines, grass path, stickman, ball */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {/* Pitch markings (subtle) */}
          <g style={{ transform: `translateX(${pitchLeftX}px)`, opacity: pitchOpacity * 0.18 }}>
            <circle cx={cx} cy={impactY} r={p ? 90 : 120} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="12 6" />
          </g>
          <g style={{ transform: `translateX(${pitchRightX}px)`, opacity: pitchOpacity * 0.18 }}>
            <line x1={W * 0.05} y1={groundY} x2={W * 0.95} y2={groundY} stroke={accent} strokeWidth={2} strokeDasharray="12 6" />
          </g>

          {/* ── Grassy ground: the whole area below the ground line is green grass ── */}
          {/* Solid grass fill from the ground line to the bottom of the frame */}
          <rect x={0} y={groundY} width={W} height={H - groundY} fill={accent} />
          {/* Subtle darker band at the very bottom for depth */}
          <rect x={0} y={groundY} width={W} height={H - groundY} fill="url(#grassShade)" opacity={0.5} />
          <defs>
            <linearGradient id="grassShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity={0} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          {/* Crisp grass edge line */}
          <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="#1F5A23" strokeWidth={4} />
          {/* Dense row of lighter grass blades along the top edge for texture */}
          {Array.from({ length: Math.ceil(W / 26) }).map((_, i) => {
            const gx = i * 26 + ((i % 3) - 1) * 3;
            const h = 14 + (i % 4) * 5;
            const lean = ((i % 5) - 2) * 2;
            return (
              <path
                key={i}
                d={`M ${gx} ${groundY} q ${lean} ${-h * 0.6} ${lean * 1.4} ${-h}`}
                stroke="#3C9A42"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                opacity={0.85}
              />
            );
          })}

          {/* Impact flash */}
          {impactFlash > 0 && (
            <g opacity={impactFlash}>
              <circle cx={impactX} cy={impactY} r={interpolate(impactFlash, [0, 1], [60, 30])} fill="none" stroke={accent} strokeWidth={4} />
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <line key={i} x1={impactX + Math.cos(a) * 26} y1={impactY + Math.sin(a) * 26} x2={impactX + Math.cos(a) * 50} y2={impactY + Math.sin(a) * 50} stroke={accent} strokeWidth={3} strokeLinecap="round" />
                );
              })}
            </g>
          )}

          {/* ── Teammates: run in as the ball is kicked, then line up facing camera ── */}
          {teammates.map((tm, i) =>
            tm.visible ? (
              <TeammateStickman
                key={i}
                x={tm.x}
                groundY={groundY}
                run={tm.runBlend}
                gaitCycle={gaitCycle + tm.phase}
                tSec={tSec}
                thighLen={thighLen}
                shinLen={shinLen}
                torsoLen={torsoLen}
                headR={headR}
                headLen={headLen}
                stroke={text}
                sw={sw}
                variant={i}
                faceDir={tm.facingDir}
              />
            ) : null,
          )}

          {/* ── Stickman (articulated) ── */}
          <g stroke={text} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Head */}
            <circle cx={headX} cy={headY} r={headR} stroke={text} strokeWidth={sw} fill="none" />
            {/* Torso */}
            <line x1={shoulderX} y1={shoulderY} x2={manX} y2={hipY} />
            {/* Arms (shoulder → elbow → hand) */}
            <polyline points={`${shoulderX},${shoulderY} ${arms.left.elbowX},${arms.left.elbowY} ${arms.left.handX},${arms.left.handY}`} />
            <polyline points={`${shoulderX},${shoulderY} ${arms.right.elbowX},${arms.right.elbowY} ${arms.right.handX},${arms.right.handY}`} />
            {/* Legs (hip → knee → foot) */}
            <polyline points={`${manX},${hipY} ${legs.left.kneeX},${legs.left.kneeY} ${legs.left.footX},${legs.left.footY}`} />
            <polyline points={`${manX},${hipY} ${legs.right.kneeX},${legs.right.kneeY} ${legs.right.footX},${legs.right.footY}`} />
          </g>

          <StickFace cx={headX} cy={headY} headR={headR} stroke={text} sw={sw} variant={2} opacity={mainFaceOpacity} />

          {/* Kick effect — burst of speed lines at the boot on strike */}
          {kickEffect > 0 && (
            <g opacity={kickEffect}>
              {Array.from({ length: 7 }).map((_, i) => {
                const a = -Math.PI * 0.55 - (i / 6) * Math.PI * 0.35;
                const r1 = 14;
                const r2 = interpolate(kickEffect, [0, 1], [54, 30]);
                return (
                  <line
                    key={i}
                    x1={footBallX + Math.cos(a) * r1}
                    y1={footBallY + Math.sin(a) * r1}
                    x2={footBallX + Math.cos(a) * r2}
                    y2={footBallY + Math.sin(a) * r2}
                    stroke={accent}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                );
              })}
              <path d={`M ${footBallX - 26} ${groundY - 4} q 8 -10 18 -2`} stroke="#EAF6EA" strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <path d={`M ${footBallX - 38} ${groundY - 2} q 6 -8 14 -2`} stroke="#EAF6EA" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
            </g>
          )}

          {/* ── Ball: classic black-and-white pentagon football ── */}
          <g transform={`translate(${ballX} ${ballY}) rotate(${ballRot}) scale(${ballSqX} ${ballSqY})`}>
            {/* White sphere */}
            <circle cx={0} cy={0} r={ballR} fill="#FFFFFF" stroke="#111111" strokeWidth={3} />
            {/* Patches authored on an r=18 grid, scaled to the real radius */}
            <g transform={`scale(${ballR / 18})`}>
              {/* Central black pentagon */}
              <polygon points={pentagonPoints(0, 0, 6.5, -90)} fill="#111111" />
              {/* Partial black pentagons around the rim, linked by seams */}
              {[ -90, -18, 54, 126, 198 ].map((ang, i) => {
                const cxp = Math.cos((ang * Math.PI) / 180) * 12;
                const cyp = Math.sin((ang * Math.PI) / 180) * 12;
                return <polygon key={i} points={pentagonPoints(cxp, cyp, 4, ang + 90)} fill="#111111" />;
              })}
              {/* Seams from the central pentagon vertices outward */}
              {[ -90, -18, 54, 126, 198 ].map((ang, i) => {
                const vx = Math.cos((ang * Math.PI) / 180) * 6.5;
                const vy = Math.sin((ang * Math.PI) / 180) * 6.5;
                const ex = Math.cos((ang * Math.PI) / 180) * 17;
                const ey = Math.sin((ang * Math.PI) / 180) * 17;
                return <line key={`s${i}`} x1={vx} y1={vy} x2={ex} y2={ey} stroke="#111111" strokeWidth={1.2} />;
              })}
            </g>
          </g>

          {/* When held, link the right hand to the ball */}
          {ballHeld && (
            <>
              <line x1={arms.left.handX} y1={arms.left.handY} x2={ballX - ballR * 0.5} y2={ballY + ballR * 0.6} stroke={text} strokeWidth={sw} strokeLinecap="round" />
              <line x1={arms.right.handX} y1={arms.right.handY} x2={ballX} y2={ballY + ballR} stroke={text} strokeWidth={sw} strokeLinecap="round" />
            </>
          )}

          {/* "Lets Play!" — small, directly above the held ball (off to the right,
              clear of the face) */}
          {letsPlayOpacity > 0 && (
            <g opacity={letsPlayOpacity} transform={`translate(${ballX + 56}, ${ballY - ballR - 34 - letsPlayRise})`}>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontFamily={font}
                fontSize={p ? 32 : 28}
                fontWeight={700}
                fill={accent}
                style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}
              >
                Lets Play!
              </text>
            </g>
          )}
        </svg>
      </AbsoluteFill>

      {/* Text content — bottom-anchored so longer copy grows upward */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: textBlockBottom,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: subline && narration ? 16 : subline || narration ? 20 : 0,
            transform: `translateY(${titleY}px)`,
            transformOrigin: "50% 100%",
          }}
        >
          <div style={{ opacity: titleOpacity, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div
              style={{
                fontFamily: font,
                fontSize: titlePx,
                fontWeight: 700,
                color: text,
                textAlign: "center",
                letterSpacing: "0.02em",
                lineHeight: 1.1,
                textTransform: "uppercase",
                maxWidth: textMaxW,
                padding: "0 24px",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 10,
                height: 4,
                width: p ? W * 0.6 : W * 0.4,
                background: accent,
                transformOrigin: "left center",
                transform: `scaleX(${underlineScale})`,
                borderRadius: 2,
              }}
            />
          </div>

          {subline && (
            <div
              style={{
                opacity: textBlockOpacity * 0.7,
                fontFamily: font,
                fontSize: Math.max(12, descPx - 6),
                fontWeight: 400,
                color: text,
                textAlign: "center",
                letterSpacing: "0.04em",
                maxWidth: textMaxW,
                padding: "0 24px",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                lineHeight: 1.35,
              }}
            >
              {subline}
            </div>
          )}

          {narration && (
            <div
              style={{
                opacity: textBlockOpacity * 0.7,
                fontFamily: font,
                fontSize: descPx,
                fontWeight: 400,
                color: text,
                textAlign: "center",
                letterSpacing: "0.03em",
                maxWidth: textMaxW,
                padding: "0 24px",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                lineHeight: 1.35,
              }}
            >
              {narration}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Build the SVG points string for a regular pentagon centred at (cx,cy) with the
// given circumradius r, rotated so the first vertex sits at `startDeg`.
function pentagonPoints(cx: number, cy: number, r: number, startDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((startDeg + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

// A teammate stickman: runs in (articulated gait, ground-anchored hip so a foot is
// always planted) and then stands facing the camera in a player's pose — hands on
// the waist (akimbo) and legs planted wide — with a simple face (hair, eyes, nose,
// and per-variant mustache/beard). `run` 1 = running, 0 = standing.
const TeammateStickman: React.FC<{
  x: number;
  groundY: number;
  run: number;          // 1 = running, 0 = standing still (faces camera)
  gaitCycle: number;
  tSec: number;
  thighLen: number;
  shinLen: number;
  torsoLen: number;
  headR: number;
  headLen: number;
  stroke: string;
  sw: number;
  variant: number;      // 0..2 → different hair / facial-hair styles
  faceDir: number;      // +1 = running rightward, −1 = running leftward (mirror gait)
}> = ({ x, groundY, run, gaitCycle, tSec, thighLen, shinLen, torsoLen, headR, headLen, stroke, sw, variant, faceDir }) => {
  const D = Math.PI / 180;
  const stand = 1 - run; // 0 while running, 1 while standing

  // ── Legs: blend between the running gait and a planted WIDE stance ──
  // Gait matches the whiteboard DrawnTitle figure (90°-lagged backward knee bend).
  const gait = (off: number) => {
    const ph = gaitCycle + off;
    return { thigh: Math.sin(ph) * 32, knee: Math.max(0, Math.sin(ph - Math.PI / 2)) * 52 + 8 };
  };
  const localLeg = (g: { thigh: number; knee: number }, wideSign: number) => {
    // running contribution
    const tr = (g.thigh * run) * D;
    // Mirror the horizontal swing by faceDir so right-side runners stride leftward.
    const kneeXr = Math.sin(tr) * thighLen * faceDir;
    const kneeYr = Math.cos(tr) * thighLen;
    const sr = tr - (g.knee * run) * D;
    const footXr = kneeXr + Math.sin(sr) * shinLen * faceDir;
    const footYr = kneeYr + Math.cos(sr) * shinLen;
    // wide standing contribution: legs angled outward, straight, feet apart
    const wideAng = wideSign * 22 * D;
    const kneeXs = Math.sin(wideAng) * thighLen;
    const kneeYs = Math.cos(wideAng) * thighLen;
    const footXs = kneeXs + Math.sin(wideAng) * shinLen;
    const footYs = kneeYs + Math.cos(wideAng) * shinLen;
    return {
      kneeX: kneeXr * run + kneeXs * stand,
      kneeY: kneeYr * run + kneeYs * stand,
      footX: footXr * run + footXs * stand,
      footY: footYr * run + footYs * stand,
    };
  };
  const A = localLeg(gait(0), -1);          // left leg (wide left when standing)
  const B = localLeg(gait(Math.PI), 1);     // right leg (wide right when standing)
  const hipY = groundY - Math.max(A.footY, B.footY); // plant the lower foot
  const breath = Math.sin(tSec * 1.3) * 1.2;
  const shoulderY = hipY - torsoLen + breath;
  const headY = shoulderY - headLen;
  const armSwing = Math.sin(gaitCycle) * 24 * run;

  // ── Arms: blend run-swing → hands on the waist (akimbo) ──
  // Waist (hip) point is at (x, hipY). Akimbo: elbow juts OUT, hand rests on the hip.
  const runHand = (sign: number) => ({ ex: x + sign * 14, ey: shoulderY + 14, hx: x + sign * 18 + armSwing * 0.3 * faceDir, hy: shoulderY + 30 });
  const akimbo = (sign: number) => ({ ex: x + sign * 34, ey: shoulderY + 20, hx: x + sign * 14, hy: hipY - 2 });
  const blendArm = (sign: number) => {
    const r = runHand(sign), s = akimbo(sign);
    return {
      ex: r.ex * run + s.ex * stand,
      ey: r.ey * run + s.ey * stand,
      hx: r.hx * run + s.hx * stand,
      hy: r.hy * run + s.hy * stand,
    };
  };
  const lArm = blendArm(-1);
  const rArm = blendArm(1);

  const faceOpacity = 1;

  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke={stroke} strokeWidth={sw}>
        {/* Head */}
        <circle cx={x} cy={headY} r={headR} fill="none" />
        {/* Torso */}
        <line x1={x} y1={shoulderY} x2={x} y2={hipY} />
        {/* Arms (shoulder → elbow → hand) */}
        <polyline points={`${x},${shoulderY} ${lArm.ex},${lArm.ey} ${lArm.hx},${lArm.hy}`} />
        <polyline points={`${x},${shoulderY} ${rArm.ex},${rArm.ey} ${rArm.hx},${rArm.hy}`} />
        {/* Legs (hip → knee → foot) */}
        <polyline points={`${x},${hipY} ${x + A.kneeX},${hipY + A.kneeY} ${x + A.footX},${hipY + A.footY}`} />
        <polyline points={`${x},${hipY} ${x + B.kneeX},${hipY + B.kneeY} ${x + B.footX},${hipY + B.footY}`} />
      </g>

      <StickFace cx={x} cy={headY} headR={headR} stroke={stroke} sw={sw} variant={variant} opacity={faceOpacity} />
    </g>
  );
};

// A simple face drawn inside a head circle: hair, eyes, nose, mouth, and per-variant
// mustache/beard. `variant` 0..2 selects the hair + facial-hair style.
const StickFace: React.FC<{
  cx: number;
  cy: number;        // head centre Y
  headR: number;
  stroke: string;
  sw: number;
  variant: number;
  opacity: number;
}> = ({ cx, cy, headR, stroke, sw, variant, opacity }) => {
  if (opacity <= 0.02) return null;
  // Hair/cap colour per variant — dark brown & black (never the accent colour).
  const hairColor = variant === 0 ? "#3B2412" : variant === 1 ? "#111111" : "#5A3A1E";
  return (
    <g opacity={opacity}>
      {/* Hair on top of the head */}
      {variant === 0 ? (
        <g stroke={hairColor} strokeWidth={sw * 0.8}>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((o, i) => (
            <line key={i} x1={cx + o * headR} y1={cy - headR * 0.78} x2={cx + o * headR * 1.1} y2={cy - headR * 1.25} />
          ))}
        </g>
      ) : variant === 1 ? (
        <path d={`M ${cx - headR} ${cy - headR * 0.2} A ${headR} ${headR} 0 0 1 ${cx + headR} ${cy - headR * 0.2} Z`} fill={hairColor} stroke="none" />
      ) : (
        <path d={`M ${cx - headR} ${cy - headR * 0.1} Q ${cx - headR * 0.2} ${cy - headR * 1.3} ${cx + headR} ${cy - headR * 0.3}`} fill="none" stroke={hairColor} strokeWidth={sw} />
      )}

      {/* Eyes */}
      <circle cx={cx - headR * 0.38} cy={cy - headR * 0.1} r={Math.max(1.6, headR * 0.09)} fill={stroke} stroke="none" />
      <circle cx={cx + headR * 0.38} cy={cy - headR * 0.1} r={Math.max(1.6, headR * 0.09)} fill={stroke} stroke="none" />

      {/* Nose */}
      <line x1={cx} y1={cy} x2={cx - headR * 0.12} y2={cy + headR * 0.28} stroke={stroke} strokeWidth={sw * 0.7} strokeLinecap="round" />

      {/* Mustache + beard, per variant */}
      {variant === 0 && (
        <path d={`M ${cx - headR * 0.4} ${cy + headR * 0.42} Q ${cx} ${cy + headR * 0.6} ${cx + headR * 0.4} ${cy + headR * 0.42}`} stroke={stroke} strokeWidth={sw * 0.9} fill="none" strokeLinecap="round" />
      )}
      {variant === 1 && (
        <path d={`M ${cx - headR * 0.7} ${cy + headR * 0.2} Q ${cx} ${cy + headR * 1.5} ${cx + headR * 0.7} ${cy + headR * 0.2}`} fill={stroke} stroke="none" opacity={0.9} />
      )}
      {variant === 2 && (
        <>
          <path d={`M ${cx - headR * 0.38} ${cy + headR * 0.4} Q ${cx} ${cy + headR * 0.56} ${cx + headR * 0.38} ${cy + headR * 0.4}`} stroke={stroke} strokeWidth={sw * 0.9} fill="none" strokeLinecap="round" />
          <path d={`M ${cx - headR * 0.28} ${cy + headR * 0.62} Q ${cx} ${cy + headR * 1.0} ${cx + headR * 0.28} ${cy + headR * 0.62}`} fill={stroke} stroke="none" opacity={0.9} />
        </>
      )}

      {/* Mouth (small) */}
      {variant !== 1 && (
        <path d={`M ${cx - headR * 0.22} ${cy + headR * 0.34} Q ${cx} ${cy + headR * 0.42} ${cx + headR * 0.22} ${cy + headR * 0.34}`} stroke={stroke} strokeWidth={sw * 0.6} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};
