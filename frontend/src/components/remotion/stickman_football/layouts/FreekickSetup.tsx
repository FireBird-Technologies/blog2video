import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { Football, GrassGround, PlayerStickman } from "../shared";

const cubicBezier = (t: number, a: number, b: number, c: number, d: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export const FreekickSetup: React.FC<SceneLayoutProps> = (props) => {
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
  const shotLabel = (props as any).shotLabel ?? "Top corner";
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

  const takerOpacity = interpolate(frame, [msToFrames(150), msToFrames(350)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkOpacity = interpolate(frame, [msToFrames(300), msToFrames(650)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wallStart = msToFrames(250);
  const wallOpacity = (i: number) =>
    interpolate(
      frame,
      [wallStart + msToFrames(80 * i), wallStart + msToFrames(80 * i) + msToFrames(380)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  const wallSlide = (i: number) =>
    interpolate(
      frame,
      [wallStart + msToFrames(80 * i), wallStart + msToFrames(80 * i) + msToFrames(380)],
      [30, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const titleStart = msToFrames(400);
  const titleWipe = interpolate(frame, [titleStart, titleStart + msToFrames(480)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationStart = msToFrames(550);
  const narrationOpacity = interpolate(frame, [narrationStart, narrationStart + msToFrames(350)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  const runStart = msToFrames(850);
  const kickWindupStart = msToFrames(2100);
  const kickStart = msToFrames(2280);
  const kickDur = msToFrames(820);
  const hitFrame = kickStart + kickDur;
  const savePopDur = msToFrames(140);
  const missReactStart = hitFrame + msToFrames(200);

  const kickT = interpolate(frame, [kickStart, hitFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const savePopT = interpolate(frame, [hitFrame, hitFrame + savePopDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelOpacity = interpolate(frame, [hitFrame, hitFrame + msToFrames(420)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const despairT = interpolate(frame, [missReactStart, missReactStart + msToFrames(500)], [0, 1], {
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
  const WALL_FIG = FIG * 0.72;
  const GK_FIG = FIG * 0.76;
  const torsoLen = 52 * FIG;
  const headR = 20 * FIG;
  const headLen = 20 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;
  const sw = 5.5;
  const ballR = p ? 26 : 22;

  const wallTorsoLen = 52 * WALL_FIG;
  const wallHeadR = 20 * WALL_FIG;
  const wallHeadLen = 20 * WALL_FIG;
  const wallThighLen = 30 * WALL_FIG;
  const wallShinLen = 30 * WALL_FIG;

  const gkTorsoLen = 52 * GK_FIG;
  const gkHeadR = 20 * GK_FIG;
  const gkHeadLen = 20 * GK_FIG;
  const gkThighLen = 30 * GK_FIG;
  const gkShinLen = 30 * GK_FIG;

  const groundY = H * (p ? 0.78 : 0.76);
  const goalBottom = groundY;
  const goalHeight = H * (p ? 0.12 : 0.17);
  const goalTop = goalBottom - goalHeight;
  const goalLeft = W * (p ? 0.62 : 0.68);
  const goalRight = W * (p ? 0.86 : 0.92);
  const goalCenterX = (goalLeft + goalRight) / 2;
  const goalTargetX = goalLeft + (goalRight - goalLeft) * 0.72;
  const goalTargetY = goalTop + goalHeight * 0.28;

  // Ball contact point = GK glove height at full dive (matches gkReach hand centre)
  const gkDiveAtSave = p ? 30 : 34;
  const gkHandOffsetX = -54;
  const gkHandOffsetY = -(gkThighLen + gkShinLen + gkTorsoLen * 0.72 + 44);
  const catchX = goalCenterX + gkDiveAtSave + gkHandOffsetX;
  const catchY = groundY + gkHandOffsetY;

  // Kicker far left; ball + wall grouped toward centre-right
  const takerRunStartX = W * (p ? 0.03 : 0.08);
  const takerKickX = W * (p ? 0.22 : 0.30);
  const ballKickX = takerKickX + (p ? 62 : 72);
  const ballKickY = groundY - ballR;
  const wallBaseX = W * (p ? 0.48 : 0.52);
  const wallSpacing = W * (p ? 0.055 : 0.029);

  const flightCp1x = ballKickX + (catchX - ballKickX) * 0.42;
  const flightCp1y = ballKickY - H * (p ? 0.22 : 0.26);
  const flightCp2x = catchX - (p ? 40 : 48);
  const flightCp2y = catchY - H * 0.03;

  const descPx = descriptionFontSize ?? (p ? 48 : 40);
  const labelPx = Math.max(18, descPx - 6);
  const labelText = `→ ${shotLabel}`;
  const labelPadX = labelPx * 0.62;
  const labelPadY = labelPx * 0.4;
  const labelCharW = labelPx * 0.54;
  const labelLineH = labelPx * 1.35;
  const labelMaxW = goalRight - goalLeft;
  const labelMaxChars = Math.max(10, Math.floor((labelMaxW - labelPadX * 2) / labelCharW));
  const labelLines = wrapLabelLines(labelText, labelMaxChars);
  const longestLineLen = Math.max(...labelLines.map((line) => line.length), 1);
  const labelCardW = Math.min(
    labelMaxW,
    Math.max(labelPx * 4.5, longestLineLen * labelCharW + labelPadX * 2)
  );
  const labelX = goalCenterX;
  const labelBottomY = goalTop - H * (p ? 0.055 : 0.075);

  const titlePx = titleFontSize ?? (p ? 90 : 75);
  const textColTop = p ? H * 0.044 : H * 0.062;
  const textColMaxW = p ? W * 0.88 : W * 0.62;
  const textColGap = Math.max(descPx * 0.5, titlePx * 0.14);

  const ballBounce = interpolate(
    frame % msToFrames(700),
    [0, msToFrames(350), msToFrames(700)],
    [0, -6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Taker run-up ──
  const runT = interpolate(frame, [runStart, kickWindupStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const runEase = easeOut(runT);
  const takerX = frame < runStart
    ? takerRunStartX
    : interpolate(runEase, [0, 1], [takerRunStartX, takerKickX]);
  // Articulated walk-up gait (whiteboard-style: thigh swing + backward knee bend),
  // driven via PlayerStickman's `walk` prop. Active only during the approach, and
  // eased out near the end so the taker plants cleanly before the wind-up.
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
  let takerArmPose: "default" | "despair" = "default";
  let takerArmAmt = 0;
  let takerKneel = 0;

  if (frame >= kickWindupStart && frame < kickStart) {
    takerKickLeg = runStride * (1 - windupT) - 0.15 - windupT * 0.25;
    takerPlantBend = 0.2 + windupT * 0.16;
    takerTorso = 8 + windupT * 5;
  } else if (frame >= kickStart && frame < missReactStart) {
    takerKickLeg = -0.4 + strikeT * 1.45;
    takerPlantBend = 0.36 * (1 - strikeT * 0.55);
    takerTorso = 13 * (1 - strikeT * 0.75);
  } else if (frame >= missReactStart) {
    const despairEase = easeOut(despairT);
    takerKickLeg = 0;
    takerPlantBend = 0.1;
    takerTorso = -4 * despairEase;
    takerArmPose = "despair";
    takerArmAmt = despairEase;
    takerKneel = easeOut(
      interpolate(frame, [missReactStart + msToFrames(180), missReactStart + msToFrames(680)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
  }

  // ── Kicker name/number badge: tracks the taker, sits above the head ──
  // Head-top in SVG/CSS pixel space (viewBox is 1:1 with the frame). Tracks the head as
  // the taker kneels in despair so it always stays above him, and remains visible for the
  // whole scene (only fades with the taker's own opacity).
  const headTopY = groundY - (thighLen + shinLen) - torsoLen - headLen - headR + takerKneel * (thighLen + shinLen) * 0.5;
  const badgeY = headTopY - (p ? 60 : 50);
  const badgeOpacity = takerOpacity;

  // ── Ball: flight → GK deflect → bounce back → ground ──
  const inFlight = frame >= kickStart && frame < hitFrame;
  const afterDeflect = frame >= hitFrame;
  const flightEase = easeOut(kickT);

  const deflectDur = msToFrames(620);
  const deflectT = interpolate(frame, [hitFrame, hitFrame + deflectDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const landX = catchX - (p ? 95 : 115);
  const landY = groundY - ballR;

  const gkDiveT = interpolate(frame, [kickStart + kickDur * 0.42, hitFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkDiveTargetX = catchX + (p ? 42 : 48);
  const gkDiveX = interpolate(gkDiveT, [0, 1], [goalCenterX, gkDiveTargetX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let ballX = ballKickX;
  let ballY = ballKickY + (frame < kickWindupStart ? ballBounce : 0);
  let ballRot = 0;
  let ballSqX = 1;
  let ballSqY = 1;

  if (inFlight) {
    ballX = cubicBezier(flightEase, ballKickX, flightCp1x, flightCp2x, catchX);
    ballY = cubicBezier(flightEase, ballKickY, flightCp1y, flightCp2y, catchY);
    ballRot = flightEase * 480;
  } else if (afterDeflect) {
    const pop = Math.sin(savePopT * Math.PI);
    if (deflectT < 0.32) {
      const u = deflectT / 0.32;
      ballX = catchX - u * 52;
      ballY = catchY - u * 32 + pop * 4;
    } else {
      const f = (deflectT - 0.32) / 0.68;
      const drop = easeOut(f);
      ballX = catchX - 52 + drop * (landX - (catchX - 52));
      ballY = interpolate(drop, [0, 1], [catchY - 32, landY]);
      if (f > 0.82) {
        const gb = (f - 0.82) / 0.18;
        ballY -= Math.sin(gb * Math.PI) * 14;
      }
    }
    ballRot = 480 + deflectT * 260;
    ballSqX = 1 + pop * 0.24;
    ballSqY = 1 - pop * 0.2;
  }

  const saveFlash = afterDeflect && savePopT < 1 ? Math.sin(savePopT * Math.PI) * 0.5 : 0;

  // ── Goalkeeper: dive toward ball → lie flat on the ground line ──
  const gkLieT = interpolate(frame, [hitFrame + msToFrames(80), hitFrame + msToFrames(520)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkReachRelease = interpolate(frame, [hitFrame, hitFrame + msToFrames(200)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gkLieEase = easeOut(gkLieT);
  const gkX = gkDiveX + gkLieEase * (p ? 30 : 36);
  const gkRot = gkDiveT * 14 + gkLieEase * 86;
  const gkTorso = gkDiveT * 14 * (1 - gkLieEase * 0.9);
  const gkPlantBend = 0.14 + gkDiveT * 0.26 * (1 - gkLieEase);
  const gkKickLeg = gkDiveT * 0.3 * (1 - gkLieEase * 0.5);
  const gkArmIdle = frame < kickStart + kickDur * 0.42 ? 1 : 0;
  const gkArmPose: "default" | "gkReach" = gkDiveT > 0.05 && gkReachRelease > 0.05 ? "gkReach" : "default";
  const gkArmAmt = gkArmPose === "gkReach" ? gkDiveT * gkReachRelease : 0;

  const netLines = () => {
    const lines: React.ReactNode[] = [];
    const gw = goalRight - goalLeft;
    const gh = goalBottom - goalTop;
    for (let i = 0; i <= 8; i++) {
      const x = goalLeft + (i / 8) * gw;
      lines.push(
        <line key={`nv${i}`} x1={x} y1={goalTop} x2={x} y2={goalBottom} stroke={text} strokeWidth={1} opacity={0.25} />
      );
    }
    for (let i = 0; i <= 5; i++) {
      const y = goalTop + (i / 5) * gh;
      lines.push(
        <line key={`nh${i}`} x1={goalLeft} y1={y} x2={goalRight} y2={y} stroke={text} strokeWidth={1} opacity={0.25} />
      );
    }
    return lines;
  };

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: font, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Optional mood image as circular vignette (same as kickoff_title) */}
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
              style={(() => {
                // Match the adjust-modal preview / shared ZoomCropImg: anchor the zoom
                // at the focus point, fall back to contain+centre when zoomed out.
                const pos = imageObjectPosition ?? "50% 50%";
                const z = imageZoom ?? 1;
                const out = z < 1;
                return {
                  width: "100%",
                  height: "100%",
                  objectFit: out ? "contain" : "cover",
                  objectPosition: out ? "center" : pos,
                  transform: `scale(${z})`,
                  transformOrigin: out ? "center center" : pos,
                };
              })()}
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

          {/* Save pop at gloves */}
          {afterDeflect && savePopT < 1 && (
            <g opacity={saveFlash}>
              <circle cx={catchX} cy={catchY} r={10 + savePopT * 28} fill="none" stroke={accent} strokeWidth={2.5} />
              {[0, 60, 120, 180, 240, 300].map((ang) => {
                const rad = (ang * Math.PI) / 180;
                const len = 8 + savePopT * 22;
                return (
                  <line
                    key={ang}
                    x1={catchX}
                    y1={catchY}
                    x2={catchX + Math.cos(rad) * len}
                    y2={catchY + Math.sin(rad) * len}
                    stroke={accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          {/* Goalkeeper — dive toward ball, lie flat on ground line */}
          <g opacity={gkOpacity} transform={`translate(${gkX - goalCenterX}, 0) rotate(${gkRot}, ${gkX}, ${groundY})`}>
            <PlayerStickman
              x={goalCenterX}
              groundY={groundY}
              faceDir={-1}
              kickLeg={gkKickLeg}
              plantBend={gkPlantBend}
              torsoBias={gkTorso}
              armPose={gkArmPose}
              armPoseAmt={gkArmAmt}
              armIdle={gkArmIdle}
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

          {/* Defensive wall */}
          {[0, 1, 2].map((i) => (
            <g key={`wall${i}`} opacity={wallOpacity(i)} transform={`translate(0, ${wallSlide(i)})`}>
              <PlayerStickman
                x={wallBaseX + i * wallSpacing}
                groundY={groundY}
                faceDir={-1}
                kickLeg={0}
                plantBend={0.18}
                torsoBias={0}
                tSec={tSec + i * 0.3}
                thighLen={wallThighLen}
                shinLen={wallShinLen}
                torsoLen={wallTorsoLen}
                headR={wallHeadR}
                headLen={wallHeadLen}
                stroke={text}
                sw={sw * 0.9}
                variant={i}
              />
            </g>
          ))}

          {/* Free-kick taker */}
          <g opacity={takerOpacity}>
            <PlayerStickman
              x={takerX}
              groundY={groundY}
              faceDir={1}
              kickLeg={takerKickLeg}
              plantBend={takerPlantBend}
              torsoBias={takerTorso}
              armPose={takerArmPose}
              armPoseAmt={takerArmAmt}
              kneelAmt={takerKneel}
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

          {/* Ball */}
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

      {labelOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: labelX,
            top: labelBottomY,
            width: labelCardW,
            opacity: labelOpacity,
            transform: "translate(-50%, -100%) rotate(-1.5deg)",
            transformOrigin: "50% 100%",
            pointerEvents: "none",
            boxSizing: "border-box",
            borderRadius: 10,
            background: "#C8A26A",
            border: "3px solid #8A6A3B",
            boxShadow: "inset 0 0 0 1px rgba(138,106,59,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            padding: `${labelPadY}px ${labelPadX}px`,
            fontFamily: font,
          }}
        >
          <div
            style={{
              width: "100%",
              fontSize: labelPx,
              fontWeight: 700,
              color: "#2B1C0B",
              lineHeight: labelLineH / labelPx,
              textAlign: "center",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {labelLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: textColTop,
          left: p ? W * 0.052 : W * 0.038,
          maxWidth: textColMaxW,
          display: "flex",
          flexDirection: "column",
          gap: textColGap,
          pointerEvents: "none",
        }}
      >
        <div style={{ transform: `translateX(${interpolate(titleWipe, [0, 1], [-40, 0])}px)`, opacity: titleWipe }}>
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
              background: accent,
              transformOrigin: "left",
              transform: `scaleX(${titleWipe})`,
              marginTop: 8,
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
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

function wrapLabelLines(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
