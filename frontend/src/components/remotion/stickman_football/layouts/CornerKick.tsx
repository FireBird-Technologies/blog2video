import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Football, GrassGround, PlayerStickman } from "../shared";

// Corner-kick build-up: the ball is kicked in from the right corner and passed
// stickman-to-stickman across a series of STEPS (each pass = one step, 3–5 total),
// ending with a header on goal that MISSES / is saved. A goalkeeper guards the goal
// (far left) and gathers the ball after the save. Each step's label pops above the
// receiving stickman's head when the ball arrives and persists afterward.
//
// Built from the same primitives as PassingPlay / FreekickSetup (Football,
// PlayerStickman, GrassGround) with deterministic, frame-stable animation.
export const CornerKick: React.FC<SceneLayoutProps> = (props) => {
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
    steps,
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

  const titlePx = titleFontSize ?? (p ? 95 : 82);
  const descPx = descriptionFontSize ?? (p ? 52 : 40);
  // Step-card text scales from description size; landscape is only slightly smaller.
  const stepFontPx = Math.max(10, Math.round(descPx * (p ? 0.52 : 0.68)));
  const stepDetailFontPx = Math.max(9, Math.round(descPx * (p ? 0.44 : 0.58)));
  // Cards grow a little in width up to this cap, then wrap (growing in height).
  const stepCardMaxW = p ? 240 : 220;

  // ── Steps: clamp to 3–5; synthesize sensible defaults if too few ─────────────
  const FALLBACK = ["Corner", "Pass", "Through ball", "Build-up", "Header"];
  const rawSteps = (Array.isArray(steps) ? steps : [])
    .filter((s) => s && (s.label || s.detail))
    .slice(0, 5);
  const stepCount = Math.min(5, Math.max(3, rawSteps.length || 3));
  const stepList: { label: string; detail: string }[] = Array.from({ length: stepCount }, (_, i) => {
    const s = rawSteps[i];
    const isLast = i === stepCount - 1;
    return {
      label: (s?.label || (isLast ? "Header" : FALLBACK[Math.min(i, FALLBACK.length - 1)])).trim(),
      detail: (s?.detail || "").trim(),
    };
  });

  // ── Scene-level enter/exit ───────────────────────────────────────────────────
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeIn = (t: number) => t * t;
  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ── Figure sizing (match PassingPlay) ────────────────────────────────────────
  const ballR = p ? 26 : 28;
  const FIG = p ? 1.7 : 1.35;
  const torsoLen = 52 * FIG;
  const headR = 20 * FIG;
  const headLen = 20 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;
  const sw = 5.5;

  // ── Pitch geometry: reserve grass-band space for centred narration ───────────
  const narrMaxW = W * (p ? 0.88 : 0.72);
  const narrationLines = narration
    ? estimateWrappedLines(narration, Math.max(16, Math.floor(narrMaxW / (descPx * 0.48))))
    : 0;
  const narrLineH = descPx * 1.4;
  const narrBlockH = narration ? narrationLines * narrLineH + descPx * 0.5 : 0;
  const grassPad = H * (p ? 0.035 : 0.03);
  const grassBandMin = narrBlockH + grassPad * 2;
  const groundYDefault = H * (p ? 0.72 : 0.8);
  const figureStackH = thighLen + shinLen + torsoLen + headLen + headR + (p ? 56 : 46) + 24;
  const titleBandH = H * 0.06 + titlePx * 1.15 + 32;
  const playerZoneMin = titleBandH + figureStackH;
  const groundY = Math.max(playerZoneMin, Math.min(groundYDefault, H - grassBandMin));
  // Narration sits at the vertical centre of the grass band (groundY → bottom).
  const grassCenterY = (groundY + H) / 2;
  // Head-top in pixel space for a planted figure (badges sit above this).
  const headTopY = groundY - (thighLen + shinLen) - torsoLen - headLen - headR;
  // Header contact: ball grazes the crown of the head, not the centre of the face.
  const headContactY = headTopY - ballR * 0.2;

  // Goal at the far left.
  const goalRight = W * 0.13;
  const goalLeft = W * 0.03;
  const goalHeight = H * (p ? 0.1 : 0.16);
  const goalTop = groundY - goalHeight;
  const goalKeeperX = (goalLeft + goalRight) / 2 + (goalRight - goalLeft) * 0.2;

  // Corner flag pulled in from the right edge so there's room to run up.
  const cornerFlagX = W * 0.86;
  const cornerFlagY = groundY - ballR;
  // The taker plants just to the RIGHT of the ball so his foot swings left through it.
  const takerPlantX = cornerFlagX + headR * 1.6;

  // Passing stickmen: receiver 0 is the corner taker (right, beside the ball), the
  // last receiver heads on goal (left). Spread them evenly between taker and goal.
  const passLeftX = W * 0.24; // last passing stickman (heads on goal) sits here
  const passRightX = takerPlantX; // corner taker, beside the ball
  const playerX = (i: number) =>
    stepCount <= 1 ? passRightX : passRightX + ((passLeftX - passRightX) * i) / (stepCount - 1);


  // ── Phase timing: SETUP → RUNUP → one travel per pass → DROP → PICKUP ────────
  // SETUP: ball sits at the corner. RUNUP: the first player (corner taker) runs up
  // to the ball. Then `travelCount` travels carry the ball figure-to-figure and
  // finally at goal. The first travel is the taker's foot kick (the corner delivery);
  // every later pass is a single HEAD touch. The final travel is a header that hits
  // the goal post — the ball DROPS to the ground (never stops in air), then the
  // goalkeeper runs across and PICKs it up into his hands.
  const SETUP = Math.round(fps * 0.4);
  const RUNUP = Math.round(fps * 0.8);
  const TRAVEL = Math.round(fps * 0.8);
  const DROP = Math.round(fps * 0.55);
  const PICKUP = Math.round(fps * 0.9);
  const travelCount = stepCount;
  const runupStart = SETUP;
  const travelsStart = SETUP + RUNUP;
  // phaseStart[k] = frame at which travel k begins (k in 0..travelCount-1)
  const phaseStart = (k: number) => travelsStart + k * TRAVEL;
  const dropStart = phaseStart(travelCount - 1) + TRAVEL;
  const pickupStart = dropStart + DROP;

  const beforeStart = frame < SETUP;
  const inRunup = frame >= runupStart && frame < travelsStart;
  const inDrop = frame >= dropStart && frame < pickupStart;
  const inPickup = frame >= pickupStart;

  // Run-up progress for the first player (0 → 1).
  const runupT = interpolate(frame, [runupStart, travelsStart - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Which travel are we in, and its local progress 0..1 (clamped to the travel band).
  const sinceTravels = Math.max(0, frame - travelsStart);
  const curTravel = Math.min(travelCount - 1, Math.floor(sinceTravels / TRAVEL));
  const travelLocal = Math.max(0, Math.min(1, (frame - phaseStart(curTravel)) / TRAVEL));

  // Each travel k goes from sourceX → targetX. Travel 0 is the corner delivery
  // (flag → player 1). Travel k (1..n-2) is player(k) → player(k+1) via a header.
  // Travel n-1 is the final header: last player → goal POST (then the ball drops).
  const isFinalTravel = (k: number) => k === travelCount - 1;
  // The post the header strikes: top of the right upright (near corner of the goal).
  const postX = goalRight;
  const postY = goalTop + goalHeight * 0.06;
  // Where the ball settles after rebounding off the post — just inside the goalmouth.
  const ballRestX = goalRight - (goalRight - goalLeft) * 0.18;
  // Keeper gathers it: he ends just LEFT of the ball, then holds it out in front at
  // waist height (matching the kickoff-title hold: handHold ≈ groundY − legLen − 64).
  const gkLegLen = (thighLen + shinLen) * 0.9;
  const gkGatherX = ballRestX - (goalRight - goalLeft) * 0.34;
  const gkHandX = gkGatherX + headR * 2.0; // out in front of him, toward the ball
  const gkHandY = groundY - gkLegLen - headR * 2.6;
  // Travel k is sent by figure k toward figure k+1 (the last one toward the post).
  // Travel 0 is the corner taker's FOOT kick from the flag; every later pass is a
  // single HEAD touch, so it leaves/arrives at head height.
  const travelSource = (k: number): { x: number; y: number } =>
    k === 0 ? { x: cornerFlagX, y: cornerFlagY } : { x: playerX(k), y: headContactY };
  const travelTarget = (k: number): { x: number; y: number } =>
    isFinalTravel(k) ? { x: postX, y: postY } : { x: playerX(k + 1), y: headContactY };

  // ── Ball position ─────────────────────────────────────────────────────────────
  const src = travelSource(curTravel);
  const tgt = travelTarget(curTravel);
  let ballX: number;
  let ballY: number;
  let ballRot = 0;
  let ballSqX = 1;
  let ballSqY = 1;

  if (beforeStart || inRunup) {
    ballX = cornerFlagX;
    ballY = cornerFlagY;
  } else if (inDrop) {
    // Header hit the post → ball rebounds DOWN and slightly forward into the goalmouth.
    const dt = Math.max(0, Math.min(1, (frame - dropStart) / DROP));
    ballX = interpolate(dt, [0, 1], [postX, ballRestX]);
    // Fall to the ground with a small bounce (|sin| decay).
    const fall = postY + (groundY - ballR - postY) * (dt * dt); // accelerate downward
    const bounce = Math.abs(Math.sin(dt * Math.PI * 1.5)) * (1 - dt) * (H * 0.05);
    ballY = Math.min(groundY - ballR, fall) - bounce;
    ballRot = -(Math.abs(ballRestX - postX) / (2 * Math.PI * ballR)) * 360 * dt - 40;
  } else if (inPickup) {
    // Goalkeeper runs across, bends to the ball (it stays grounded), then lifts it into
    // his hands as he straightens — matching the kickoff-title pickup → hold.
    const pt = Math.max(0, Math.min(1, (frame - pickupStart) / PICKUP));
    const lift = easeOut(Math.max(0, Math.min(1, (pt - 0.68) / 0.32))); // rises as he stands up
    ballX = interpolate(lift, [0, 1], [ballRestX, gkHandX]);
    ballY = interpolate(lift, [0, 1], [groundY - ballR, gkHandY]);
    ballRot = -40;
  } else {
    // Brief crown-touch at travelLocal≈0, then the ball launches immediately — no hold
    // window that would make it look glued to the head between passes.
    const flight = easeOut(travelLocal);
    ballX = interpolate(flight, [0, 1], [src.x, tgt.x]);
    // Parabolic arc: lift through the middle of each pass (higher for the header).
    const arcLift = isFinalTravel(curTravel) ? H * 0.16 : H * 0.1;
    const baseY = src.y + (tgt.y - src.y) * flight;
    ballY = baseY - Math.sin(travelLocal * Math.PI) * arcLift;
    // Spin proportional to horizontal distance covered.
    ballRot = -(Math.abs(tgt.x - src.x) / (2 * Math.PI * ballR)) * 360 * flight;
    // Squash on launch (just after contact).
    const press = travelLocal > 0 && travelLocal < 0.12 ? Math.sin((travelLocal / 0.12) * Math.PI) : 0;
    ballSqX = 1 + 0.2 * press;
    ballSqY = 1 - 0.22 * press;
  }

  // ── Per-figure kick / header pose ────────────────────────────────────────────
  // Figure k sends travel k. Travel 0 is the corner taker's FOOT kick; every other
  // pass (and the final shot) is a single HEAD touch.
  const senderOfTravel = (k: number): number => k;
  const travelIsFootKick = (k: number) => k === 0;

  // The corner taker (figure 0) runs in from the right toward the ball during RUNUP,
  // planting just to the RIGHT of the ball so his kicking foot swings left through it.
  const takerRunStartX = takerPlantX + W * 0.12;
  const takerRunEndX = takerPlantX;
  const gaitCycle = frame * 0.5;

  const figurePose = (i: number) => {
    // Is this figure the sender of the current travel, in its wind-up/strike window?
    let kickLeg = 0;
    let plantBend = 0;
    let torsoBias = 0;
    let headTilt = 0;
    let xOverride: number | undefined;
    let walk: { amt: number; cycle: number; moveDir: number } | undefined;

    // Run-up: only figure 0, only while running toward the ball.
    if (i === 0 && (beforeStart || inRunup)) {
      const rt = beforeStart ? 0 : easeOut(runupT);
      xOverride = interpolate(rt, [0, 1], [takerRunStartX, takerRunEndX]);
      // Blend the gait out as he settles next to the ball.
      const amt = inRunup ? 1 - interpolate(runupT, [0.82, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
      walk = { amt, cycle: gaitCycle, moveDir: -1 };
    } else if (!beforeStart && !inRunup && !inDrop) {
      const k = curTravel;
      // Quick strike that peaks early (by ~travelLocal 0.15), matching the ball's
      // brief crown-touch — for headers it's a fast nod, not a held pose.
      if (senderOfTravel(k) === i && travelLocal < 0.18) {
        const strike = easeInOut(travelLocal / 0.15); // 0 wind-up → 1 contact
        if (!travelIsFootKick(k)) {
          // Header: a single quick nod forward and back.
          headTilt = Math.sin(strike * Math.PI) * 26;
          torsoBias = Math.sin(strike * Math.PI) * 6;
        } else {
          // Foot kick: wind up (−) into follow-through (+).
          kickLeg = interpolate(strike, [0, 1], [-0.35, 0.9]);
          plantBend = Math.sin(strike * Math.PI) * 0.5;
          torsoBias = strike * 4;
        }
      }
    }
    return { kickLeg, plantBend, torsoBias, headTilt, xOverride, walk };
  };

  // ── Goalkeeper: guards goal → reaches on the shot → runs across to gather the
  // ball after it drops, picking it up into his hands (facing RIGHT toward it). ──
  const gkPose = (() => {
    // Reach amount while the final header is on its way / rebounding.
    let reach = 0;
    if (inDrop) reach = 1;
    else if (!beforeStart && !inRunup && isFinalTravel(curTravel)) reach = easeOut(travelLocal);

    if (inPickup) {
      const pt = Math.max(0, Math.min(1, (frame - pickupStart) / PICKUP));
      // Run from his guarding spot to beside the ball over the first ~45%.
      const runT = easeOut(Math.max(0, Math.min(1, pt / 0.45)));
      const x = interpolate(runT, [0, 1], [goalKeeperX, gkGatherX]);
      const arrived = pt >= 0.45;
      const walkAmt = arrived ? 0 : 1 - interpolate(pt / 0.45, [0.8, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      // Same pickup shape as the kickoff-title main player: bend forward to the ball,
      // grab it, then straighten while holding it out in front.
      // bendDown ramps in 0.45→0.7, straightens 0.7→1.0 (KickoffTitle: bendDown−bendUp).
      const bendDown = easeOut(Math.max(0, Math.min(1, (pt - 0.45) / 0.25)));
      const bendUp = easeIn(Math.max(0, Math.min(1, (pt - 0.7) / 0.3)));
      const bendForward = Math.max(0, bendDown - bendUp);
      const grab = easeOut(Math.max(0, Math.min(1, (pt - 0.62) / 0.38)));
      return {
        x,
        faceDir: 1, // face RIGHT toward the ball
        armPose: (grab > 0.55 ? "gkHold" : "gkReach") as "gkHold" | "gkReach",
        armPoseAmt: arrived ? 1 : 0.5,
        // Positive torsoBias → mirrored gk leans forward toward the ball on the ground.
        torsoBias: bendForward * 58,
        walk: { amt: walkAmt, cycle: gaitCycle, moveDir: 1 },
      };
    }
    return {
      x: goalKeeperX,
      faceDir: 1, // face the incoming ball (from the right)
      armPose: "gkReach" as const,
      armPoseAmt: reach,
      torsoBias: 0,
      walk: undefined as undefined | { amt: number; cycle: number; moveDir: number },
    };
  })();

  // ── Step labels: pop in when the ball ARRIVES at the figure, then persist ────
  // Figure 0 (taker) reveals when he kicks (start of travel 0). Figure i (≥1)
  // receives travel i-1, which ends at figure i — reveal there.
  const labelRevealFrame = (i: number) =>
    i === 0 ? phaseStart(0) : phaseStart(i - 1) + TRAVEL;
  const labelOpacity = (i: number) =>
    interpolate(frame, [labelRevealFrame(i), labelRevealFrame(i) + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // ── Title / narration timing ─────────────────────────────────────────────────
  const titleProg = interpolate(frame, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underline = interpolate(frame, [20, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrProg = interpolate(frame, [26, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Goal net lines.
  const netLines = () => {
    const lines: React.ReactNode[] = [];
    const gw = goalRight - goalLeft;
    const gh = groundY - goalTop;
    for (let i = 1; i < 6; i++) {
      const x = goalLeft + (i / 6) * gw;
      lines.push(<line key={`nv${i}`} x1={x} y1={goalTop} x2={x} y2={groundY} stroke={text} strokeWidth={1} opacity={0.22} />);
    }
    for (let i = 1; i < 4; i++) {
      const y = goalTop + (i / 4) * gh;
      lines.push(<line key={`nh${i}`} x1={goalLeft} y1={y} x2={goalRight} y2={y} stroke={text} strokeWidth={1} opacity={0.22} />);
    }
    return lines;
  };

  const badgeBaseY = headTopY - (p ? 150 : 46);
  // Portrait + multiple steps: stagger cards up/down so they don't collide horizontally.
  const portraitZigzag = p && stepCount >= 3;
  const zigzagAmp = portraitZigzag
    ? Math.max(100, stepFontPx * 4.2 + (stepList.some((s) => s.detail) ? stepDetailFontPx * 2.6 : 0))
    : 0;
  const stepBadgeY = (i: number) => {
    if (!portraitZigzag) return badgeBaseY;
    const half = zigzagAmp / 2;
    return badgeBaseY - half + (i % 2 === 0 ? 0 : zigzagAmp);
  };

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: font }}>
      <AbsoluteFill>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <GrassGround W={W} H={H} groundY={groundY} accent={accent} />

          {/* Goal frame (far left) */}
          <line x1={goalLeft} y1={goalTop} x2={goalLeft} y2={groundY} stroke={text} strokeWidth={3} />
          <line x1={goalRight} y1={goalTop} x2={goalRight} y2={groundY} stroke={text} strokeWidth={3} />
          <line x1={goalLeft} y1={goalTop} x2={goalRight} y2={goalTop} stroke={text} strokeWidth={3} />
          {netLines()}

          {/* Corner flag (far right) */}
          <line x1={cornerFlagX} y1={groundY} x2={cornerFlagX} y2={groundY - H * 0.1} stroke={text} strokeWidth={3} />
          <path
            d={`M ${cornerFlagX} ${groundY - H * 0.1} L ${cornerFlagX - 34} ${groundY - H * 0.1 + 12} L ${cornerFlagX} ${groundY - H * 0.1 + 24} Z`}
            fill={accent}
            stroke={text}
            strokeWidth={2}
          />

          {/* Goalkeeper — guards goal, reaches on the header, then runs across to
              gather the ball. Mirrored horizontally so the gk arm poses (authored to
              reach left) point RIGHT, toward the incoming ball / goalmouth. */}
          <g transform={`translate(${gkPose.x * 2} 0) scale(-1 1)`}>
            <PlayerStickman
              x={gkPose.x}
              groundY={groundY}
              faceDir={1}
              kickLeg={0}
              plantBend={0}
              torsoBias={gkPose.torsoBias}
              armPose={gkPose.armPose}
              armPoseAmt={gkPose.armPoseAmt}
              armIdle={1}
              walk={gkPose.walk}
              tSec={tSec}
              thighLen={thighLen * 0.9}
              shinLen={shinLen * 0.9}
              torsoLen={torsoLen * 0.9}
              headR={headR * 0.9}
              headLen={headLen * 0.9}
              stroke={text}
              sw={sw}
              variant={1}
            />
          </g>

          {/* Passing stickmen — one per step, right → left. Figure 0 (taker) runs
              up to the ball first; everyone faces/attacks toward the goal (left). */}
          {stepList.map((_, i) => {
            const pose = figurePose(i);
            return (
              <PlayerStickman
                key={`pl-${i}`}
                x={pose.xOverride ?? playerX(i)}
                groundY={groundY}
                faceDir={-1}
                kickLeg={pose.kickLeg}
                plantBend={pose.plantBend}
                torsoBias={pose.torsoBias}
                headTilt={pose.headTilt}
                walk={pose.walk}
                tSec={tSec}
                thighLen={thighLen}
                shinLen={shinLen}
                torsoLen={torsoLen}
                headR={headR}
                headLen={headLen}
                stroke={text}
                sw={sw}
                variant={i % 3}
              />
            );
          })}

          {/* Ball */}
          <Football x={ballX} y={ballY} r={ballR} rot={ballRot} sqX={ballSqX} sqY={ballSqY} accent={accent} />
        </svg>
      </AbsoluteFill>

      {/* Step labels — float above each receiving stickman's head, persist */}
      {stepList.map((s, i) => {
        const op = labelOpacity(i);
        if (op <= 0.01) return null;
        return (
          <div
            key={`lab-${i}`}
            style={{
              position: "absolute",
              left: playerX(i),
              top: stepBadgeY(i),
              transform: "translate(-50%, -100%)",
              opacity: op,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              pointerEvents: "none",
              fontFamily: font,
            }}
          >
            <div
              style={{
                background: accent,
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: stepFontPx,
                lineHeight: 1.18,
                // Card grows with its text: a little in width (caps at maxWidth), then
                // more in height as longer labels wrap onto extra lines.
                padding: `${Math.round(stepFontPx * 0.5)}px ${Math.round(stepFontPx * 0.7)}px`,
                maxWidth: stepCardMaxW,
                borderRadius: 10,
                border: `3px solid ${text}`,
                boxShadow: "3px 4px 0 rgba(0,0,0,0.18)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                textAlign: "center",
                whiteSpace: "normal",
                overflowWrap: "break-word",
              }}
            >
              {s.label}
            </div>
            {s.detail && (
              <div
                style={{
                  color: text,
                  fontWeight: 700,
                  fontSize: stepDetailFontPx,
                  lineHeight: 1.2,
                  maxWidth: stepCardMaxW,
                  textAlign: "center",
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                }}
              >
                {s.detail}
              </div>
            )}
          </div>
        );
      })}

      {/* Title — top center */}
      <div
        style={{
          position: "absolute",
          top: H * 0.06,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: `0 ${p ? 6 : 8}%`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: titleProg,
            transform: `translateY(${(1 - titleProg) * 22}px)`,
            color: text,
            fontSize: titlePx,
            fontWeight: 800,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            lineHeight: 1.06,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 12,
            height: 4,
            width: p ? W * 0.4 : W * 0.24,
            background: accent,
            borderRadius: 2,
            transformOrigin: "center",
            transform: `scaleX(${underline})`,
          }}
        />
      </div>

      {/* Narration — centred on the grass band; grows up and down as it wraps */}
      {narration && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: grassCenterY,
            transform: "translate(-50%, -50%)",
            width: narrMaxW,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              opacity: narrProg,
              color: text,
              fontSize: descPx,
              fontWeight: 500,
              textAlign: "center",
              lineHeight: 1.4,
              wordBreak: "break-word",
              overflowWrap: "break-word",
              width: "100%",
            }}
          >
            {narration}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

function estimateWrappedLines(text: string, maxCharsPerLine: number): number {
  if (!text) return 0;
  const words = text.split(" ");
  let lines = 1;
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines++;
      current = word;
    }
  }
  return lines;
}
