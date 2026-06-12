import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const LanternDialogue: React.FC<SceneLayoutProps> = (props) => {
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
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  // Custom props
  const leftBubble = (props as any).leftBubble ?? "Hello there!";
  const rightBubble = (props as any).rightBubble ?? "Good evening!";
  const speakers: { label: string }[] = (props as any).speakers ?? [];
  const leftSpeaker = speakers[0]?.label ?? "";
  const rightSpeaker = speakers[1]?.label ?? "";

  // Transitions
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const masterOpacity = enter * exit;

  // Dialogue timing
  const halfDur = dur / 2;

  // Left kite draw-on
  const leftBubbleProgress = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Right kite draw-on (both kites appear together at the start)
  const rightBubbleProgress = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Lantern glow transition
  const leftLanternOpacity = interpolate(
    frame,
    [halfDur - fps * 0.4, halfDur],
    [1.0, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const rightLanternOpacity = interpolate(
    frame,
    [halfDur, halfDur + fps * 0.4],
    [0.3, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const leftLanternRadius = interpolate(
    frame,
    [halfDur - fps * 0.4, halfDur],
    [80, 40],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const rightLanternRadius = interpolate(
    frame,
    [halfDur, halfDur + fps * 0.4],
    [40, 80],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Speaker label fade-in
  const speakerFade = interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Idle breathing for figures
  const breathScale = 1 + 0.02 * Math.sin((frame / fps) * (2 * Math.PI / 3));

  // Starfield
  const starCount = 150;
  const stars = React.useMemo(() => {
    const arr = [];
    const rng = (seed: number) => {
      let x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < starCount; i++) {
      arr.push({
        x: rng(i * 3.1) * 1920,
        y: rng(i * 7.3) * 1080,
        r: 1 + rng(i * 2.7) * 1,
        baseOpacity: 0.4 + rng(i * 5.1) * 0.5,
        period: 2 + rng(i * 4.3) * 3,
        phase: rng(i * 6.7) * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  // Fireflies
  const fireflies = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      const rng = (s: number) => {
        let x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      };
      arr.push({
        startX: rng(i * 11.3) * 1920,
        startY: 700 + rng(i * 7.9) * 380,
        cp1x: rng(i * 3.7) * 1920,
        cp1y: 700 + rng(i * 5.1) * 380,
        cp2x: rng(i * 9.1) * 1920,
        cp2y: 700 + rng(i * 2.3) * 380,
        endX: rng(i * 6.5) * 1920,
        endY: 700 + rng(i * 8.7) * 380,
        period: 4 + rng(i * 4.1) * 4,
        phase: rng(i * 1.9) * Math.PI * 2,
        r: 3 + rng(i * 3.3) * 2,
      });
    }
    return arr;
  }, []);

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // Bigger stick figures
  const figScale = p ? 1.5 : 2.0;

  // Shared stick-figure pose (frame-driven) — computed once so the figure and
  // its kite string share the exact same gesturing-hand position.
  const tt = frame * 0.05;
  const breath = Math.sin(tt * 1.2) * 1.5;
  const weightShift = Math.sin(tt * 0.8) * 4;
  const swayPose = Math.sin((frame / fps) * (2 * Math.PI / 2)) * 4;
  const hipX = 50 + weightShift;
  const hipY = 105;
  const torsoAngle = -3 + Math.cos(tt * 0.7) * 4;
  const torsoRad = (torsoAngle * Math.PI) / 180;
  const shoulderX = hipX + Math.sin(torsoRad) * 45;
  const shoulderY = hipY - Math.cos(torsoRad) * 45 + breath;
  // Gesturing hand raised up-and-out, holding the kite string.
  const handLocalX = shoulderX + 24 + swayPose;
  const handLocalY = shoulderY - 26 + swayPose * 0.3;

  // Figure / kite / lantern layout. Landscape keeps the two figures side by
  // side; portrait stacks them vertically (top + bottom).
  const leftFig = p
    ? { x: 380, y: 830, flip: false }
    : { x: 280, y: 870, flip: false };
  const rightFig = p
    ? { x: 700, y: 1515, flip: true }
    : { x: 1640, y: 870, flip: true };
  const leftKite = p ? { x: 700, y: 570 } : { x: 480, y: 420 };
  const rightKite = p ? { x: 380, y: 1255 } : { x: 1440, y: 420 };
  const leftLantern = p
    ? { x: leftFig.x - 110, y: leftFig.y + 50 }
    : { x: leftFig.x - 130, y: leftFig.y + 80 };
  const rightLantern = p
    ? { x: rightFig.x + 110, y: rightFig.y + 50 }
    : { x: rightFig.x + 130, y: rightFig.y + 80 };

  const kiteSize = p ? 130 : 150;

  // World position of a figure's gesturing hand (the string passes through it).
  const handWorld = (f: { x: number; y: number; flip: boolean }) => {
    const fs = f.flip ? -1 : 1;
    return {
      x: f.x + fs * breathScale * (figScale * (handLocalX - 50)),
      y: f.y + breathScale * (figScale * (handLocalY - 105)),
    };
  };
  const leftGrip = handWorld(leftFig);
  const rightGrip = handWorld(rightFig);

  // The string runs from the kite, through the figure's hand, down to the
  // lantern beside it (the hexagonal polygon) which hangs as a bunch on the line.
  const leftAnchor = { x: leftLantern.x, y: leftLantern.y - (p ? 24 : 32) };
  const rightAnchor = { x: rightLantern.x, y: rightLantern.y - (p ? 24 : 32) };

  // Chalk displacement filter id
  const filterId = "chalk-displace";
  const glowFilterId = "chalk-glow";

  // Hexagonal lantern path helper
  const hexPath = (cx: number, cy: number, r: number) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return `M ${pts.join(" L ")} Z`;
  };

  // Stick figure — whiteboard figure with the gesturing hand raised to fly its
  // kite; `flip` mirrors it for the right/bottom figure.
  const StickFigure: React.FC<{
    cx: number;
    cy: number;
    flip?: boolean;
    breathe?: number;
  }> = ({ cx, cy, flip = false, breathe = 1 }) => {
    const flipScale = flip ? -1 : 1;
    const S = figScale;
    const stroke = textColor ?? "#FFFFFF";
    const jitter = Math.sin(frame * 0.4) * 0.5;
    const headTiltA = Math.sin(tt * 1.5) * 5;
    const headRad = ((torsoAngle + headTiltA) * Math.PI) / 180;
    const headX = shoulderX + Math.sin(headRad) * 18;
    const headY = shoulderY - Math.cos(headRad) * 18 + jitter;
    // Raised gesturing hand (holds the kite string).
    const targetHandX = handLocalX;
    const targetHandY = handLocalY;
    const elbowX = (shoulderX + targetHandX) / 2 + 8;
    const elbowY = (shoulderY + targetHandY) / 2 - 6;
    const restHandX = shoulderX - 22 + Math.sin(tt) * 5;
    const restHandY = shoulderY + 30 + Math.cos(tt) * 5;
    const restElbowX = (shoulderX + restHandX) / 2 - 10;
    const restElbowY = (shoulderY + restHandY) / 2 + 10;
    const footLX = 35;
    const footRX = 65;
    const footY = 155;
    return (
      <g transform={`translate(${cx}, ${cy}) scale(${flipScale * breathe}, ${breathe})`}>
        <g transform={`scale(${S}) translate(-50, -105)`} filter={`url(#${filterId})`} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={headX} cy={headY} r={15} stroke={stroke} strokeWidth={4.5} fill="none" />
          <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} stroke={stroke} strokeWidth={5} />
          <path d={`M ${shoulderX} ${shoulderY} Q ${elbowX} ${elbowY} ${targetHandX} ${targetHandY}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          <path d={`M ${shoulderX} ${shoulderY} Q ${restElbowX} ${restElbowY} ${restHandX} ${restHandY}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          <line x1={hipX} y1={hipY} x2={footLX} y2={footY} stroke={stroke} strokeWidth={5} />
          <line x1={hipX} y1={hipY} x2={footRX} y2={footY} stroke={stroke} strokeWidth={5} />
          <circle cx={targetHandX} cy={targetHandY} r={2.5} fill={stroke} />
        </g>
      </g>
    );
  };

  // Lantern SVG
  const Lantern: React.FC<{
    cx: number;
    cy: number;
    glowRadius: number;
    glowOpacity: number;
    glowId: string;
  }> = ({ cx, cy, glowRadius, glowOpacity, glowId }) => {
    const hexR = p ? 14 : 18;
    return (
      <g>
        {/* Glow */}
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor="rgba(255,240,180,0.5)"
            stopOpacity={glowOpacity}
          />
          <stop
            offset="40%"
            stopColor="rgba(255,255,255,0.3)"
            stopOpacity={glowOpacity * 0.6}
          />
          <stop offset="100%" stopColor="transparent" stopOpacity={0} />
        </radialGradient>
        <circle
          cx={cx}
          cy={cy}
          r={glowRadius}
          fill={`url(#${glowId})`}
          style={{ transition: "r 0.4s ease-in-out, opacity 0.4s ease-in-out" }}
        />
        {/* Lantern body */}
        <path
          d={hexPath(cx, cy, hexR)}
          stroke={textColor}
          strokeWidth={2.5}
          fill="rgba(255,240,180,0.15)"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        />
        {/* Lantern top cap */}
        <line
          x1={cx - hexR * 0.5}
          y1={cy - hexR}
          x2={cx + hexR * 0.5}
          y2={cy - hexR}
          stroke={textColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Lantern handle */}
        <line
          x1={cx}
          y1={cy - hexR}
          x2={cx}
          y2={cy - hexR - (p ? 10 : 14)}
          stroke={textColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    );
  };

  // Kite flown by a stick figure: a loose string runs from the kite down
  // through the figure's hand and on to the lantern anchor, and the figure's
  // thought is written above the kite (the kite stays a fixed size — text
  // never sits inside it).
  const Kite: React.FC<{
    base: { x: number; y: number };
    grip: { x: number; y: number };
    anchor: { x: number; y: number };
    text: string;
    progress: number;
    phase: number;
    tailDir: number;
  }> = ({ base, grip, anchor, text, progress, phase, tailDir }) => {
    const k = kiteSize;
    // Gentle flying bob so the kite drifts in the wind.
    const swayX = Math.sin((frame / fps) * (2 * Math.PI / 3.2) + phase) * 12;
    const swayY = Math.cos((frame / fps) * (2 * Math.PI / 2.6) + phase) * 9;
    const cx = base.x + swayX;
    const cy = base.y + swayY;

    const topY = cy - 0.55 * k;
    const botY = cy + 0.65 * k;
    const sideY = cy - 0.12 * k;
    const sideX = 0.42 * k;

    const diamond = `M ${cx} ${topY} L ${cx + sideX} ${sideY} L ${cx} ${botY} L ${cx - sideX} ${sideY} Z`;
    const perim =
      2 * (Math.hypot(sideX, 0.43 * k) + Math.hypot(sideX, 0.77 * k));

    // Loose flying string: kite tip → through the figure's hand → lantern,
    // each segment sagging below its straight line.
    const tipX = cx;
    const tipY = botY;
    const wob = Math.sin((frame / fps) * Math.PI + phase) * 8;
    // Segment 1: kite tip → hand (grip)
    const m1x = (tipX + grip.x) / 2;
    const m1y = (tipY + grip.y) / 2;
    const sag1 = 30 + Math.abs(grip.y - tipY) * 0.12;
    // Segment 2: hand → lantern anchor
    const m2x = (grip.x + anchor.x) / 2;
    const m2y = (grip.y + anchor.y) / 2;
    const sag2 = 18 + Math.abs(anchor.y - grip.y) * 0.18;
    const stringD =
      `M ${tipX} ${tipY} Q ${m1x + wob} ${m1y + sag1} ${grip.x} ${grip.y}` +
      ` Q ${m2x + wob} ${m2y + sag2} ${anchor.x} ${anchor.y}`;

    // Fluttering tail with little bows.
    const tailSeg = k * 0.28;
    let tailD = `M ${tipX} ${tipY}`;
    const bows: [number, number][] = [];
    for (let i = 1; i <= 4; i++) {
      const ty = tipY + i * tailSeg;
      const tx = tipX + tailDir * (Math.sin(i * 1.2 + frame * 0.09) * 12 + i * 6);
      const py = ty - tailSeg / 2;
      const px = tipX + tailDir * (i * 5);
      tailD += ` Q ${px} ${py} ${tx} ${ty}`;
      bows.push([tx, ty]);
    }

    // Thought text above the kite — fixed-width box that wraps and clamps to
    // 4 lines (overflow ends with "…"), bottom-anchored just above the kite.
    const fontSize = descriptionFontSize ?? (p ? 42 : 36);
    const lineHeight = 1.35;
    const tW = p ? 330 : 380;
    const tH = Math.ceil(4 * fontSize * lineHeight) + 8;
    const tX = cx - tW / 2;
    const tY = topY - 16 - tH;

    return (
      <g opacity={progress}>
        {/* Flying string */}
        <path
          d={stringD}
          stroke={textColor}
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 5"
          strokeLinecap="round"
          opacity={0.85 * progress}
          filter={`url(#${filterId})`}
        />
        {/* Tail */}
        <path
          d={tailD}
          stroke={accentColor}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={progress}
          filter={`url(#${filterId})`}
        />
        {bows.map(([bx, by], i) => (
          <path
            key={i}
            d={`M ${bx - 7} ${by - 5} L ${bx + 7} ${by + 5} M ${bx + 7} ${by - 5} L ${bx - 7} ${by + 5}`}
            stroke={accentColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={progress}
          />
        ))}
        {/* Kite body */}
        <path
          d={diamond}
          stroke={accentColor}
          strokeWidth={3}
          fill="rgba(255,240,180,0.10)"
          strokeLinejoin="round"
          strokeDasharray={perim}
          strokeDashoffset={(1 - progress) * perim}
          filter={`url(#${filterId})`}
          style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
        />
        {/* Spars */}
        <line x1={cx} y1={topY} x2={cx} y2={botY} stroke={accentColor} strokeWidth={1.8} opacity={0.7 * progress} />
        <line x1={cx - sideX} y1={sideY} x2={cx + sideX} y2={sideY} stroke={accentColor} strokeWidth={1.8} opacity={0.7 * progress} />
        {/* Thought text above the kite */}
        <foreignObject x={tX} y={tY} width={tW} height={tH}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              height: "100%",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 4,
                overflow: "hidden",
                width: "100%",
                textAlign: "center",
                wordBreak: "break-word",
                color: textColor,
                fontSize,
                fontFamily:
                  fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                lineHeight,
                filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
                opacity: progress,
              }}
            >
              {text}
            </div>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        opacity: masterOpacity,
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <Stickman2BackgroundImage
        imageUrl={imageUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
      />
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        <defs>
          {/* Chalk displacement filter */}
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="4"
              seed={42}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={3}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/* Glow filter for text */}
          <filter id={glowFilterId}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" stopOpacity={0} />
            <stop
              offset="100%"
              stopColor="rgba(0,0,0,0.55)"
              stopOpacity={0.55}
            />
          </radialGradient>
        </defs>

        {/* Starfield */}
        {stars.map((star, i) => {
          const twinkle =
            star.baseOpacity +
            0.2 *
              Math.sin(
                (frame / fps) * (2 * Math.PI / star.period) + star.phase
              );
          return (
            <circle
              key={i}
              cx={star.x * (W / 1920)}
              cy={star.y * (H / 1080)}
              r={star.r}
              fill="white"
              opacity={Math.max(0, Math.min(1, twinkle))}
            />
          );
        })}

        {/* Crescent moon top-right */}
        <g transform={`translate(${W - (p ? 120 : 160)}, ${p ? 120 : 80})`}>
          <circle
            cx={0}
            cy={0}
            r={p ? 36 : 48}
            fill="none"
            stroke={textColor}
            strokeWidth={2.5}
            filter={`url(#${glowFilterId})`}
            opacity={0.9}
          />
          <circle
            cx={p ? 18 : 24}
            cy={0}
            r={p ? 30 : 40}
            fill={bgColor}
          />
        </g>

        {/* Vignette overlay */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="url(#vignette)"
          opacity={0.7}
        />

        {/* Fireflies */}
        {fireflies.map((ff, i) => {
          const t =
            ((frame / fps / ff.period + ff.phase / (2 * Math.PI)) % 1 + 1) %
            1;
          // Cubic bezier interpolation
          const mt = 1 - t;
          const ffX =
            mt * mt * mt * ff.startX +
            3 * mt * mt * t * ff.cp1x +
            3 * mt * t * t * ff.cp2x +
            t * t * t * ff.endX;
          const ffY =
            mt * mt * mt * ff.startY +
            3 * mt * mt * t * ff.cp1y +
            3 * mt * t * t * ff.cp2y +
            t * t * t * ff.endY;
          const ffOpacity =
            0.5 + 0.3 * Math.sin((frame / fps) * (2 * Math.PI / 2) + ff.phase);
          return (
            <circle
              key={i}
              cx={ffX * (W / 1920)}
              cy={ffY * (H / 1080)}
              r={ff.r}
              fill={accentColor}
              opacity={ffOpacity}
              filter="url(#firefly-blur)"
            />
          );
        })}
        <filter id="firefly-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>

        {/* Left/top lantern */}
        <Lantern
          cx={leftLantern.x}
          cy={leftLantern.y}
          glowRadius={leftLanternRadius}
          glowOpacity={leftLanternOpacity}
          glowId="left-lantern-glow"
        />

        {/* Right/bottom lantern */}
        <Lantern
          cx={rightLantern.x}
          cy={rightLantern.y}
          glowRadius={rightLanternRadius}
          glowOpacity={rightLanternOpacity}
          glowId="right-lantern-glow"
        />

        {/* Left/top stick figure */}
        <StickFigure
          cx={leftFig.x}
          cy={leftFig.y}
          flip={leftFig.flip}
          breathe={breathScale}
        />

        {/* Right/bottom stick figure */}
        <StickFigure
          cx={rightFig.x}
          cy={rightFig.y}
          flip={rightFig.flip}
          breathe={breathScale}
        />

        {/* Kites (each figure flies its own, thought written above it) */}
        <Kite
          base={leftKite}
          grip={leftGrip}
          anchor={leftAnchor}
          text={leftBubble}
          progress={leftBubbleProgress}
          phase={0}
          tailDir={-1}
        />
        <Kite
          base={rightKite}
          grip={rightGrip}
          anchor={rightAnchor}
          text={rightBubble}
          progress={rightBubbleProgress}
          phase={1.7}
          tailDir={1}
        />

        {/* Speaker labels */}
        {leftSpeaker && (
          <text
            x={leftFig.x}
            y={leftFig.y + figScale * 50 + 36}
            textAnchor="middle"
            fill={accentColor}
            fontSize={p ? 26 : 22}
            fontFamily={fontFamily ?? "'Patrick Hand', system-ui, sans-serif"}
            opacity={speakerFade}
            filter={`url(#${glowFilterId})`}
          >
            {leftSpeaker}
          </text>
        )}
        {rightSpeaker && (
          <text
            x={rightFig.x}
            y={rightFig.y + figScale * 50 + 36}
            textAnchor="middle"
            fill={accentColor}
            fontSize={p ? 26 : 22}
            fontFamily={fontFamily ?? "'Patrick Hand', system-ui, sans-serif"}
            opacity={speakerFade}
            filter={`url(#${glowFilterId})`}
          >
            {rightSpeaker}
          </text>
        )}

      </svg>

      {/* Title */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: p ? "6%" : "6%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: titleFontSize ?? (p ? 82 : 73),
            fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
            color: accentColor,
            fontWeight: 700,
            letterSpacing: "0.02em",
            filter: `drop-shadow(0 0 12px ${accentColor}B3)`,
            opacity: enter * exit,
            transform: `translateY(${interpolate(frame, [0, 18], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
            padding: "0 60px",
          }}
        >
          {title}
        </div>
      )}

      {/* Narration */}
      {narration && (
        <div
          style={{
            position: "absolute",
            // Portrait: anchored near the bottom. Landscape: vertically centered
            // between the two corner figures.
            ...(p
              ? { bottom: "4%" }
              : { top: "50%", transform: "translateY(-50%)" }),
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: descriptionFontSize ?? (p ? 42 : 36),
            fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
            color: textColor,
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))",
            opacity: enter * exit,
            padding: p ? "0 80px" : "0 480px",
            lineHeight: 1.5,
          }}
        >
          {narration}
        </div>
      )}
    </AbsoluteFill>
  );
};
