import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Football, GrassGround, PlayerStickman } from "../shared";

export const PassingPlay: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    stats,
  } = props;

  const p = aspectRatio === "portrait";
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const cx = W / 2;

  const statItems = (Array.isArray(stats) ? stats : []).filter((s) => s && (s.label || s.value)).slice(0, 4);

  // Scene-level enter/exit
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

  // ── Sizing (match KickoffTitle: bigger in portrait) ──
  const ballR = 30;
  const FIG = p ? 2.2 : 1.5;
  const torsoLen = 52 * FIG;
  const headR = 20 * FIG;
  const headLen = 20 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;
  const sw = 5.5;

  // ── Ground + player positions ──
  const groundY = H * 0.84;
  const leftX = W * 0.24;
  const rightX = W * 0.76;
  const footBallY = groundY - ballR;
  const chestY = groundY - (thighLen + shinLen) - torsoLen * 0.4; // ~chest height
  // Head height (centre of the head) — used to land a flicked-up ball for a header.
  const headY = groundY - (thighLen + shinLen) - torsoLen - headLen - headR * 0.45;

  // Both players WALK in from off-screen to their corner, then stand and pass.
  // The gait (thigh swing + backward knee bend) is driven inside PlayerStickman via
  // the `walk` prop, matched to the whiteboard DrawnTitle figure.
  const walkFrames = Math.round(fps * 1.4);
  const runEnd = walkFrames;
  const leftStartX = -90;
  const rightStartX = W + 90;
  const leftWalkT = interpolate(frame, [0, runEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightWalkT = interpolate(frame, [4, runEnd + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leftDrawX = interpolate(easeOut(leftWalkT), [0, 1], [leftStartX, leftX]);
  const rightDrawX = interpolate(easeOut(rightWalkT), [0, 1], [rightStartX, rightX]);
  const leftRunning = frame < runEnd;
  const rightRunning = frame < runEnd + 4;

  // Stride phase for the walk (slows to a stop as each player settles at the corner).
  const gaitCycle = frame * 0.42;
  // Blend the walk gait out over the last stretch so they plant cleanly before passing.
  const leftWalkAmt = 1 - interpolate(leftWalkT, [0.82, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightWalkAmt = 1 - interpolate(rightWalkT, [0.82, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leftWalk = { amt: leftRunning ? leftWalkAmt : 0, cycle: gaitCycle, moveDir: 1 };
  const rightWalk = { amt: rightRunning ? rightWalkAmt : 0, cycle: gaitCycle + Math.PI, moveDir: -1 };

  // ── Opening: ball kicked in from off-screen right while players run on ───────
  // Parabolic pass → left player chest trap → foot control → then pass cycles.
  const INCOMING = Math.round(fps * 1.35);
  const INCOMING_CHEST = Math.round(fps * 0.45);
  const INCOMING_FOOT = Math.round(fps * 0.5);
  const playStart = INCOMING + INCOMING_CHEST + INCOMING_FOOT;

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ── Dribble model ────────────────────────────────────────────────────────────
  // A dribble is the player TRAVELLING with the ball: on each touch the foot pokes the
  // ball a short distance ahead, then the player runs up to it and pokes again. Over
  // the whole dribble both the player and the ball advance `travelPx` together — the
  // ball only ever sits a small `leadPx` ahead of the player (never runs off into the
  // distance). `localT` 0→1 spans the whole dribble of `taps` touches.
  //
  // Returns the player's travel (advance) and the ball's position relative to the
  // dribble's starting anchor, plus the leg pose for the poking foot.
  const dribble = (
    localT: number,
    faceDir: number,
    taps: number,
    travelPx: number,
    leadPx: number
  ) => {
    const clamped = Math.max(0, Math.min(1, localT));
    const seg = 1 / taps;
    const idx = Math.min(taps - 1, Math.floor(clamped / seg));
    const segT = (clamped - idx * seg) / seg; // 0..1 within the current touch
    const stepLen = travelPx / taps;          // ground covered per touch

    // The player advances one step per touch, smoothly (run-up between pokes).
    const advance = stepLen * (idx + easeInOut(segT));

    // The ball sits ahead of the player by `leadPx`, but JUMPS forward on each poke:
    // at the start of a touch the foot meets the ball (lead small), then the poke
    // shoots it back out to the full lead as the player chases.
    const poke = Math.sin(Math.min(1, segT / 0.32) * Math.PI); // sharp jab early in the touch
    const lead = leadPx * (0.35 + 0.65 * easeOut(Math.min(1, segT / 0.45)));
    const ballAdvance = advance + lead;

    return {
      advance: faceDir * advance,                    // how far the player has travelled
      ballDx: faceDir * ballAdvance,                 // ball position from the anchor
      ballDy: -Math.sin(Math.min(1, segT / 0.26) * Math.PI) * (H * 0.012), // tiny hop on contact
      kickLeg: poke * 0.55,                          // foot reaches out to poke the ball
      plantBend: 0.08 + poke * 0.16,
      lead: faceDir * lead,                          // current ball lead over the player
      touch: poke,
    };
  };

  // ── Pass cycle state machine (after the opening sequence) ────────────────────
  // CONTROL is now a detailed dribble routine made of sub-phases:
  //   DRIBBLE  – push the ball ahead with a few touches (ball travels, foot chases)
  //   STEPOVER – feet shuffle around the (briefly still) ball, no contact
  //   FLICK    – scoop the ball up off the toes into the air
  //   HEADER   – nod the rising ball forward, sending it toward the receiver
  const sinceStart = Math.max(0, frame - playStart);
  const DRIBBLE = fps * 0.95;   // ~3 pushing touches, ball runs ahead each time
  const STEPOVER = fps * 0.6;   // feet dance around the ball
  const FLICK = fps * 0.4;      // toe-scoop lifts the ball up
  const HEADER = fps * 0.55;    // ball arcs to the receiver off the head
  const CONTROL = DRIBBLE + STEPOVER + FLICK;
  const PASS = HEADER;          // the "pass" is now a header
  const CHEST = fps * 0.45;
  const FOOTCTL = fps * 0.5;    // settle at foot, one dribble, hold
  const CYCLE = CONTROL + PASS + CHEST + FOOTCTL;

  // Dribble: number of touches, total ground the player+ball cover together, and how
  // far ahead of the player's foot the ball is allowed to sit (the lead).
  const DRIBBLE_TAPS = 3;
  const DRIBBLE_TRAVEL = p ? 130 : 170; // player advances this far while dribbling
  const DRIBBLE_LEAD = p ? 30 : 38;     // ball never further than this ahead of the foot

  const cycleIdx = Math.floor(sinceStart / CYCLE);
  const inCycle = sinceStart - cycleIdx * CYCLE;
  const senderIsLeft = cycleIdx % 2 === 0;

  const senderX = senderIsLeft ? leftDrawX : rightDrawX;
  const receiverX = senderIsLeft ? rightDrawX : leftDrawX;
  const senderDir = senderIsLeft ? 1 : -1;
  const receiverDir = senderIsLeft ? -1 : 1;

  const pControlEnd = CONTROL;
  const pPassEnd = CONTROL + PASS;
  const pChestEnd = CONTROL + PASS + CHEST;

  const incomingFromX = W + 150;
  const incomingFromY = H * (p ? 0.14 : 0.12); // high long ball — kicked in from far right

  let ballX = leftDrawX + 22;
  let ballY = chestY;
  let senderKick = { kickLeg: 0, plantBend: 0, torsoBias: 0 };
  let receiverKick = { kickLeg: 0, plantBend: 0, torsoBias: 0 };
  // During toe-tap dribbles, the active player should also shuffle with the ball.
  let dribbleBodyLeftX = 0;
  let dribbleBodyRightX = 0;
  let senderSwayX = 0;        // side-to-side feint during the stepover
  let senderArmSwing = 0;     // signed fore/aft arm pump for the active player
  let receiverArmSwing = 0;   // arm pump for the receiver while it controls the ball
  let senderHeadTilt = 0;     // head nod (deg): − winds the head back, + snaps it forward
  let receiverHeadTilt = 0;

  // Sender's forward TRAVEL with the ball — one source of truth so the player and the
  // ball advance together and the body never snaps back between the dribble, the
  // stepover, the flick-up and the header.
  let senderForwardMag = 0; // how far (px, unsigned) the sender has advanced from senderX
  if (frame >= playStart) {
    if (inCycle < DRIBBLE) {
      // Player runs forward step-by-step with the ball across the whole dribble.
      const d = dribble(inCycle / DRIBBLE, 1, DRIBBLE_TAPS, DRIBBLE_TRAVEL, DRIBBLE_LEAD);
      senderForwardMag = Math.abs(d.advance);
    } else if (inCycle < pPassEnd) {
      senderForwardMag = DRIBBLE_TRAVEL; // hold the advanced spot through flick + header
    } else if (inCycle < pChestEnd) {
      // After heading the ball away, drift back toward the resting spot.
      const t = (inCycle - pPassEnd) / CHEST;
      senderForwardMag = DRIBBLE_TRAVEL * (1 - easeOut(t));
    }
  }
  // The dribble routine's spatial anchor: the sender's current advanced foot position.
  const dribbleFootX = senderX + senderDir * (30 + senderForwardMag);

  if (frame < INCOMING) {
    const t = easeOut(frame / INCOMING);
    const trapX = leftDrawX + 22;
    ballX = interpolate(t, [0, 1], [incomingFromX, trapX]);
    // Long-ball descent: stays high off the right, drops into the chest trap.
    const dropT = t * t;
    const float = Math.sin(t * Math.PI) * (H * 0.025);
    ballY = incomingFromY + (chestY - incomingFromY) * dropT + float;
    if (t > 0.82) {
      const brace = (t - 0.82) / 0.18;
      receiverKick = { kickLeg: 0, plantBend: 0.22 * brace, torsoBias: -5 * brace };
    }
  } else if (frame < INCOMING + INCOMING_CHEST) {
    const t = (frame - INCOMING) / INCOMING_CHEST;
    const reboundUp = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * (H * 0.05) : 0;
    const reboundOut = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 22 : 0;
    const drop = t < 0.4 ? 0 : interpolate((t - 0.4) / 0.6, [0, 1], [0, footBallY - chestY]);
    ballX = leftDrawX + 16 + reboundOut;
    ballY = chestY - reboundUp + drop;
    receiverKick = { kickLeg: 0, plantBend: 0.2 * Math.sin(Math.min(1, t / 0.4) * Math.PI), torsoBias: -4 };
  } else if (frame < playStart) {
    // Opening foot-control: drop the trapped ball from chest to foot, one settling tap.
    const t = (frame - INCOMING - INCOMING_CHEST) / INCOMING_FOOT;
    const baseX = leftDrawX + 36;
    if (t < 0.38) {
      ballX = baseX;
      ballY = interpolate(easeOut(t / 0.38), [0, 1], [chestY, footBallY]);
    } else if (t < 0.72) {
      const k = (t - 0.38) / 0.34;
      const touch = Math.sin(k * Math.PI);
      ballX = baseX + touch * (DRIBBLE_LEAD * 0.5); // light tap out & back (faces right)
      ballY = footBallY - touch * (H * 0.01);
      receiverKick = { kickLeg: touch * 0.4, plantBend: 0.08 + touch * 0.16, torsoBias: 0 };
    } else {
      ballX = baseX;
      ballY = footBallY;
    }
  } else if (inCycle < pControlEnd) {
    // ── CONTROL: travel-dribble → stepover → flick-up ────────────────────────────
    // `dribbleFootX` already tracks the sender's advancing foot, so the ball stays
    // just ahead of the foot the whole way — the player travels WITH the ball.
    if (inCycle < DRIBBLE) {
      // (1) DRIBBLE — player runs forward poking the ball a short lead ahead each touch.
      const t = inCycle / DRIBBLE;
      const d = dribble(t, senderDir, DRIBBLE_TAPS, DRIBBLE_TRAVEL, DRIBBLE_LEAD);
      // Ball = anchor + total ball advance; foot anchor = senderX+30 (dribbleFootX uses
      // senderForwardMag = advance, so ball is exactly `lead` ahead of the foot).
      ballX = senderX + senderDir * 30 + d.ballDx;
      ballY = footBallY + d.ballDy;
      senderKick = { kickLeg: d.kickLeg, plantBend: d.plantBend, torsoBias: senderDir * 4 };
      // Arms pump as it runs with the ball — a steady stride swing plus a small extra
      // drive on each poke for balance.
      const stride = Math.sin((inCycle / DRIBBLE) * DRIBBLE_TAPS * 2 * Math.PI);
      senderArmSwing = stride * (p ? 18 : 22) + d.touch * (p ? 6 : 8);
    } else if (inCycle < DRIBBLE + STEPOVER) {
      // (2) STEPOVER — player has caught the ball; it sits at the foot while the feet
      // dance AROUND it (no contact) and the body feints side to side.
      const t = (inCycle - DRIBBLE) / STEPOVER;
      // Ball settles in from the dribble lead to close under the feet, then holds.
      const settle = interpolate(t, [0, 0.25], [DRIBBLE_LEAD, DRIBBLE_LEAD * 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      ballX = dribbleFootX + senderDir * settle;
      ballY = footBallY;
      const sweeps = 2;
      const sLocal = (t * sweeps) % 1;
      const arc = Math.sin(sLocal * Math.PI);                 // foot lifts & circles
      const around = Math.sin(sLocal * Math.PI * 2) * 0.35;   // out then back across the ball
      senderKick = {
        kickLeg: arc * 0.6 + around,        // foot rolls around the ball, no real kick
        plantBend: 0.14 + arc * 0.16,
        torsoBias: -senderDir * (4 + arc * 5),
      };
      // Body weaves side-to-side over the ball (feint) without leaving it.
      senderSwayX = Math.sin(t * Math.PI * sweeps * 2) * (p ? 16 : 20);
      // Arms counter-balance the feint (swing opposite to the body weave).
      senderArmSwing = -Math.sin(t * Math.PI * sweeps * 2) * (p ? 14 : 18);
    } else {
      // (3) FLICK — toe-scoop: the foot rolls under the ball and pops it UP off the toes,
      // straight up to head height so the player can head it from where it stands.
      const t = (inCycle - DRIBBLE - STEPOVER) / FLICK;
      const scoop = Math.sin(Math.min(1, t / 0.5) * Math.PI); // foot rolls under, then down
      const lift = easeOut(Math.min(1, t / 0.85));            // ball rises off the toes
      const flickTopY = headY - headR * 0.6;
      const ballGroundX = dribbleFootX + senderDir * (DRIBBLE_LEAD * 0.5);
      // Ball rises and drifts back slightly toward the forehead as it climbs.
      ballX = interpolate(lift, [0, 1], [ballGroundX, dribbleFootX + senderDir * (headR * 0.4)]);
      ballY = footBallY + (flickTopY - footBallY) * lift;     // rises to head height
      senderKick = {
        kickLeg: 0.18 + scoop * 0.7,        // toe slides under & lifts
        plantBend: 0.12 + scoop * 0.22,
        torsoBias: -senderDir * 6,          // lean back slightly to scoop it up
      };
      // Arms spread out for balance as the ball lifts; head begins to wind back.
      senderArmSwing = -lift * (p ? 10 : 12);
      senderHeadTilt = -lift * 14;          // start pulling the head back
    }
  } else if (inCycle < pPassEnd) {
    // ── HEADER PASS: the flicked-up ball is nodded forward to the receiver ────────
    const t = (inCycle - pControlEnd) / PASS;
    // The player is held at its advanced spot (senderForwardMag = DRIBBLE_TRAVEL), so
    // the header is struck right above where it just flicked the ball up.
    const headStartX = dribbleFootX + senderDir * (headR * 0.4);
    const headContactX = dribbleFootX + senderDir * (headR * 0.55);
    const toX = receiverX + receiverDir * 24;
    // WIND-BACK then STRIKE: the head pulls back (negative tilt) while the ball drops
    // onto the forehead, then snaps forward hard at contact to head the ball away.
    const HEAD_BACK = -22;   // deg the head is cocked back at full wind-up
    const HEAD_FWD = 30;     // deg the head snaps forward through contact
    const contact = 0.4;     // fraction of the header phase spent winding up before contact
    if (t < contact) {
      // Wind-up: ball settles toward the forehead; head cocks all the way back.
      const k = t / contact;
      ballX = interpolate(k, [0, 1], [headStartX, headContactX]);
      ballY = interpolate(k, [0, 1], [headY - headR * 0.6, headY - headR * 0.35]);
      senderHeadTilt = interpolate(easeOut(k), [0, 1], [-14, HEAD_BACK]); // continue from flick
      senderKick = { kickLeg: -0.12, plantBend: 0.14 + 0.06 * k, torsoBias: senderDir * -8 * k };
    } else {
      // Strike + follow-through: head whips forward, the ball flies to the receiver.
      const k = (t - contact) / (1 - contact);
      ballX = interpolate(easeOut(k), [0, 1], [headContactX, toX]);
      const arc = Math.sin(k * Math.PI) * (H * 0.1);
      ballY = interpolate(k, [0, 1], [headY - headR * 0.35, chestY]) - arc;
      // Snap from cocked-back to forward fast (first ~25%), then ease the head back to rest.
      const snap = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
      senderHeadTilt = interpolate(snap, [0, 1], [HEAD_BACK, HEAD_FWD]);
      // Torso drives forward with the nod, then recovers.
      const drive = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
      senderKick = { kickLeg: 0, plantBend: 0.12 * (1 - k), torsoBias: senderDir * (10 * drive) };
      // Arms throw forward with the header for momentum.
      senderArmSwing = drive * (p ? 14 : 18);
    }
  } else if (inCycle < pChestEnd) {
    // CHEST: ball hits the chest and REBOUNDS slightly (does not stick), then begins
    // to fall toward the foot.
    const t = (inCycle - pPassEnd) / CHEST;
    // rebound: a quick small bounce out/up off the chest in the first ~40%, then drop
    const reboundUp = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * (H * 0.05) : 0;
    const reboundOut = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 24 : 0;
    const drop = t < 0.4 ? 0 : interpolate((t - 0.4) / 0.6, [0, 1], [0, footBallY - chestY]);
    ballX = receiverX + receiverDir * (16 + reboundOut);
    ballY = chestY - reboundUp + drop;
    // receiver braces (slight knee bend, lean into the ball) on the chest contact
    receiverKick = { kickLeg: 0, plantBend: 0.2 * Math.sin(Math.min(1, t / 0.4) * Math.PI), torsoBias: receiverDir * -4 };
    // Arms come up/out to balance as the chest cushions the ball.
    receiverArmSwing = -Math.sin(Math.min(1, t / 0.4) * Math.PI) * (p ? 12 : 14);
  } else {
    // FOOTCTL — the receiver has the ball at its foot; one small in-place settling
    // touch (a light tap that rocks the ball out and back), then it holds, ready to
    // become the next cycle's dribbler.
    const t = (inCycle - pChestEnd) / FOOTCTL;
    const baseX = receiverX + receiverDir * 36;
    ballY = footBallY;
    if (t < 0.32) {
      ballX = baseX;
    } else if (t < 0.68) {
      const k = (t - 0.32) / 0.36;
      const touch = Math.sin(k * Math.PI);
      ballX = baseX + receiverDir * touch * (DRIBBLE_LEAD * 0.45); // rock out & back
      ballY = footBallY - touch * (H * 0.01);
      receiverKick = { kickLeg: touch * 0.4, plantBend: 0.08 + touch * 0.16, torsoBias: 0 };
      receiverArmSwing = touch * (p ? 8 : 10);
    } else {
      ballX = baseX;
    }
  }

  // Apply the sender's forward shuffle + stepover feint to the correct player.
  if (frame >= playStart) {
    const senderBody = senderDir * senderForwardMag + senderSwayX;
    if (senderIsLeft) dribbleBodyLeftX += senderBody;
    else dribbleBodyRightX += senderBody;
  }

  // Map sender/receiver kick onto left/right players.
  const inOpening = frame < playStart;
  const leftKick = inOpening ? receiverKick : (senderIsLeft ? senderKick : receiverKick);
  const rightKick = inOpening ? { kickLeg: 0, plantBend: 0, torsoBias: 0 } : (senderIsLeft ? receiverKick : senderKick);
  // Map arm-swing + head-tilt the same way (left is the receiver during the opening).
  const leftArmSwing = inOpening ? receiverArmSwing : (senderIsLeft ? senderArmSwing : receiverArmSwing);
  const rightArmSwing = inOpening ? 0 : (senderIsLeft ? receiverArmSwing : senderArmSwing);
  const leftHeadTilt = inOpening ? receiverHeadTilt : (senderIsLeft ? senderHeadTilt : receiverHeadTilt);
  const rightHeadTilt = inOpening ? 0 : (senderIsLeft ? receiverHeadTilt : senderHeadTilt);

  // ── Warm-up shuffle: slow footballer-style back-forth steps ──
  const warmPeriod = Math.round(fps * 4.2);
  const warmPhaseAt = (offset: number) => ((frame + offset) % warmPeriod) / warmPeriod;
  const stepEase = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const calcWarmUp = (phase: number, faceDir: number) => {
    const STEPS = 2;
    const stepSpan = 9;
    const endHold = 0.2;
    const goingFwd = phase < 0.5;
    const halfT = (phase % 0.5) * 2;
    const activeEnd = 1 - endHold;
    const marchT = halfT >= activeEnd ? 1 : halfT / activeEnd;
    const stepF = marchT * STEPS;
    const stepI = Math.min(STEPS - 1, Math.floor(stepF));
    const stepLocal = stepF - stepI;
    const transfer = stepEase(stepLocal);
    const marchDir = goingFwd ? 1 : -1;
    const swayX = faceDir * marchDir * (stepI * stepSpan + transfer * stepSpan);
    const lift = Math.sin(stepLocal * Math.PI);
    const settle = Math.max(0, 1 - stepLocal * 2.2);
    const kickLeg = goingFwd ? lift * 0.24 : -lift * 0.17;
    const plantBend = 0.1 + lift * 0.32 + settle * 0.07;
    const torsoLean = -faceDir * marchDir * (lift * 2.4 + transfer * 0.45);
    return { swayX, kickLeg, plantBend, torsoLean };
  };
  const leftWarm = calcWarmUp(warmPhaseAt(0), 1);
  const rightWarm = calcWarmUp(warmPhaseAt(warmPeriod * 0.5), -1);
  const warmBlend = (kick: { kickLeg: number; plantBend: number }) =>
    Math.max(0, 1 - Math.abs(kick.kickLeg) * 1.35 - kick.plantBend * 0.55);
  const leftWarmBlend = leftRunning ? 0 : warmBlend(leftKick);
  const rightWarmBlend = rightRunning ? 0 : warmBlend(rightKick);
  // While walking, the legs are owned by the `walk` gait, so the kick params stay
  // neutral; a small forward torso lean sells the forward motion.
  const leftIncoming = frame < playStart;
  const leftPose = {
    x: leftDrawX + (leftRunning ? 0 : leftWarm.swayX * leftWarmBlend) + (leftRunning ? 0 : dribbleBodyLeftX),
    groundY,
    kickLeg: leftRunning && !leftIncoming ? 0 : leftKick.kickLeg + leftWarm.kickLeg * leftWarmBlend,
    plantBend: leftRunning && !leftIncoming ? 0 : leftKick.plantBend + leftWarm.plantBend * leftWarmBlend,
    torsoBias: leftRunning
      ? (leftIncoming ? leftKick.torsoBias : 6 * leftWalk.amt)
      : leftKick.torsoBias + leftWarm.torsoLean * leftWarmBlend,
    armSwing: leftRunning ? 0 : leftArmSwing,
    headTilt: leftRunning ? 0 : leftHeadTilt,
  };
  const rightPose = {
    x: rightDrawX + (rightRunning ? 0 : rightWarm.swayX * rightWarmBlend) + (rightRunning ? 0 : dribbleBodyRightX),
    groundY,
    kickLeg: rightRunning ? 0 : rightKick.kickLeg + rightWarm.kickLeg * rightWarmBlend,
    plantBend: rightRunning ? 0 : rightKick.plantBend + rightWarm.plantBend * rightWarmBlend,
    torsoBias: rightRunning ? 6 * rightWalk.amt : rightKick.torsoBias + rightWarm.torsoLean * rightWarmBlend,
    armSwing: rightRunning ? 0 : rightArmSwing,
    headTilt: rightRunning ? 0 : rightHeadTilt,
  };

  // ── Subtle, physical ball motion (no constant wheel-spin) ──
  // 1) Spin: only WHILE the ball is in flight, and just ~3/4 of a turn over the whole
  //    pass (in the kick direction), so it tumbles a little rather than spinning fast.
  let ballRot = 0;
  let ballSqX = 1;
  let ballSqY = 1;
  if (frame < INCOMING) {
    const t = frame / INCOMING;
    ballRot = -easeOut(t) * 280;
  } else if (frame < INCOMING + INCOMING_CHEST) {
    const t = (frame - INCOMING) / INCOMING_CHEST;
    const press = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0;
    ballSqX = 1 + 0.22 * press;
    ballSqY = 1 - 0.24 * press;
  } else if (frame < playStart) {
    const t = (frame - INCOMING - INCOMING_CHEST) / INCOMING_FOOT;
    if (t > 0.38 && t < 0.72) {
      const touch = Math.sin(((t - 0.38) / 0.34) * Math.PI);
      ballSqX = 1 + 0.14 * touch;
      ballSqY = 1 - 0.16 * touch;
    }
  } else if (inCycle >= pControlEnd && inCycle < pPassEnd) {
    // HEADER flight: the ball tumbles forward after the nod (only once it's headed at the
    // 0.4 contact point, matching the wind-back/strike split above).
    const t = (inCycle - pControlEnd) / PASS;
    if (t >= 0.4) {
      const k = (t - 0.4) / 0.6;
      ballRot = senderDir * k * 220;
      // squash on the forehead contact, just as it's nodded away
      const press = k < 0.14 ? Math.sin((k / 0.14) * Math.PI) : 0;
      ballSqX = 1 - 0.2 * press;
      ballSqY = 1 + 0.22 * press;
    }
  } else if (inCycle < pControlEnd) {
    if (inCycle < DRIBBLE) {
      // Ball ROLLS along the ground as it travels (rotation ∝ distance covered).
      const t = inCycle / DRIBBLE;
      const d = dribble(t, senderDir, DRIBBLE_TAPS, DRIBBLE_TRAVEL, DRIBBLE_LEAD);
      const dist = Math.abs(d.ballDx);
      ballRot = senderDir * (dist / (2 * Math.PI * ballR)) * 360;
      // squash pulse on each dribble touch
      const segT = (t * DRIBBLE_TAPS) % 1;
      const touch = Math.sin(Math.min(1, segT / 0.4) * Math.PI);
      ballSqX = 1 + 0.14 * touch;
      ballSqY = 1 - 0.16 * touch;
    } else if (inCycle < DRIBBLE + STEPOVER) {
      // ball is still during the stepover — no squash
    } else {
      // FLICK: ball compresses as the toe scoops under it, then springs up.
      const t = (inCycle - DRIBBLE - STEPOVER) / FLICK;
      const press = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) : 0;
      ballSqX = 1 + 0.18 * press;
      ballSqY = 1 - 0.2 * press;
      ballRot = senderDir * easeOut(Math.min(1, t)) * 90; // slow tumble as it lifts
    }
  } else if (inCycle < pChestEnd) {
    // chest contact press at the start of the rebound
    const t = (inCycle - pPassEnd) / CHEST;
    const press = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0;
    ballSqX = 1 + 0.22 * press;
    ballSqY = 1 - 0.24 * press;
  } else {
    const t = (inCycle - pChestEnd) / FOOTCTL;
    if (t >= 0.32 && t < 0.68) {
      const touch = Math.sin(((t - 0.32) / 0.36) * Math.PI);
      ballSqX = 1 + 0.12 * touch;
      ballSqY = 1 - 0.14 * touch;
    }
  }

  const ballOpacity = 1;

  // ── Text reveal (top-left) ──
  const titleProg = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleX = interpolate(titleProg, [0, 1], [-30, 0]);
  const underline = interpolate(frame, [24, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(frame, [30, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Stat cards reveal ──
  const cardIn = (i: number) => interpolate(frame, [40 + i * 6, 58 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titlePx = titleFontSize ?? (p ? 78 : 76);
  const descPx = descriptionFontSize ?? (p ? 50 : 40);
  const portraitTextGap = Math.max(52, descPx * 0.85);

  // ── Stat card panel (cardboard look) — fixed 2-column grid (2 per column) ──
  const StatCards: React.FC<{ style?: React.CSSProperties; flow?: boolean }> = ({ style, flow }) => (
    <div
      style={{
        ...(flow ? {} : { position: "absolute" }),
        display: "grid",
        gridTemplateColumns: "repeat(2, auto)",
        gap: p ? 24 : 18,
        ...style,
      }}
    >
      {statItems.map((s, i) => {
        const inP = cardIn(i);
        return (
          <div
            key={i}
            style={{
              opacity: inP,
              transform: `translateY(${(1 - inP) * 16}px) rotate(${(i % 2 === 0 ? -1 : 1) * 1.5}deg)`,
              background: "#C8A26A", // cardboard
              border: "3px solid #8A6A3B",
              borderRadius: 8,
              padding: p ? "18px 22px" : "16px 22px",
              boxShadow: "4px 6px 0 rgba(0,0,0,0.18)",
              minWidth: p ? 150 : 180,
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: font, fontWeight: 700, color: "#2B1C0B", fontSize: p ? 52 : 44, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: font, color: "#4A3416", fontSize: p ? 26 : 22, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: font, overflow: "hidden" }}>
      {/* Grass-green radial wash */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.12) 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* World SVG: grass, players, ball */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <GrassGround W={W} H={H} groundY={groundY} accent={accent} />

          <PlayerStickman
            x={leftPose.x} groundY={leftPose.groundY} faceDir={1}
            kickLeg={leftPose.kickLeg} plantBend={leftPose.plantBend} torsoBias={leftPose.torsoBias}
            armSwing={leftPose.armSwing} headTilt={leftPose.headTilt}
            tSec={tSec} thighLen={thighLen} shinLen={shinLen} torsoLen={torsoLen} headR={headR} headLen={headLen}
            stroke={text} sw={sw} variant={0} faceOpacity={1} walk={leftWalk}
          />
          <PlayerStickman
            x={rightPose.x} groundY={rightPose.groundY} faceDir={-1}
            kickLeg={rightPose.kickLeg} plantBend={rightPose.plantBend} torsoBias={rightPose.torsoBias}
            armSwing={rightPose.armSwing} headTilt={rightPose.headTilt}
            tSec={tSec} thighLen={thighLen} shinLen={shinLen} torsoLen={torsoLen} headR={headR} headLen={headLen}
            stroke={text} sw={sw} variant={2} faceOpacity={1} walk={rightWalk}
          />

          {/* Ball (no dashed trajectory line) */}
          <g opacity={ballOpacity}>
            <Football x={ballX} y={ballY} r={ballR} rot={ballRot} sqX={ballSqX} sqY={ballSqY} accent={accent} />
          </g>
        </svg>
      </AbsoluteFill>

      {/* Title + narration (+ stat cards in portrait) */}
      {p ? (
        <div
          style={{
            position: "absolute",
            top: H * 0.06,
            left: W * 0.06,
            right: W * 0.06,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: portraitTextGap,
            pointerEvents: "none",
          }}
        >
          <div style={{ transform: `translateX(${titleX}px)`, opacity: titleProg }}>
            <div
              style={{
                fontFamily: font,
                fontSize: titlePx,
                fontWeight: 700,
                color: text,
                textAlign: "left",
                letterSpacing: "0.02em",
                lineHeight: 1.1,
                textTransform: "uppercase",
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
                width: W * 0.5,
                background: accent,
                transformOrigin: "left center",
                transform: `scaleX(${underline})`,
                borderRadius: 2,
              }}
            />
            {narration && (
              <div
                style={{
                  marginTop: 26,
                  opacity: narrationOpacity * 0.85,
                  fontFamily: font,
                  fontSize: descPx,
                  fontWeight: 400,
                  color: text,
                  textAlign: "left",
                  letterSpacing: "0.02em",
                  lineHeight: 1.42,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {narration}
              </div>
            )}
          </div>

          {statItems.length > 0 && <StatCards flow style={{ justifyContent: "center" }} />}
        </div>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              top: H * 0.08,
              left: W * 0.05,
              maxWidth: W * 0.5,
              transform: `translateX(${titleX}px)`,
              opacity: titleProg,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: titlePx,
                fontWeight: 700,
                color: text,
                textAlign: "left",
                letterSpacing: "0.02em",
                lineHeight: 1.08,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 10,
                height: 4,
                width: W * 0.28,
                background: accent,
                transformOrigin: "left center",
                transform: `scaleX(${underline})`,
                borderRadius: 2,
              }}
            />
            {narration && (
              <div
                style={{
                  marginTop: 26,
                  opacity: narrationOpacity * 0.85,
                  fontFamily: font,
                  fontSize: descPx,
                  fontWeight: 400,
                  color: text,
                  textAlign: "left",
                  letterSpacing: "0.02em",
                  lineHeight: 1.4,
                  maxWidth: W * 0.46,
                }}
              >
                {narration}
              </div>
            )}
          </div>

          {statItems.length > 0 && (
            <StatCards style={{ top: H * 0.16, right: W * 0.06, justifyContent: "end" }} />
          )}
        </>
      )}
    </AbsoluteFill>
  );
};
