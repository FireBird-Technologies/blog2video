import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const NeonCountdown: React.FC<SceneLayoutProps> = (props) => {
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

  const startFrom = Math.min(9, Math.max(2, Math.round((props as any).startFrom ?? 5)));
  const label = (props as any).label ?? "";

  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  // Transitions
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  // Typography
  const titlePx = titleFontSize ?? (p ? 100 : 88);
  const descPx = descriptionFontSize ?? (p ? 66 : 40);

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // Ring parameters
  const ringR = p ? 180 : 220;
  const ringCX = W / 2;
  const ringCY = p ? H * 0.42 : H * 0.48;
  const circumference = 2 * Math.PI * ringR;

  // Countdown logic
  // Total countdown frames: startFrom seconds
  const totalCountdownFrames = startFrom * fps;
  // Current elapsed time in seconds (clamped)
  const elapsedFrames = Math.min(frame, totalCountdownFrames);
  const elapsedSeconds = elapsedFrames / fps;

  // Current integer second boundary
  const currentSecond = Math.floor(elapsedSeconds);
  const fractionalSecond = elapsedSeconds - currentSecond;

  // Current displayed number
  const displayNumber = Math.max(0, startFrom - currentSecond);

  // Ring dashoffset: depletes clockwise
  // At t=0: full ring (dashoffset=0), at t=startFrom: empty (dashoffset=circumference)
  // Each second, animate from current to next over 0.9s linear, then snap
  const secondProgress = Math.min(fractionalSecond / 0.9, 1.0);
  const totalProgress = (currentSecond + secondProgress) / startFrom;
  const dashOffset = totalProgress * circumference;

  // Tick detection: within first 0.25s of each new second
  const isTicking = fractionalSecond < 0.25 && currentSecond > 0;
  const tickProgress = fractionalSecond / 0.25;

  // Number flicker on tick
  let numberOpacity = 1;
  if (isTicking) {
    // opacity 1→0.1→1→0.2→1 over 0.25s
    const t = tickProgress;
    if (t < 0.2) {
      numberOpacity = interpolate(t, [0, 0.2], [1, 0.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    } else if (t < 0.4) {
      numberOpacity = interpolate(t, [0.2, 0.4], [0.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    } else if (t < 0.6) {
      numberOpacity = interpolate(t, [0.4, 0.6], [1, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    } else {
      numberOpacity = interpolate(t, [0.6, 1.0], [0.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
  }

  // Number scale: 1.2→1.0 over 0.2s after tick
  let numberScale = 1;
  if (isTicking && tickProgress < 0.8) {
    numberScale = interpolate(tickProgress, [0, 0.8], [1.2, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  // Glow pulse for ring
  const glowPulse = 0.7 + 0.3 * Math.sin((frame / fps) * (2 * Math.PI / 2.0));

  // Starfield
  const starCount = 150;
  const stars = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < starCount; i++) {
      const seed = i * 137.508;
      const x = ((Math.sin(seed) * 0.5 + 0.5) * W);
      const y = ((Math.cos(seed * 1.3) * 0.5 + 0.5) * H);
      const r = 1 + (Math.sin(seed * 2.1) * 0.5 + 0.5);
      const period = 2 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 3;
      const phase = (Math.sin(seed * 5.3) * 0.5 + 0.5) * Math.PI * 2;
      const baseOpacity = 0.4 + (Math.sin(seed * 7.1) * 0.5 + 0.5) * 0.5;
      arr.push({ x, y, r, period, phase, baseOpacity });
    }
    return arr;
  }, [W, H]);

  // Fireflies
  const fireflyCount = 8;
  const fireflies = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < fireflyCount; i++) {
      const seed = i * 234.567 + 99;
      const startX = ((Math.sin(seed) * 0.5 + 0.5) * W);
      const startY = H * 0.65 + ((Math.cos(seed * 1.7) * 0.5 + 0.5) * H * 0.3);
      const cp1x = ((Math.sin(seed * 2.3) * 0.5 + 0.5) * W);
      const cp1y = H * 0.6 + ((Math.cos(seed * 3.1) * 0.5 + 0.5) * H * 0.35);
      const cp2x = ((Math.sin(seed * 4.1) * 0.5 + 0.5) * W);
      const cp2y = H * 0.65 + ((Math.cos(seed * 5.3) * 0.5 + 0.5) * H * 0.3);
      const endX = ((Math.sin(seed * 6.7) * 0.5 + 0.5) * W);
      const endY = H * 0.65 + ((Math.cos(seed * 7.9) * 0.5 + 0.5) * H * 0.3);
      const period = 180 + i * 30;
      const phase = (i / fireflyCount) * period;
      arr.push({ startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY, period, phase });
    }
    return arr;
  }, [W, H]);

  // Firefly spark bursts on tick
  const sparkCount = 14;
  const sparks = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2;
      const distance = 40 + Math.sin(i * 137.5) * 40;
      const delay = (Math.sin(i * 234.5) * 0.5 + 0.5) * 0.05;
      arr.push({ angle, distance, delay });
    }
    return arr;
  }, []);

  // Label fade in
  const labelOpacity = interpolate(frame, [Math.round(0.3 * fps), Math.round(0.3 * fps) + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accent = accentColor ?? "#FFFFFF";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#FFFFFF";
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  // SVG filter IDs
  const chalkFilterId = "chalk-displacement";
  const ringGlowId = "ring-glow";

  return (
    <AbsoluteFill
      style={{
        background: bg,
        fontFamily: ff,
        opacity: masterOpacity,
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
          <filter id={chalkFilterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="4"
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

          {/* Ring glow filter */}
          <filter id={ringGlowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Radial vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor={`rgba(0,0,0,0.55)`} />
          </radialGradient>
        </defs>

        {/* Starfield */}
        {stars.map((star, i) => {
          const twinkle =
            star.baseOpacity +
            (1 - star.baseOpacity) *
              0.5 *
              (1 + Math.sin((frame / fps) * (2 * Math.PI / star.period) + star.phase));
          return (
            <circle
              key={`star-${i}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="white"
              opacity={twinkle}
            />
          );
        })}

        {/* Vignette overlay */}
        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />

        {/* Crescent moon top-right */}
        <g
          transform={p ? `translate(${W - 120}, 80)` : `translate(${W - 140}, 60)`}
          filter={`url(#${chalkFilterId})`}
          opacity={0.85}
        >
          {/* Crescent: two overlapping circles */}
          <circle cx={0} cy={0} r={38} fill="none" stroke={text} strokeWidth={2.5} opacity={0.9} />
          <circle cx={14} cy={-4} r={34} fill={bg} />
          {/* Glow */}
          <circle
            cx={0}
            cy={0}
            r={38}
            fill="none"
            stroke={text}
            strokeWidth={1}
            opacity={0.3}
            style={{ filter: `drop-shadow(0 0 8px ${text})` }}
          />
        </g>

        {/* Fireflies */}
        {fireflies.map((ff_item, i) => {
          const t = ((frame + ff_item.phase) % ff_item.period) / ff_item.period;
          const mt = 1 - t;
          const x =
            mt * mt * mt * ff_item.startX +
            3 * mt * mt * t * ff_item.cp1x +
            3 * mt * t * t * ff_item.cp2x +
            t * t * t * ff_item.endX;
          const y =
            mt * mt * mt * ff_item.startY +
            3 * mt * mt * t * ff_item.cp1y +
            3 * mt * t * t * ff_item.cp2y +
            t * t * t * ff_item.endY;
          const ffOpacity = 0.5 + 0.3 * Math.sin(frame / fps * 2 * Math.PI / 2.5 + i);
          return (
            <circle
              key={`firefly-${i}`}
              cx={x}
              cy={y}
              r={4}
              fill={accent}
              opacity={ffOpacity}
              style={{ filter: `blur(6px)` }}
            />
          );
        })}

        {/* Ring glow (outer soft) */}
        <circle
          cx={ringCX}
          cy={ringCY}
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={14}
          opacity={0.18 * glowPulse}
          style={{ filter: `blur(12px)` }}
        />

        {/* Ring background track */}
        <circle
          cx={ringCX}
          cy={ringCY}
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          opacity={0.15}
          strokeDasharray={circumference}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90, ${ringCX}, ${ringCY})`}
        />

        {/* Main ring arc */}
        <circle
          cx={ringCX}
          cy={ringCY}
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${ringCX}, ${ringCY})`}
          filter={`url(#${chalkFilterId})`}
          style={{
            filter: `drop-shadow(0 0 18px ${accent})`,
            opacity: glowPulse,
          }}
        />

        {/* Firefly sparks on tick */}
        {isTicking &&
          sparks.map((spark, i) => {
            const adjustedT = Math.max(0, tickProgress - spark.delay) / (1 - spark.delay);
            if (adjustedT <= 0) return null;
            const clampedT = Math.min(adjustedT, 1);
            // Ease out
            const eased = 1 - Math.pow(1 - clampedT, 2);
            const sparkOpacity = interpolate(clampedT, [0, 1], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const sparkX = ringCX + Math.cos(spark.angle) * (ringR + eased * spark.distance);
            const sparkY = ringCY + Math.sin(spark.angle) * (ringR + eased * spark.distance);
            return (
              <circle
                key={`spark-${i}`}
                cx={sparkX}
                cy={sparkY}
                r={3}
                fill={accent}
                opacity={sparkOpacity}
                style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
              />
            );
          })}

        {/* Countdown number — scaled about the ring centre via an SVG
            transform (reliable user-space units) so every digit, including
            the final 0, stays centred. */}
        <g transform={`translate(${ringCX} ${ringCY}) scale(${numberScale}) translate(${-ringCX} ${-ringCY})`}>
          <text
            x={ringCX}
            y={ringCY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={200}
            fontFamily={ff}
            fontWeight="bold"
            fill={accent}
            opacity={numberOpacity}
            style={{
              filter: `drop-shadow(0 0 12px ${accent}) drop-shadow(0 0 24px ${accent})`,
            }}
          >
            {displayNumber}
          </text>
        </g>

      </svg>

      {/* Title text at top — HTML so long text wraps instead of overflowing */}
      {title ? (
        <div style={{
          position: "absolute",
          top: p ? 60 : 40,
          left: p ? 60 : 120,
          right: p ? 60 : 120,
          textAlign: "center",
          color: accent,
          fontSize: titlePx,
          fontFamily: ff,
          fontWeight: "bold",
          lineHeight: 1.2,
          opacity: enter,
          whiteSpace: "normal",
          wordBreak: "break-word",
          textShadow: `0 0 12px ${accent}`,
          zIndex: 2,
        }}>{title}</div>
      ) : null}

      {/* Label below ring — HTML for wrapping */}
      {label ? (
        <div style={{
          position: "absolute",
          top: (ringCY + ringR + (p ? 60 : 50)) * (height / H),
          left: p ? 60 : 120,
          right: p ? 60 : 120,
          textAlign: "center",
          color: text,
          fontSize: descriptionFontSize ?? (p ? 66 : 40),
          fontFamily: ff,
          lineHeight: 1.3,
          opacity: labelOpacity,
          whiteSpace: "normal",
          wordBreak: "break-word",
          textShadow: "0 0 6px rgba(255,255,255,0.4)",
          zIndex: 2,
        }}>{label}</div>
      ) : null}

      {/* Narration below label — HTML for wrapping */}
      {narration ? (
        <div style={{
          position: "absolute",
          top: (ringCY + ringR + (p ? 140 : 110)) * (height / H),
          left: p ? 60 : 120,
          right: p ? 60 : 120,
          textAlign: "center",
          color: accent,
          fontSize: descPx,
          fontFamily: ff,
          lineHeight: 1.4,
          opacity: labelOpacity,
          whiteSpace: "normal",
          wordBreak: "break-word",
          textShadow: `0 0 12px ${accent}`,
          zIndex: 2,
        }}>{narration}</div>
      ) : null}
    </AbsoluteFill>
  );
};
