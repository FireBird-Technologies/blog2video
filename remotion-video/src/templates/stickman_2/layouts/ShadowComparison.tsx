import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

/** Deterministic RNG — Remotion renders each frame in isolation, so Math.random()
 *  would produce different particle positions every frame (looks like hyper-fast motion). */
const seededRandom = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const ShadowComparison: React.FC<SceneLayoutProps> = (props) => {
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
  } = props;
  const p = aspectRatio === "portrait";

  const leftThought = (props as any).leftThought ?? "Option A";
  const rightThought = (props as any).rightThought ?? "Option B";

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  const descPx = descriptionFontSize ?? (p ? 57 : 35);

  // Transitions
  const enter = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const masterOpacity = enter * exit;

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // Figure sizing — larger footballers anchored to a ground line.
  const figScale = p ? 2.4 : 2.2;
  const groundY = p ? 1320 : 780;
  const figY = groundY - 50 * figScale; // hip, so feet (local y155) land on the ground
  const leftFigX = p ? 220 : 470;
  const rightFigX = p ? 860 : 1450;

  // Ground line draw-on: starts at t=0.2s
  const groundStart = Math.round(0.2 * fps);
  const groundEnd = Math.round(0.7 * fps);
  const groundProgress = interpolate(frame, [groundStart, groundEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const groundMargin = p ? 80 : 200;
  const groundLength = W - groundMargin * 2;
  const groundOffset = groundLength * (1 - groundProgress);

  // Shadow draw-on: starts at t=0.4s
  const shadowStart = Math.round(0.4 * fps);
  const shadowEnd = Math.round(1.0 * fps);
  const shadowProgress = interpolate(frame, [shadowStart, shadowEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Thought cloud draw-on
  const cloudStart = Math.round(0.6 * fps);
  const cloudEnd = Math.round(1.1 * fps);
  const cloudProgress = interpolate(frame, [cloudStart, cloudEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Alternating glow: left glows first, at t=2s swap
  const glowSwapStart = Math.round(2.0 * fps);
  const glowSwapEnd = Math.round(2.4 * fps);
  const leftGlowVal = interpolate(frame, [glowSwapStart, glowSwapEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightGlowVal = interpolate(frame, [glowSwapStart, glowSwapEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulse sine for glow
  const pulseSine = Math.sin((frame / fps) * (2 * Math.PI) / 2.0) * 0.15 + 0.85;

  const leftOpacity = leftGlowVal * pulseSine + (1 - leftGlowVal) * 0.45;
  const rightOpacity = rightGlowVal * pulseSine + (1 - rightGlowVal) * 0.45;

  const leftGlowStrength = leftGlowVal * 20;
  const rightGlowStrength = rightGlowVal * 20;

  // ── Soccer ball physics ────────────────────────────────────────────────────
  const ballR = p ? 22 : 18;
  const ballLeftX  = leftFigX  + 22 * figScale * 0.5;
  const ballRightX = rightFigX - 22 * figScale * 0.5;
  const cycleSec = 2.8;
  const timeSec2 = frame / fps; // alias to avoid name clash with timeSec below
  const cycPhase = (timeSec2 % cycleSec) / cycleSec;

  const goingRight = cycPhase < 0.5;
  const ballT  = goingRight ? cycPhase / 0.5 : (cycPhase - 0.5) / 0.5; // 0..1 within current half
  const fromX  = goingRight ? ballLeftX  : ballRightX;
  const toX    = goingRight ? ballRightX : ballLeftX;

  // Horizontal: constant velocity (realistic — no ease)
  const ballX = fromX + (toX - fromX) * ballT;

  // Vertical: two parabolic arcs joined at a single bounce
  const arcH1 = p ? 270 : 215;      // peak height of the kicked arc
  const bounceAt   = 0.64;           // where ball lands (fraction of ballT)
  const restitution = 0.55;          // height after bounce relative to first arc peak

  let ballHeight: number;
  if (ballT < bounceAt) {
    ballHeight = Math.sin((ballT / bounceAt) * Math.PI) * arcH1;
  } else {
    const t2 = (ballT - bounceAt) / (1 - bounceAt);
    ballHeight = Math.sin(t2 * Math.PI) * arcH1 * restitution;
  }

  // Squish the ball on ground contact at the bounce point
  const bounceProx  = Math.max(0, 1 - Math.abs(ballT - bounceAt) / 0.035);
  const ballSqX = 1 + 0.45 * bounceProx;
  const ballSqY = 1 - 0.55 * bounceProx;

  const ballY = groundY - ballR - ballHeight;

  // Spin: fast at kick, exponentially decays — realistic angular momentum loss
  const V0spin  = 680; // initial spin deg/s
  const kSpin   = 2.0; // decay rate 1/s
  const halfDur = cycleSec / 2;
  const tInHalf = ballT * halfDur;
  const spinDir = goingRight ? 1 : -1;
  const rotThisHalf = (V0spin / kSpin) * (1 - Math.exp(-kSpin * tInHalf)) * spinDir;
  // Add completed half-cycle contributions (they alternate, net of pairs = rotPerHalf)
  const rotPerHalf = (V0spin / kSpin) * (1 - Math.exp(-kSpin * halfDur));
  const completedHalves = Math.floor(timeSec2 / halfDur);
  const prevRot = completedHalves % 2 === 1 ? rotPerHalf : 0;
  const ballRot = prevRot + rotThisHalf;

  // ── Kick state machine ─────────────────────────────────────────────────────
  // Returns kickLeg (-0.4=wind-up back, 0=rest, 1.0=full follow-through),
  // plantBend (0..1), and torsoBias (extra lean deg) for a player whose
  // kick moment is at cycPhase == kickCenter.
  const getKickState = (kickCenter: number) => {
    let rel = ((cycPhase - kickCenter) % 1 + 1) % 1;
    if (rel > 0.5) rel -= 1; // -0.5 to 0.5 centered on kick contact

    let kickLeg = 0, plantBend = 0, torsoBias = 0;

    if (rel < -0.10) {
      // Idle jog while ball is incoming
      const jogT = (rel + 0.5) / 0.40;
      kickLeg = Math.sin(jogT * Math.PI * 2) * 0.13;
    } else if (rel < 0) {
      // Wind-up: leg pulls BACK
      const wt = (rel + 0.10) / 0.10;
      kickLeg   = -0.38 * wt;
      plantBend = 0.18 * wt;
      torsoBias = 6 * wt;
    } else if (rel < 0.04) {
      // Strike: explosive whip forward (covers ~120° in 0.04 cycle = ~0.11 s)
      const st = rel / 0.04;
      kickLeg   = -0.38 + 1.38 * st; // -0.38 → 1.0
      plantBend = 0.38;
      torsoBias = 6 * (1 - st);
    } else if (rel < 0.19) {
      // Follow-through: leg decelerates high in the air
      const ft = (rel - 0.04) / 0.15;
      kickLeg   = 1.0 - ft * 0.48; // 1.0 → 0.52
      plantBend = 0.28 * (1 - ft);
    } else if (rel < 0.46) {
      // Recovery: leg swings back to idle
      const rt = (rel - 0.19) / 0.27;
      kickLeg = 0.52 * (1 - rt);
    } else {
      // Late idle
      const lt = (rel - 0.46) / 0.04;
      kickLeg = Math.sin(lt * Math.PI) * 0.13;
    }

    return { kickLeg, plantBend, torsoBias };
  };

  const leftKickState  = getKickState(0.0);
  const rightKickState = getKickState(0.5);

  // Starfield — seeded positions so they stay fixed across per-frame renders
  const stars = React.useMemo(() => {
    const rand = seededRandom(42);
    const arr = [];
    const count = 150;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rand() * W,
        y: rand() * H,
        r: 1 + rand() * 1.2,
        phase: rand() * Math.PI * 2,
        period: 2 + rand() * 3,
        baseOpacity: 0.4 + rand() * 0.5,
      });
    }
    return arr;
  }, [W, H]);

  // Fireflies — seeded paths; motion driven by time (frame / fps), not raw frame index
  const fireflies = React.useMemo(() => {
    const rand = seededRandom(99);
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push({
        baseX: 100 + rand() * (W - 200),
        baseY: H * 0.65 + rand() * (H * 0.3),
        driftX: 40 + rand() * 80,
        driftY: 20 + rand() * 40,
        period: 6 + rand() * 6,
        phase: rand(),
        r: 3 + rand() * 2,
      });
    }
    return arr;
  }, [W, H]);

  const timeSec = frame / fps;

  // Chalk displacement filter id
  const filterId = "chalk-displace";
  const starFilterId = "star-glow";

  // Moon position
  const moonX = p ? W - 120 : W - 160;
  const moonY = p ? 120 : 90;

  // ── Thought cloud sizing — width grows with the text, text tracks the
  // narration font size. ────────────────────────────────────────────────────
  const cloudFontPx = descPx;
  // Width stays roughly fixed (grows only slightly, tightly capped); longer
  // text wraps onto more lines so the cloud grows in HEIGHT instead.
  const cloudHalfW = (text: string) =>
    Math.min(p ? 195 : 215, (p ? 150 : 170) + text.length * cloudFontPx * 0.03);
  const cloudHalfH = (text: string, w: number) => {
    const charW = cloudFontPx * 0.55;
    const lineChars = Math.max(4, Math.floor((2 * w - 50) / charW));
    const lines = Math.max(1, Math.ceil(text.length / lineChars));
    return Math.max(p ? 70 : 60, lines * cloudFontPx * 0.7 + 26);
  };
  const lW = cloudHalfW(leftThought);
  const lH = cloudHalfH(leftThought, lW);
  const rW = cloudHalfW(rightThought);
  const rH = cloudHalfH(rightThought, rW);
  const lPerimeter = (lW + lH) * 6;
  const rPerimeter = (rW + rH) * 6;

  // Cloud vertical centre — sits a little lower than before, and is pushed down
  // further if needed so the cloud's top never overlaps the title. The cloud
  // path rises to ~1.3·halfH above the centre, so we clamp against the title bottom.
  const titleFs = titleFontSize ?? (p ? 115 : 85);
  const titleBottom = (p ? 60 : 40) + titleFs * 1.25;
  const maxCloudH = Math.max(lH, rH);
  const cloudCY = Math.max(
    p ? 840 : 360,
    titleBottom + (p ? 60 : 48) + maxCloudH * 1.3,
  );

  // Footballer with authentic kick phases: wind-up → explosive strike → follow-through → recovery
  const Footballer: React.FC<{
    isRight: boolean;
    figX: number;
    figY: number;
    scale: number;
    kickState: { kickLeg: number; plantBend: number; torsoBias: number };
  }> = ({ isRight, figX, figY, scale, kickState }) => {
    const stroke = textColor ?? "#FFFFFF";
    const tSec = frame / fps;
    const breath = Math.sin(tSec * 1.3) * 1.2;
    const dir = isRight ? -1 : 1;

    const { kickLeg, plantBend, torsoBias } = kickState;

    const hipX = 50;
    const hipY = 105;

    // Torso: leans back during explosive strike, twists slightly
    const kickFwd = Math.max(0, kickLeg);
    const torsoLean = -dir * (torsoBias + kickFwd * 6) + Math.sin(tSec * 0.6) * 2;
    const torsoRad = (torsoLean * Math.PI) / 180;
    const shoulderX = hipX + Math.sin(torsoRad) * 45;
    const shoulderY = hipY - Math.cos(torsoRad) * 45 + breath;
    const headX = shoulderX + Math.sin(torsoRad) * 18;
    const headY = shoulderY - Math.cos(torsoRad) * 18;

    // Arms counter-rotate for balance: front arm swings forward as kicking leg goes forward
    const armSwing = kickFwd * 32 + Math.sin(tSec * 1.5) * 4;
    const frontHandX = shoulderX + dir * (18 + armSwing * 0.5);
    const frontHandY = shoulderY + 22 - armSwing * 0.65;
    const backHandX  = shoulderX - dir * (20 + armSwing * 0.45);
    const backHandY  = shoulderY + 26 + armSwing * 0.3;
    const frontElbowX = (shoulderX + frontHandX) / 2 + dir * 9;
    const frontElbowY = (shoulderY + frontHandY) / 2 + 6;
    const backElbowX  = (shoulderX + backHandX)  / 2 - dir * 9;
    const backElbowY  = (shoulderY + backHandY)  / 2 + 8;

    const footY = 155;

    // Plant leg bends at the knee during the kick to absorb force
    const plantFootX  = hipX - dir * 18;
    const plantKneeX  = (hipX + plantFootX) / 2 - dir * 3 + dir * plantBend * 9;
    const plantKneeY  = (hipY + footY) / 2 + 4 + plantBend * 12;
    const plantFootY  = footY - plantBend * 5;

    // Kicking leg: wind-up (back), explosive strike forward, high follow-through
    const restFootX = hipX + dir * 18;
    const backFootX = hipX - dir * 30; // wind-up: foot pulled behind body
    const backFootY = footY - 10;
    const extFootX  = hipX + dir * 65; // follow-through: foot high and far forward
    const extFootY  = footY - 62;

    let kickFootX: number, kickFootY: number;
    if (kickLeg >= 0) {
      // 0 = rest hanging, 1 = fully extended forward/up
      kickFootX = restFootX + (extFootX - restFootX) * kickLeg;
      kickFootY = footY      + (extFootY - footY)    * kickLeg;
    } else {
      // wind-up: leg swings back
      const wt = Math.abs(kickLeg) / 0.38;
      kickFootX = restFootX + (backFootX - restFootX) * wt;
      kickFootY = footY      + (backFootY - footY)    * wt;
    }
    // Knee tracks the foot: rises and moves forward as foot extends
    const kickKneeX = (hipX + kickFootX) / 2 + dir * 8 * kickFwd;
    const kickKneeY = (hipY + kickFootY) / 2 - kickFwd * 10;

    return (
      <g transform={`translate(${figX}, ${figY})`} filter={`url(#${filterId})`}>
        <g
          transform={`scale(${scale}) translate(-50, -105)`}
          stroke={stroke}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={headX} cy={headY} r={14} strokeWidth={4} />
          <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} strokeWidth={4.5} />
          <path d={`M ${shoulderX} ${shoulderY} Q ${backElbowX}  ${backElbowY}  ${backHandX}  ${backHandY}`} />
          <path d={`M ${shoulderX} ${shoulderY} Q ${frontElbowX} ${frontElbowY} ${frontHandX} ${frontHandY}`} />
          {/* Plant leg */}
          <polyline points={`${hipX},${hipY} ${plantKneeX},${plantKneeY} ${plantFootX},${plantFootY}`} strokeWidth={4.5} />
          {/* Kicking leg */}
          <polyline points={`${hipX},${hipY} ${kickKneeX},${kickKneeY} ${kickFootX},${kickFootY}`} strokeWidth={4.5} />
        </g>
      </g>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: bgColor ?? "#000000",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        opacity: masterOpacity,
        overflow: "hidden",
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          {/* Chalk displacement filter */}
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.065"
              numOctaves="3"
              seed="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="2.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/* Star glow filter */}
          <filter id={starFilterId}>
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Shadow gradient */}
          <radialGradient id="footShadowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          {/* Vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
          {/* Left cloud glow filter */}
          <filter id="leftCloudGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={leftGlowStrength} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Right cloud glow filter */}
          <filter id="rightCloudGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={rightGlowStrength} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Firefly glow */}
          <filter id="fireflyGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Starfield */}
        {stars.map((s, i) => {
          const twinkle =
            s.baseOpacity +
            Math.sin(timeSec * (2 * Math.PI) / s.period + s.phase) * 0.25;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="white"
              opacity={Math.max(0, Math.min(1, twinkle))}
              filter={`url(#${starFilterId})`}
            />
          );
        })}

        {/* Vignette overlay */}
        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />

        {/* Crescent moon */}
        <g transform={`translate(${moonX}, ${moonY})`}>
          <circle cx={0} cy={0} r={28} fill="none" stroke="#FFFFFF" strokeWidth={2} filter={`url(#${filterId})`} />
          <circle cx={10} cy={-4} r={24} fill={bgColor ?? "#000000"} />
        </g>

        {/* Ground line where the figures play */}
        <line
          x1={groundMargin}
          y1={groundY}
          x2={W - groundMargin}
          y2={groundY}
          stroke={accentColor ?? "#FFFFFF"}
          strokeWidth={3}
          opacity={0.5}
          strokeLinecap="round"
          strokeDasharray={groundLength}
          strokeDashoffset={groundOffset}
          filter={`url(#${filterId})`}
        />

        {/* Foot shadows on the ground */}
        <g
          style={{
            transformOrigin: `${leftFigX}px ${groundY}px`,
            transform: `scaleX(${shadowProgress})`,
          }}
        >
          <ellipse cx={leftFigX} cy={groundY + 8} rx={90} ry={14} fill="url(#footShadowGrad)" opacity={0.7} />
        </g>
        <g
          style={{
            transformOrigin: `${rightFigX}px ${groundY}px`,
            transform: `scaleX(${shadowProgress})`,
          }}
        >
          <ellipse cx={rightFigX} cy={groundY + 8} rx={90} ry={14} fill="url(#footShadowGrad)" opacity={0.7} />
        </g>
        {/* Ball shadow */}
        <ellipse
          cx={ballX}
          cy={groundY + 6}
          rx={ballR * (1.3 - 0.5 * (ballHeight / arcH1))}
          ry={7}
          fill="url(#footShadowGrad)"
          opacity={0.45 * shadowProgress}
        />

        {/* Footballers */}
        <Footballer isRight={false} figX={leftFigX}  figY={figY} scale={figScale} kickState={leftKickState} />
        <Footballer isRight         figX={rightFigX} figY={figY} scale={figScale} kickState={rightKickState} />

        {/* Soccer ball */}
        <g transform={`translate(${ballX}, ${ballY}) rotate(${ballRot}) scale(${ballSqX}, ${ballSqY})`} filter={`url(#${filterId})`}>
          <circle r={ballR} fill={bgColor ?? "#000000"} stroke={accentColor ?? "#FFFFFF"} strokeWidth={3} />
          <polygon
            points={Array.from({ length: 5 }, (_, i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              return `${(Math.cos(a) * ballR * 0.45).toFixed(1)},${(Math.sin(a) * ballR * 0.45).toFixed(1)}`;
            }).join(" ")}
            fill={accentColor ?? "#FFFFFF"}
            opacity={0.85}
          />
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={i}
                x1={Math.cos(a) * ballR * 0.45}
                y1={Math.sin(a) * ballR * 0.45}
                x2={Math.cos(a) * ballR * 0.9}
                y2={Math.sin(a) * ballR * 0.9}
                stroke={accentColor ?? "#FFFFFF"}
                strokeWidth={2}
              />
            );
          })}
        </g>

        {/* Left thought cloud */}
        <g
          opacity={leftOpacity}
          filter={`url(#leftCloudGlow)`}
          style={{ transition: "opacity 0.4s ease-in-out" }}
        >
          <CloudShape
            cx={leftFigX}
            cy={cloudCY}
            w={lW}
            h={lH}
            strokeColor={accentColor ?? "#FFFFFF"}
            fillColor="rgba(0,0,0,0)"
            dashOffset={lPerimeter * (1 - cloudProgress)}
            perimeter={lPerimeter}
            filterId={filterId}
          />
        </g>

        {/* Right thought cloud */}
        <g
          opacity={rightOpacity}
          filter={`url(#rightCloudGlow)`}
          style={{ transition: "opacity 0.4s ease-in-out" }}
        >
          <CloudShape
            cx={rightFigX}
            cy={cloudCY}
            w={rW}
            h={rH}
            strokeColor={accentColor ?? "#FFFFFF"}
            fillColor="rgba(0,0,0,0)"
            dashOffset={rPerimeter * (1 - cloudProgress)}
            perimeter={rPerimeter}
            filterId={filterId}
          />
        </g>

        {/* Fireflies */}
        {fireflies.map((ff, i) => {
          const drift = timeSec / ff.period + ff.phase;
          const ffx = ff.baseX + Math.sin(drift * Math.PI * 2) * ff.driftX;
          const ffy = ff.baseY + Math.cos(drift * Math.PI * 2 * 0.7) * ff.driftY;
          const ffOpacity = 0.5 + Math.sin(drift * Math.PI * 2) * 0.2;
          return (
            <circle
              key={i}
              cx={ffx}
              cy={ffy}
              r={ff.r}
              fill={accentColor ?? "#FFFFFF"}
              opacity={ffOpacity}
              filter="url(#fireflyGlow)"
            />
          );
        })}
      </svg>

      {/* Left thought cloud text */}
      <div
        style={{
          position: "absolute",
          left: leftFigX - (lW - 14),
          top: cloudCY - (lH - 10),
          width: 2 * lW - 28,
          height: 2 * lH - 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: cloudProgress * leftOpacity,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            color: textColor ?? "#FFFFFF",
            fontSize: cloudFontPx,
            textAlign: "center",
            lineHeight: 1.2,
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
            fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
          }}
        >
          {leftThought}
        </span>
      </div>

      {/* Right thought cloud text */}
      <div
        style={{
          position: "absolute",
          left: rightFigX - (rW - 14),
          top: cloudCY - (rH - 10),
          width: 2 * rW - 28,
          height: 2 * rH - 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: cloudProgress * rightOpacity,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            color: textColor ?? "#FFFFFF",
            fontSize: cloudFontPx,
            textAlign: "center",
            lineHeight: 1.2,
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
            fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
          }}
        >
          {rightThought}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: p ? 60 : 40,
          left: 0,
          width: W,
          textAlign: "center",
          color: accentColor ?? "#FFFFFF",
          fontSize: titleFontSize ?? (p ? 115 : 85),
          fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
          filter: "drop-shadow(0 0 12px rgba(255,255,255,0.7))",
          opacity: enter,
          letterSpacing: "0.02em",
          padding: "0 40px",
          boxSizing: "border-box",
        }}
      >
        {title}
      </div>

      {/* Narration */}
      {narration && (
        <div
          style={{
            position: "absolute",
            bottom: p ? 80 : 40,
            left: 0,
            width: W,
            textAlign: "center",
            color: textColor ?? "#FFFFFF",
            fontSize: descPx,
            fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
            opacity: enter * exit,
            padding: "0 80px",
            boxSizing: "border-box",
            lineHeight: 1.4,
          }}
        >
          {narration}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Cloud shape component — width/height driven by the text it must hold.
interface CloudShapeProps {
  cx: number;
  cy: number;
  w: number;
  h: number;
  strokeColor: string;
  fillColor: string;
  dashOffset: number;
  perimeter: number;
  filterId: string;
}

const CloudShape: React.FC<CloudShapeProps> = ({
  cx,
  cy,
  w,
  h,
  strokeColor,
  fillColor,
  dashOffset,
  perimeter,
  filterId,
}) => {
  // Cloud blob centred at (cx, cy), parametric on half-width w and half-height h.
  const path = `
    M ${cx - w} ${cy + h * 0.4}
    Q ${cx - w * 1.15} ${cy - h * 0.2} ${cx - w * 0.7} ${cy - h * 0.45}
    Q ${cx - w * 0.78} ${cy - h * 1.05} ${cx - w * 0.25} ${cy - h * 0.9}
    Q ${cx} ${cy - h * 1.3} ${cx + w * 0.3} ${cy - h * 0.9}
    Q ${cx + w * 0.72} ${cy - h * 1.15} ${cx + w * 0.85} ${cy - h * 0.5}
    Q ${cx + w * 1.2} ${cy - h * 0.4} ${cx + w} ${cy + h * 0.2}
    Q ${cx + w * 1.1} ${cy + h * 0.75} ${cx + w * 0.55} ${cy + h * 0.45}
    Q ${cx + w * 0.25} ${cy + h * 0.85} ${cx - w * 0.1} ${cy + h * 0.5}
    Q ${cx - w * 0.5} ${cy + h * 0.9} ${cx - w} ${cy + h * 0.4}
    Z
  `;

  return (
    <path
      d={path}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={perimeter}
      strokeDashoffset={dashOffset}
      filter={`url(#${filterId})`}
    />
  );
};
