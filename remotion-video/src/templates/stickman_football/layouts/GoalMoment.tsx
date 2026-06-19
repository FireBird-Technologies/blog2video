import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { Football, GrassGround, PlayerStickman } from "../shared";

const cubicBezier = (t: number, a: number, b: number, c: number, d: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export const GoalMoment: React.FC<SceneLayoutProps> = (props) => {
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
  const goalLabel = (props as any).goalLabel ?? "GOAL!";
  const scoreline = (props as any).scoreline ?? "";
  const kickerName = (props as any).kickerName as string | undefined;
  const kickerNumber = (props as any).kickerNumber as string | undefined;

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

  const pitchFade = interpolate(frame, [0, msToFrames(350)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imageOpacity = interpolate(frame, [0, msToFrames(500)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const moodImageUrl = imageUrl ?? String((props as unknown as Record<string, unknown>).imageUrl ?? "");

  const titleStart = msToFrames(350);
  const titleWipe = interpolate(frame, [titleStart, titleStart + msToFrames(420)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationOpacity = interpolate(frame, [titleStart + msToFrames(150), titleStart + msToFrames(450)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  const runStart = msToFrames(800);
  const kickWindupStart = msToFrames(2050);
  const kickStart = msToFrames(2220);
  const kickDur = msToFrames(780);
  const goalHitFrame = kickStart + kickDur;
  const celebrateStart = goalHitFrame + msToFrames(140);
  const jumpEnd = celebrateStart + msToFrames(450);
  const armRaiseStart = jumpEnd;
  const armRaiseEnd = armRaiseStart + msToFrames(550);

  const kickT = interpolate(frame, [kickStart, goalHitFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const goalPopOpacity = interpolate(frame, [goalHitFrame, goalHitFrame + msToFrames(380)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scoreOpacity = interpolate(frame, [goalHitFrame + msToFrames(280), goalHitFrame + msToFrames(580)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const FIG = p ? 1.9 : 1.5;
  const MINI_FIG = FIG * 0.5;
  const GK_FIG = FIG * 0.76;
  const torsoLen = 52 * FIG;
  const headR = 20 * FIG;
  const headLen = 20 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;
  const sw = 5.5;
  const ballR = p ? 26 : 22;

  const miniTorsoLen = 52 * MINI_FIG;
  const miniHeadR = 20 * MINI_FIG;
  const miniHeadLen = 20 * MINI_FIG;
  const miniThighLen = 30 * MINI_FIG;
  const miniShinLen = 30 * MINI_FIG;

  const gkTorsoLen = 52 * GK_FIG;
  const gkHeadR = 20 * GK_FIG;
  const gkHeadLen = 20 * GK_FIG;
  const gkThighLen = 30 * GK_FIG;
  const gkShinLen = 30 * GK_FIG;

  const titlePx = titleFontSize ?? (p ? 80 : 66);
  const descPx = descriptionFontSize ?? (p ? 50 : 35);
  const fieldTextMaxW = W * 0.85;
  const fieldTextGap = Math.max(descPx * 0.45, titlePx * 0.12);
  const textBottomPad = H * 0.035;

  const titleLines = estimateWrappedLines(title ?? "", Math.max(12, Math.floor(fieldTextMaxW / (titlePx * 0.52))));
  const narrationLines = narration
    ? estimateWrappedLines(narration, Math.max(16, Math.floor(fieldTextMaxW / (descPx * 0.48))))
    : 0;
  const textBlockH =
    titleLines * titlePx * 1.12 +
    14 +
    (narration ? fieldTextGap + narrationLines * descPx * 1.42 : 0);
  const textReserve = textBlockH + textBottomPad + H * 0.045;
  const playerZoneMin = H * (p ? 0.50 : 0.48);
  const groundY = Math.max(playerZoneMin, Math.min(H * (p ? 0.58 : 0.56), H - textReserve));

  const goalBottom = groundY;
  const goalHeight = H * (p ? 0.11 : 0.15);
  const goalTop = goalBottom - goalHeight;
  const goalLeft = W * (p ? 0.62 : 0.68);
  const goalRight = W * (p ? 0.86 : 0.92);
  const goalCenterX = (goalLeft + goalRight) / 2;
  const goalTargetX = goalLeft + (goalRight - goalLeft) * 0.28;
  const goalTargetY = goalTop + goalHeight * 0.24;

  const takerRunStartX = W * (p ? 0.02 : 0.04);
  const takerKickX = W * (p ? 0.12 : 0.18);
  const ballKickX = takerKickX + (p ? 58 : 68);
  const ballKickY = groundY - ballR;

  const wallDefs = [
    { xf: 0.30, variant: 0 },
    { xf: 0.39, variant: 1 },
    { xf: 0.48, variant: 2 },
    { xf: 0.56, variant: 0 },
    { xf: 0.44, variant: 1 },
  ];


  const flightCp1x = ballKickX + (goalTargetX - ballKickX) * 0.35;
  const flightCp1y = ballKickY - H * (p ? 0.26 : 0.3);
  const flightCp2x = goalTargetX - (p ? 50 : 58);
  const flightCp2y = goalTargetY - H * 0.04;

  const ballRestX = goalLeft + (goalRight - goalLeft) * 0.42;
  const ballRestY = goalBottom - ballR - 3;

  const goalStampSpring = spring({
    frame: frame - goalHitFrame,
    fps,
    config: { damping: 9, stiffness: 190, mass: 0.55 },
  });
  const goalStampScale = frame >= goalHitFrame ? Math.min(1.15, goalStampSpring) : 0;
  const goalPopBottomY = goalTop - H * (p ? 0.04 : 0.05);

  const ballBounce = interpolate(
    frame % msToFrames(700),
    [0, msToFrames(350), msToFrames(700)],
    [0, -6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const wallStart = msToFrames(200);
  const wallOpacity = (i: number) =>
    interpolate(
      frame,
      [wallStart + msToFrames(50 * i), wallStart + msToFrames(50 * i) + msToFrames(320)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  const wallSlide = (i: number) =>
    interpolate(
      frame,
      [wallStart + msToFrames(50 * i), wallStart + msToFrames(50 * i) + msToFrames(320)],
      [-18, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const takerOpacity = interpolate(frame, [msToFrames(120), msToFrames(320)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkOpacity = interpolate(frame, [msToFrames(280), msToFrames(550)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const runT = interpolate(frame, [runStart, kickWindupStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const runEase = easeOut(runT);
  const takerX = frame < runStart ? takerRunStartX : interpolate(runEase, [0, 1], [takerRunStartX, takerKickX]);
  // Articulated walk-up gait (whiteboard-style: thigh swing + backward knee bend),
  // driven via PlayerStickman's `walk` prop. Active only during the approach, eased
  // out near the end so the taker plants cleanly before the wind-up.
  const walking = frame >= runStart && frame < kickWindupStart;
  const takerGaitCycle = frame * 0.22;
  const takerWalkAmt = walking
    ? 1 - interpolate(runT, [0.8, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const takerWalk = { amt: takerWalkAmt, cycle: takerGaitCycle, moveDir: 1 };
  const runStride = 0;

  const windupT = interpolate(frame, [kickWindupStart, kickStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const strikeT = interpolate(frame, [kickStart, kickStart + msToFrames(220)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let takerKickLeg = runStride;
  let takerPlantBend = Math.max(0, -runStride) * 0.5 + 0.1;
  let takerTorso = walking ? 6 * takerWalkAmt : 4;
  let takerArmPose: "default" | "celebrate" = "default";
  let takerArmAmt = 0;
  let takerJumpY = 0;

  if (frame >= kickWindupStart && frame < kickStart) {
    takerKickLeg = runStride * (1 - windupT) - 0.15 - windupT * 0.25;
    takerPlantBend = 0.2 + windupT * 0.16;
    takerTorso = 8 + windupT * 5;
  } else if (frame >= kickStart && frame < celebrateStart) {
    takerKickLeg = -0.4 + strikeT * 1.45;
    takerPlantBend = 0.36 * (1 - strikeT * 0.55);
    takerTorso = 13 * (1 - strikeT * 0.75);
  } else if (frame >= celebrateStart && frame < jumpEnd) {
    const jumpT = interpolate(frame, [celebrateStart, jumpEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const jumpArc = Math.sin(jumpT * Math.PI);
    takerJumpY = -jumpArc * (p ? 42 : 36);
    takerKickLeg = jumpArc * 0.42;
    takerPlantBend = 0.18 + jumpArc * 0.32;
    takerTorso = -5 * jumpArc;
  } else if (frame >= jumpEnd) {
    const armT = interpolate(frame, [armRaiseStart, armRaiseEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOut,
    });
    takerKickLeg = 0;
    takerPlantBend = 0.1;
    takerTorso = -6 * Math.min(1, armT);
    takerArmPose = "celebrate";
    takerArmAmt = Math.min(1, armT);
  }

  // ── Kicker name/number badge: tracks the taker (incl. jump), sits above the head ──
  // Head-top in SVG/CSS pixel space (viewBox is 1:1 with the frame). Stays visible for
  // the whole scene (only fades with the taker's own opacity) and sits clear above the
  // head so it never overlaps the figure.
  const headTopY = groundY - (thighLen + shinLen) - torsoLen - headLen - headR + takerJumpY;
  const badgeY = headTopY - (p ? 60 : 50);
  const badgeOpacity = takerOpacity;

  const inFlight = frame >= kickStart && frame < goalHitFrame;
  const afterGoal = frame >= goalHitFrame;
  const flightEase = easeOut(kickT);

  const gkDiveT = interpolate(frame, [kickStart + kickDur * 0.38, goalHitFrame + msToFrames(120)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkWrongDiveX = goalCenterX + (p ? 58 : 68);
  const gkX = interpolate(gkDiveT, [0, 1], [goalCenterX, gkWrongDiveX]);
  const gkRot = gkDiveT * 18;
  const gkTorso = gkDiveT * 16;
  const gkPlantBend = 0.14 + gkDiveT * 0.22;
  const gkKickLeg = gkDiveT * 0.25;

  let ballX = ballKickX;
  let ballY = ballKickY + (frame < kickWindupStart ? ballBounce : 0);
  let ballRot = 0;
  let ballSqX = 1;
  let ballSqY = 1;

  if (inFlight) {
    ballX = cubicBezier(flightEase, ballKickX, flightCp1x, flightCp2x, goalTargetX);
    ballY = cubicBezier(flightEase, ballKickY, flightCp1y, flightCp2y, goalTargetY);
    ballRot = flightEase * 520;
    const press = flightEase < 0.08 ? Math.sin((flightEase / 0.08) * Math.PI) : 0;
    ballSqX = 1 - 0.26 * press;
    ballSqY = 1 + 0.28 * press;
  } else if (afterGoal) {
    const impactDur = msToFrames(130);
    const dropStart = goalHitFrame + impactDur;
    const dropDur = msToFrames(620);
    const impactT = interpolate(frame, [goalHitFrame, dropStart], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const dropT = interpolate(frame, [dropStart, dropStart + dropDur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const dropEase = easeOut(dropT);

    if (frame < dropStart) {
      ballX = goalTargetX;
      ballY = goalTargetY;
      const squash = Math.sin(impactT * Math.PI);
      ballSqX = 1 + 0.38 * squash;
      ballSqY = 1 - 0.34 * squash;
    } else {
      ballX = goalTargetX + (ballRestX - goalTargetX) * dropEase;
      ballY = goalTargetY + (ballRestY - goalTargetY) * dropEase;
      if (dropT > 0.82) {
        const gb = (dropT - 0.82) / 0.18;
        ballY -= Math.sin(gb * Math.PI) * 10;
      }
      ballSqX = 1;
      ballSqY = 1;
    }
    ballRot = 520 + dropT * 180;
  }

  const goalImpactFlash =
    afterGoal && frame < goalHitFrame + msToFrames(280)
      ? Math.sin(
          interpolate(frame, [goalHitFrame, goalHitFrame + msToFrames(280)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) * Math.PI
        )
      : 0;

  const netHitT =
    frame >= goalHitFrame
      ? interpolate(frame, [goalHitFrame, goalHitFrame + msToFrames(900)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const netPulse = Math.sin(Math.min(1, netHitT * 1.6) * Math.PI);
  const gw = goalRight - goalLeft;
  const gh = goalBottom - goalTop;

  const netStretch = (px: number, py: number) => {
    const dx = px - goalTargetX;
    const dy = py - goalTargetY;
    const falloff = Math.exp(-(dx * dx) / (gw * gw * 0.14) - (dy * dy) / (gh * gh * 0.22));
    const bulge = netPulse * falloff;
    return {
      sx: bulge * 34,
      sy: bulge * 22,
      sag: bulge * 16,
    };
  };

  const netLines = () => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = goalLeft + (i / 8) * gw;
      const midY = (goalTop + goalBottom) / 2;
      const stretch = netStretch(x, midY);
      lines.push(
        <line
          key={`nv${i}`}
          x1={x + stretch.sx}
          y1={goalTop - stretch.sy * 0.15}
          x2={x + stretch.sx * 1.15}
          y2={goalBottom + stretch.sag * 0.2}
          stroke={text}
          strokeWidth={1}
          opacity={0.25}
        />
      );
    }
    for (let i = 0; i <= 5; i++) {
      const y = goalTop + (i / 5) * gh;
      const midX = (goalLeft + goalRight) / 2;
      const stretch = netStretch(midX, y);
      lines.push(
        <line
          key={`nh${i}`}
          x1={goalLeft - stretch.sx * 0.1}
          y1={y + stretch.sag}
          x2={goalRight + stretch.sx * 0.35}
          y2={y + stretch.sag * 0.75}
          stroke={text}
          strokeWidth={1}
          opacity={0.25}
        />
      );
    }
    return lines;
  };

  const wallPlayers = () =>
    wallDefs.map((def, i) => (
      <g key={`w${i}`} opacity={wallOpacity(i)} transform={`translate(0, ${wallSlide(i)})`}>
        <PlayerStickman
          x={W * def.xf}
          groundY={groundY}
          faceDir={-1}
          kickLeg={0}
          plantBend={0.14 + (i % 3) * 0.03}
          torsoBias={0}
          tSec={tSec + i * 0.22}
          thighLen={miniThighLen}
          shinLen={miniShinLen}
          torsoLen={miniTorsoLen}
          headR={miniHeadR}
          headLen={miniHeadLen}
          stroke={text}
          sw={sw * 0.75}
          variant={def.variant}
        />
      </g>
    ));

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: font, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {moodImageUrl && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: imageOpacity * 0.22,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: p ? 420 : 560,
              height: p ? 420 : 560,
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Img
              src={moodImageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imageObjectPosition ?? "50% 50%",
                transform: `scale(${imageZoom ?? 1})`,
                transformOrigin: "center center",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.85) 100%)",
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <g opacity={pitchFade}>
            <GrassGround W={W} H={H} groundY={groundY} accent={accent} />
            <line x1={goalLeft} y1={goalTop} x2={goalLeft} y2={goalBottom} stroke={text} strokeWidth={3} />
            <line x1={goalRight} y1={goalTop} x2={goalRight} y2={goalBottom} stroke={text} strokeWidth={3} />
            <line x1={goalLeft} y1={goalTop} x2={goalRight} y2={goalTop} stroke={text} strokeWidth={3} />
            {netLines()}
          </g>

          {afterGoal && goalImpactFlash > 0 && (
            <g opacity={goalImpactFlash}>
              <circle cx={goalTargetX} cy={goalTargetY} r={14 + goalImpactFlash * 34} fill="none" stroke={accent} strokeWidth={3} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
                const rad = (ang * Math.PI) / 180;
                const len = 10 + goalImpactFlash * 28;
                return (
                  <line
                    key={ang}
                    x1={goalTargetX}
                    y1={goalTargetY}
                    x2={goalTargetX + Math.cos(rad) * len}
                    y2={goalTargetY + Math.sin(rad) * len}
                    stroke={accent}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          <g opacity={gkOpacity} transform={`translate(${gkX - goalCenterX}, 0) rotate(${gkRot}, ${gkX}, ${groundY})`}>
            <PlayerStickman
              x={goalCenterX}
              groundY={groundY}
              faceDir={-1}
              kickLeg={gkKickLeg}
              plantBend={gkPlantBend}
              torsoBias={gkTorso}
              armPose="gkReach"
              armPoseAmt={gkDiveT * 0.85}
              tSec={tSec}
              thighLen={gkThighLen}
              shinLen={gkShinLen}
              torsoLen={gkTorsoLen}
              headR={gkHeadR}
              headLen={gkHeadLen}
              stroke={text}
              sw={sw}
              variant={1}
            />
          </g>

          {wallPlayers()}

          <g opacity={takerOpacity} transform={`translate(0, ${takerJumpY})`}>
            <PlayerStickman
              x={takerX}
              groundY={groundY}
              faceDir={1}
              kickLeg={takerKickLeg}
              plantBend={takerPlantBend}
              torsoBias={takerTorso}
              armPose={takerArmPose}
              armPoseAmt={takerArmAmt}
              walk={takerWalk}
              tSec={tSec}
              thighLen={thighLen}
              shinLen={shinLen}
              torsoLen={torsoLen}
              headR={headR}
              headLen={headLen}
              stroke={text}
              sw={sw}
              variant={0}
            />
          </g>

          <g opacity={takerOpacity}>
            <Football x={ballX} y={ballY} r={ballR} rot={ballRot} sqX={ballSqX} sqY={ballSqY} accent={accent} />
          </g>
        </svg>
      </AbsoluteFill>

      {/* Kicker name/number badge — floats above the taker's head */}
      {(kickerName || kickerNumber) && badgeOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: takerX,
            top: badgeY,
            transform: "translate(-50%, -100%)",
            opacity: badgeOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            pointerEvents: "none",
            fontFamily: font,
          }}
        >
          {kickerName && (
            <div
              style={{
                background: accent,
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: p ? 30 : 26,
                lineHeight: 1,
                padding: p ? "10px 18px" : "9px 16px",
                borderRadius: 10,
                border: `3px solid ${text}`,
                boxShadow: "3px 4px 0 rgba(0,0,0,0.18)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                whiteSpace: "nowrap",
              }}
            >
              {kickerName}
            </div>
          )}
          {kickerNumber && (
            <div
              style={{
                color: text,
                fontWeight: 700,
                fontSize: p ? 26 : 22,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {kickerNumber}
            </div>
          )}
        </div>
      )}

      {goalPopOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: goalCenterX,
            top: goalPopBottomY,
            transform: `translate(-50%, -100%) scale(${goalStampScale})`,
            transformOrigin: "50% 100%",
            opacity: goalPopOpacity,
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: p ? titlePx * 1.1 : titlePx * 1.05,
              fontWeight: 900,
              color: accent,
              WebkitTextStroke: `3px ${text}`,
              paintOrder: "stroke fill",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1,
              textShadow: `4px 4px 0 rgba(0,0,0,0.08)`,
            }}
          >
            {goalLabel}
          </div>
          {scoreline && (
            <div
              style={{
                marginTop: 10,
                fontFamily: font,
                fontSize: descPx * 0.9,
                fontWeight: 700,
                color: text,
                opacity: scoreOpacity,
              }}
            >
              {scoreline}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: (groundY + H) / 2,
          left: "50%",
          width: fieldTextMaxW,
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: fieldTextGap,
          pointerEvents: "none",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        <div style={{ opacity: titleWipe, width: "100%" }}>
          <div
            style={{
              fontSize: titlePx,
              fontFamily: font,
              fontWeight: 900,
              color: text,
              lineHeight: 1.1,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {title}
          </div>
          <div
            style={{
              height: 4,
              width: "60%",
              margin: "8px auto 0",
              background: accent,
              transformOrigin: "center",
              transform: `scaleX(${titleWipe})`,
              borderRadius: 2,
            }}
          />
        </div>
        {narration && (
          <div
            style={{
              opacity: narrationOpacity,
              fontSize: descPx,
              fontFamily: font,
              color: text,
              lineHeight: 1.42,
              fontWeight: 600,
              wordBreak: "break-word",
              overflowWrap: "break-word",
              width: "100%",
            }}
          >
            {narration}
          </div>
        )}
      </div>
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
