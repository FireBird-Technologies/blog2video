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

  // Toe-tap dribble: one touch when `taps` is 1 and `localT` runs 0→1.
  const dribbleFoot = (localT: number, faceDir: number, taps = 1) => {
    const clamped = Math.max(0, Math.min(1, localT));
    const tapLocal = (clamped * taps) % 1;
    const touch = Math.sin(tapLocal * Math.PI);
    return {
      dx: faceDir * (5 + touch * 18),
      dy: -touch * (H * 0.034),
      kickLeg: touch * 0.42,
      plantBend: 0.07 + touch * 0.12,
    };
  };

  const DRIBBLE_END = 0.38;   // fraction of control/foot phases spent on one touch
  const WINDUP_START = DRIBBLE_END;

  // ── Pass cycle state machine (after the opening sequence) ────────────────────
  const sinceStart = Math.max(0, frame - playStart);
  const CONTROL = fps * 0.72;   // one dribble, then pass wind-up
  const PASS = fps * 0.55;
  const CHEST = fps * 0.45;
  const FOOTCTL = fps * 0.5;    // settle at foot, one dribble, hold
  const CYCLE = CONTROL + PASS + CHEST + FOOTCTL;

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
    const t = (frame - INCOMING - INCOMING_CHEST) / INCOMING_FOOT;
    const baseX = leftDrawX + 36;
    if (t < 0.38) {
      ballX = baseX;
      ballY = interpolate(easeOut(t / 0.38), [0, 1], [chestY, footBallY]);
    } else if (t < 0.72) {
      const d = dribbleFoot((t - 0.38) / 0.34, 1, 1);
      ballX = baseX + d.dx;
      ballY = footBallY + d.dy;
      receiverKick = { kickLeg: d.kickLeg, plantBend: d.plantBend, torsoBias: 0 };
      dribbleBodyLeftX = d.dx * 0.35;
    } else {
      ballX = baseX;
      ballY = footBallY;
    }
  } else if (inCycle < pControlEnd) {
    const t = inCycle / CONTROL;
    const baseX = senderX + senderDir * 36;

    if (t < DRIBBLE_END) {
      const d = dribbleFoot(t / DRIBBLE_END, senderDir, 1);
      ballX = baseX + d.dx;
      ballY = footBallY + d.dy;
      senderKick = { kickLeg: d.kickLeg, plantBend: d.plantBend, torsoBias: senderDir * 2 };
      if (senderIsLeft) dribbleBodyLeftX = d.dx * 0.35;
      else dribbleBodyRightX = d.dx * 0.35;
    } else {
      ballX = baseX;
      ballY = footBallY;
      const w = (t - WINDUP_START) / (1 - WINDUP_START);
      if (w < 0.5) senderKick = { kickLeg: -0.4 * (w / 0.5), plantBend: 0.2 * (w / 0.5), torsoBias: 8 * (w / 0.5) };
      else senderKick = { kickLeg: -0.4 + 1.4 * ((w - 0.5) / 0.5), plantBend: 0.4, torsoBias: 4 };
    }
  } else if (inCycle < pPassEnd) {
    // PASS: ball flies from sender's foot toward the receiver's chest (arc, spin, no trail)
    const t = (inCycle - pControlEnd) / PASS;
    const fromX = senderX + senderDir * 40;
    const toX = receiverX + receiverDir * 24;
    ballX = interpolate(easeOut(t), [0, 1], [fromX, toX]);
    const arc = Math.sin(t * Math.PI) * (H * 0.14);
    ballY = interpolate(t, [0, 1], [footBallY, chestY]) - arc;
    senderKick = { kickLeg: 1.0 * (1 - t), plantBend: 0.3 * (1 - t), torsoBias: 0 };
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
  } else {
    const t = (inCycle - pChestEnd) / FOOTCTL;
    const baseX = receiverX + receiverDir * 36;
    if (t < 0.32) {
      ballX = baseX;
      ballY = footBallY;
    } else if (t < 0.68) {
      const d = dribbleFoot((t - 0.32) / 0.36, receiverDir, 1);
      ballX = baseX + d.dx;
      ballY = footBallY + d.dy;
      receiverKick = { kickLeg: d.kickLeg, plantBend: d.plantBend, torsoBias: 0 };
      if (senderIsLeft) dribbleBodyRightX = d.dx * 0.35;
      else dribbleBodyLeftX = d.dx * 0.35;
    } else {
      ballX = baseX;
      ballY = footBallY;
    }
  }

  // Map sender/receiver kick onto left/right players.
  const inOpening = frame < playStart;
  const leftKick = inOpening ? receiverKick : (senderIsLeft ? senderKick : receiverKick);
  const rightKick = inOpening ? { kickLeg: 0, plantBend: 0, torsoBias: 0 } : (senderIsLeft ? receiverKick : senderKick);

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
  };
  const rightPose = {
    x: rightDrawX + (rightRunning ? 0 : rightWarm.swayX * rightWarmBlend) + (rightRunning ? 0 : dribbleBodyRightX),
    groundY,
    kickLeg: rightRunning ? 0 : rightKick.kickLeg + rightWarm.kickLeg * rightWarmBlend,
    plantBend: rightRunning ? 0 : rightKick.plantBend + rightWarm.plantBend * rightWarmBlend,
    torsoBias: rightRunning ? 6 * rightWalk.amt : rightKick.torsoBias + rightWarm.torsoLean * rightWarmBlend,
  };

  // Keep the ball glued to the active player's foot during pass wind-up only.
  if (frame >= playStart && inCycle < pControlEnd) {
    const t = inCycle / CONTROL;
    if (t > WINDUP_START) {
      const w = senderIsLeft ? leftWarm : rightWarm;
      const b = senderIsLeft ? leftWarmBlend : rightWarmBlend;
      ballX += w.swayX * b * 0.5;
    }
  }

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
    const t = (inCycle - pControlEnd) / PASS;
    ballRot = senderDir * t * 270;            // < 1 turn across the flight
    // press right as it leaves the boot (first ~12% of flight): squashed along x
    const press = t < 0.12 ? Math.sin((t / 0.12) * Math.PI) : 0;
    ballSqX = 1 - 0.28 * press;
    ballSqY = 1 + 0.3 * press;
  } else if (inCycle < pControlEnd) {
    const t = inCycle / CONTROL;
    if (t < DRIBBLE_END) {
      const touch = Math.sin((t / DRIBBLE_END) * Math.PI);
      ballSqX = 1 + 0.14 * touch;
      ballSqY = 1 - 0.16 * touch;
    } else {
      const press = t > 0.78 && t < 0.9 ? Math.sin(((t - 0.78) / 0.12) * Math.PI) : 0;
      ballSqX = 1 + 0.26 * press;
      ballSqY = 1 - 0.28 * press;
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
            tSec={tSec} thighLen={thighLen} shinLen={shinLen} torsoLen={torsoLen} headR={headR} headLen={headLen}
            stroke={text} sw={sw} variant={0} faceOpacity={1} walk={leftWalk}
          />
          <PlayerStickman
            x={rightPose.x} groundY={rightPose.groundY} faceDir={-1}
            kickLeg={rightPose.kickLeg} plantBend={rightPose.plantBend} torsoBias={rightPose.torsoBias}
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
