import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const NightWalk: React.FC<SceneLayoutProps> = (props) => {
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

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit  = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  // ── Starfield ──────────────────────────────────────────────────────────────
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; phase: number; period: number; opacity: number }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(42);
    for (let i = 0; i < 150; i++) {
      arr.push({ x: rand() * 1920, y: rand() * 1080, r: 1 + rand() * 1, phase: rand() * Math.PI * 2, period: 2 + rand() * 3, opacity: 0.4 + rand() * 0.5 });
    }
    return arr;
  }, []);

  // ── Fireflies ──────────────────────────────────────────────────────────────
  const fireflies = useMemo(() => {
    const arr: { x: number; y: number; phase: number; r: number }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(99);
    for (let i = 0; i < 8; i++) {
      arr.push({ x: rand() * 1920, y: 750 + rand() * 280, phase: rand() * Math.PI * 2, r: 3 + rand() * 2 });
    }
    return arr;
  }, []);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  // All SVG coords are in a fixed 1920×1080 design space, scaled via viewBox.
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // Design-space constants (always relative to 1920×1080 design space)
  const figureY   = p ? 955 : 900;   // feet Y in design-space
  const groundY   = figureY;          // ground line sits exactly at feet — same design-space coord

  // ── Walking figure — eased speed, stops in-frame on the right ──────────────
  const figScale = p ? 2.36 : 1.95;
  const figRightExtent = 20 * figScale;
  // Portrait viewBox slice shows roughly x 656–1264 in design space
  const portraitVisibleX = { min: 656, max: 1264 };

  const figureStartX = p ? portraitVisibleX.min + 24 : -80;
  const figureEndX = p
    ? portraitVisibleX.max - figRightExtent - 24
    : 1920 - figRightExtent - 40;

  // Constant design-space speed (px/frame) — not tied to scene duration
  const walkSpeedPxPerFrame = p ? 1.05 * 1.5 : 1.05 * 2;
  const figureX = Math.min(figureStartX + walkSpeedPxPerFrame * frame, figureEndX);
  const isWalking = figureX < figureEndX - 0.5;

  // ── Streetlamps (design-space coords) ─────────────────────────────────────
  const lampPositions = p
    ? [{ x: 1480, y: 875 }]
    : [{ x: 420, y: 820 }, { x: 960, y: 820 }, { x: 1500, y: 820 }];

  const lampGlows = lampPositions.map((lamp) => {
    const t = interpolate(figureX, [lamp.x - 60, lamp.x + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return t > 0 ? Math.min(0.8, (t * 0.8) / 0.3) : 0;
  });

  // ── Text animation ─────────────────────────────────────────────────────────
  const titleProgress    = interpolate(frame, [8, 8 + 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(frame, [8 + 0.6 * fps, 8 + 1.0 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underlineProgress = interpolate(frame, [8 + 0.2 * fps, 8 + 0.55 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const filterId = "chalk-displace";
  const t = frame / fps;

  const fireflyPositions = fireflies.map((ff, i) => {
    const speed = 0.3 + i * 0.07;
    return { x: ff.x + Math.sin(t * speed + ff.phase) * 120, y: ff.y + Math.cos(t * speed * 0.7 + ff.phase) * 40, r: ff.r };
  });

  const underlineLen  = p ? 700 : 560;
  const underlineDash = underlineLen * (1 - underlineProgress);

  // Text column
  const textColX = p ? 60 : 80;
  const textColW = p ? W - 120 : 1000;

  return (
    <AbsoluteFill
      style={{
        background: bgColor ?? "#000000",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        opacity: masterOpacity,
        overflow: "hidden",
      }}
    >
      <Stickman2BackgroundImage
        imageUrl={imageUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
      />

      {/* ── SVG Defs ── */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
          {lampPositions.map((_, i) => (
            <radialGradient key={i} id={`lampGlow${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,240,180,0.55)" />
              <stop offset="100%" stopColor="rgba(255,240,180,0)" />
            </radialGradient>
          ))}
        </defs>
      </svg>

      {/* ── Main SVG — viewBox maps 1920×1080 design space to canvas ── */}
      <svg
        width={W}
        height={H}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        {/* Starfield */}
        {stars.map((s, i) => {
          const twinkle = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin((t / s.period) * Math.PI * 2 + s.phase));
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={twinkle * s.opacity} />;
        })}

        {/* Vignette */}
        <rect x={0} y={0} width={1920} height={1080} fill="url(#vignette)" />

        {/* Crescent moon — centered horizontally in portrait */}
        <g transform={`translate(${p ? 960 : 1670}, ${p ? 90 : 120}) scale(1.55) translate(-30, 0)`} filter={`url(#${filterId})`} opacity={0.95}>
          <path
            d="M 30 -28 A 34 34 0 1 0 30 28 A 29 29 0 1 1 30 -28 Z"
            fill={textColor ?? "#FFFFFF"}
            stroke={textColor ?? "#FFFFFF"}
            strokeWidth={1.2}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }}
          />
        </g>

        {/* Streetlamps */}
        {lampPositions.map((lamp, i) => {
          const glowOp = lampGlows[i];
          // Portrait pole: slightly wider strokeWidth to match landscape feel
          const postWidth = p ? 4 : 2.5;
          const armWidth  = p ? 3 : 2;
          const lanternSW = p ? 2.8 : 1.8;
          return (
            <g key={i} filter={`url(#${filterId})`}>
              {/* Glow */}
              <ellipse cx={lamp.x} cy={lamp.y - 95} rx={80} ry={80} fill={`url(#lampGlow${i})`} opacity={glowOp} />
              {/* Post */}
              <line x1={lamp.x} y1={lamp.y} x2={lamp.x} y2={lamp.y - 185} stroke={textColor ?? "#FFFFFF"} strokeWidth={postWidth} strokeLinecap="round" />
              {/* Arm */}
              <line x1={lamp.x} y1={lamp.y - 172} x2={lamp.x + 20} y2={lamp.y - 198} stroke={textColor ?? "#FFFFFF"} strokeWidth={armWidth} strokeLinecap="round" />
              {/* Lantern */}
              <rect
                x={lamp.x + 10} y={lamp.y - 218} width={22} height={18} rx={3}
                fill={glowOp > 0.1 ? "rgba(255,240,180,0.85)" : "none"}
                stroke={textColor ?? "#FFFFFF"} strokeWidth={lanternSW}
              />
            </g>
          );
        })}

        {/* Fireflies */}
        {fireflyPositions.map((ff, i) => (
          <circle
            key={i} cx={ff.x} cy={ff.y} r={ff.r}
            fill={accentColor ?? "#FFFFFF"}
            opacity={0.5 + 0.3 * Math.sin(t * 1.5 + i)}
            style={{ filter: `blur(6px) drop-shadow(0 0 6px ${accentColor ?? "#FFFFFF"})` }}
          />
        ))}

        {/* ── Ground line — full width, in design-space coords ── */}
        <line
          x1={0} y1={groundY}
          x2={1920} y2={groundY}
          stroke={textColor ?? "#FFFFFF"}
          strokeWidth={p ? 5 : 3}
          strokeLinecap="round"
          opacity={1}
          filter={`url(#${filterId})`}
        />

        {/* Walking stick figure */}
        <g transform={`translate(${figureX}, ${figureY})`} filter={`url(#${filterId})`}>
          {(() => {
            const stroke = textColor ?? "#FFFFFF";
            const S = figScale;
            const walkAnimMul = p ? 0.42 * 1.5 : 0.42 * 2;
            const cycle = isWalking ? frame * 0.22 * 0.9 * walkAnimMul : 0;
            const bob = isWalking ? Math.sin(cycle * 2) * 3 : 0;

            if (!isWalking) {
              return (
                <g transform={`scale(${S}) translate(-50, -114)`} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="50" cy="22" r="14" stroke={stroke} strokeWidth="4.5" fill="none" />
                  <circle cx="44" cy="20" r="1.8" fill={stroke} stroke="none" />
                  <circle cx="56" cy="20" r="1.8" fill={stroke} stroke="none" />
                  <line x1="50" y1="38" x2="50" y2="72" stroke={stroke} strokeWidth="4.5" />
                  <line x1="50" y1="48" x2="32" y2="82" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="48" x2="68" y2="82" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="72" x2="36" y2="114" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="72" x2="64" y2="114" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                </g>
              );
            }

            const getLeg = (offset: number) => {
              const ph = cycle + offset;
              return { thigh: Math.sin(ph) * 32, knee: Math.max(0, Math.sin(ph - Math.PI / 2)) * 40 };
            };
            const legL = getLeg(0);
            const legR = getLeg(Math.PI);
            const arm  = Math.sin(cycle) * 30;

            return (
              <g transform={`translate(0, ${bob}) scale(${S}) translate(-50, -114)`} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="50" cy="22" r="14" stroke={stroke} strokeWidth="4.5" fill="none" />
                <line x1="50" y1="38" x2="52" y2="72" stroke={stroke} strokeWidth="4.5" />
                <g transform={`rotate(${-arm} 50 48)`}>
                  <line x1="50" y1="48" x2="55" y2="68" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="55" y1="68" x2="70" y2="82" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                </g>
                <g transform={`rotate(${legR.thigh} 52 72)`}>
                  <line x1="52" y1="72" x2="52" y2="92" stroke={stroke} strokeWidth="4.5" />
                  <g transform={`translate(52, 92) rotate(${legR.knee})`}>
                    <line x1="0" y1="0" x2="8" y2="22" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  </g>
                </g>
                <g transform={`rotate(${legL.thigh} 52 72)`}>
                  <line x1="52" y1="72" x2="52" y2="92" stroke={stroke} strokeWidth="4.5" />
                  <g transform={`translate(52, 92) rotate(${legL.knee})`}>
                    <line x1="0" y1="0" x2="8" y2="22" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  </g>
                </g>
                <g transform={`rotate(${arm} 50 48)`}>
                  <line x1="50" y1="48" x2="55" y2="68" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="55" y1="68" x2="70" y2="82" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
                </g>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* ── Text overlay ── */}
      <div
        style={{
          position: "absolute",
          top: p ? 380 : 120,
          left: textColX,
          width: textColW,
          zIndex: 3,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 101 : 96),
            fontWeight: 700,
            color: accentColor ?? "#FFFFFF",
            lineHeight: 1.15,
            opacity: titleProgress,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            textShadow: `0 0 12px ${accentColor ?? "#FFFFFF"}B3`,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        {/* Chalk underline */}
        <svg width={underlineLen} height={14} viewBox={`0 0 ${underlineLen} 14`} style={{ display: "block", marginBottom: 28, overflow: "visible" }}>
          <polyline
            points={`0,7 ${underlineLen * 0.25},5 ${underlineLen * 0.5},9 ${underlineLen * 0.75},6 ${underlineLen},7`}
            fill="none"
            stroke={accentColor ?? "#FFFFFF"}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={underlineLen}
            strokeDashoffset={underlineDash}
            filter={`url(#${filterId})`}
          />
        </svg>

        {/* Narration */}
        <div
          style={{
            fontSize: descriptionFontSize ?? (p ? 50 : 42),
            color: textColor ?? "#FFFFFF",
            lineHeight: 1.6,
            opacity: narrationOpacity,
            textShadow: "0 0 6px rgba(255,255,255,0.4)",
            maxWidth: textColW - 40,
          }}
        >
          {narration}
        </div>
      </div>
    </AbsoluteFill>
  );
};