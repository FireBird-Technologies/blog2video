import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraTwoColumnDetail: React.FC<SceneLayoutProps> = (props) => {
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
  const leftHeadline = (props as any).leftHeadline ?? title ?? "Left Column";
  const leftBody = (props as any).leftBody ?? narration ?? "";
  const rightHeadline = (props as any).rightHeadline ?? "";
  const rightBody = (props as any).rightBody ?? "";

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const crimson = accentColor ?? "#C0143C";
  const washiBg = bgColor ?? "#FDF6F0";
  const ink = textColor ?? "#2A0A12";
  const gold = "#C8963C";
  const blush = "#F4B8C8";
  const mist = "#E8D5DF";

  const titlePx = titleFontSize ?? (p ? 38 : 44);
  const bodyPx = descriptionFontSize ?? (p ? 20 : 24);

  // Scene-level fade in/out
  const sceneOpacity = interpolate(frame, [0, 12, dur - 18, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Left column: slides from x=-50 to 0, opacity 0→1, frames 0–14
  const leftProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const leftX = interpolate(leftProgress, [0, 1], [-50, 0]);
  const leftOpacity = leftProgress;

  // Right column: slides from x=+50 to 0, opacity 0→1, frames 8–22
  const rightProgress = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const rightX = interpolate(rightProgress, [0, 1], [50, 0]);
  const rightOpacity = rightProgress;

  // Center divider: draws from midpoint outward, frames 4–20
  const dividerProgress = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // KamonCircle on divider fades in, frames 16–28
  const kamonOpacity = interpolate(frame, [16, 28], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Petal divider for left column: frames 20–32
  const leftDividerProgress = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Petal divider for right column: frames 26–38 (staggered 6 frames)
  const rightDividerProgress = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Layout dimensions
  const canvasW = width;
  const canvasH = height;
  const colW = p ? canvasW * 0.44 : canvasW * 0.42;
  const colGap = p ? canvasW * 0.06 : canvasW * 0.08;
  const dividerX = canvasW / 2;
  const dividerLineHeight = canvasH * 0.6;
  const dividerTop = (canvasH - dividerLineHeight) / 2;

  // Petal divider SVG dimensions
  const petalDividerW = p ? 260 : 320;
  const petalDividerH = 24;

  // WashiBackground fibers (deterministic)
  const fibers = Array.from({ length: 18 }, (_, i) => {
    const seed = i * 137.508;
    const x1 = ((Math.sin(seed) * 0.5 + 0.5) * canvasW * 1.2) - canvasW * 0.1;
    const y1 = ((Math.cos(seed * 1.3) * 0.5 + 0.5) * canvasH * 1.2) - canvasH * 0.1;
    const angle = (Math.sin(seed * 2.1) * 180);
    const len = 80 + Math.abs(Math.sin(seed * 3.7)) * 120;
    const x2 = x1 + Math.cos((angle * Math.PI) / 180) * len;
    const y2 = y1 + Math.sin((angle * Math.PI) / 180) * len;
    return { x1, y1, x2, y2 };
  });

  // SeigaihaPattern: grid of overlapping ellipses
  const seigaihaEllipses: { cx: number; cy: number; rx: number; ry: number; key: number }[] = [];
  const sw = p ? 48 : 60;
  const sh = p ? 36 : 45;
  const cols = Math.ceil(canvasW / sw) + 2;
  const rows = Math.ceil(canvasH / sh) + 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * sw + (row % 2 === 0 ? 0 : sw / 2);
      const cy = row * sh * 0.7;
      seigaihaEllipses.push({ cx, cy, rx: sw / 2, ry: sh / 2, key: row * 1000 + col });
    }
  }

  // PetalRain petals (deterministic, count=18, intensity=0.6)
  const petalCount = 18;
  const petalIntensity = 0.6;
  const petals = Array.from({ length: petalCount }, (_, i) => {
    const seed = i * 73.137 + 42;
    const startDelay = Math.abs(Math.sin(seed * 1.7)) * 60;
    const x = Math.abs(Math.sin(seed * 2.3)) * canvasW;
    const radius = 8 + Math.abs(Math.sin(seed * 3.1)) * 18;
    const swayAmp = (12 + Math.abs(Math.sin(seed * 4.2)) * 28) * petalIntensity;
    const swayFreq = 0.018 + Math.abs(Math.sin(seed * 5.5)) * 0.027;
    const rotSpeed = (0.4 + Math.abs(Math.sin(seed * 6.3)) * 1.8);
    const color = i % 2 === 0 ? blush : mist;
    const fallDuration = 180 + Math.abs(Math.sin(seed * 7.1)) * 120;
    const localFrame = frame - startDelay;
    const progress = Math.max(0, Math.min(1, localFrame / fallDuration));
    const y = progress * (canvasH + radius * 2) - radius;
    const swayX = x + Math.sin(localFrame * swayFreq * Math.PI * 2) * swayAmp;
    const rotation = localFrame * rotSpeed;
    let opacity = 1;
    if (progress < 0.1) opacity = progress / 0.1;
    else if (progress > 0.85) opacity = (1 - progress) / 0.15;
    if (localFrame < 0) opacity = 0;
    return { x: swayX, y, radius, color, rotation, opacity };
  });

  // KamonCircle SVG (small, for divider midpoint)
  const kamonR = 24;
  const kamonCx = 24;
  const kamonCy = 24;

  // Five-petal sakura flower at a given center, radius, rotation
  const sakuraFlower = (cx: number, cy: number, r: number, rot: number, color: string, key: number) => {
    const petalsArr = Array.from({ length: 5 }, (_, i) => {
      const angle = (rot + i * 72) * (Math.PI / 180);
      const px = cx + Math.cos(angle) * r * 0.7;
      const py = cy + Math.sin(angle) * r * 0.7;
      return (
        <ellipse
          key={i}
          cx={px}
          cy={py}
          rx={r * 0.38}
          ry={r * 0.22}
          transform={`rotate(${rot + i * 72}, ${px}, ${py})`}
          fill={color}
          opacity={0.85}
        />
      );
    });
    return <g key={key}>{petalsArr}</g>;
  };

  // PetalDivider SVG
  const PetalDivider: React.FC<{ progress: number; color: string; width: number }> = ({ progress, color, width }) => {
    const totalLen = width - 32;
    const dashOffset = totalLen * (1 - progress);
    return (
      <svg width={width} height={petalDividerH} style={{ display: "block" }}>
        <line
          x1={16}
          y1={petalDividerH / 2}
          x2={width - 16}
          y2={petalDividerH / 2}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={totalLen}
          strokeDashoffset={dashOffset}
        />
        {/* Three tiny petals on the line */}
        {[0.25, 0.5, 0.75].map((frac, i) => {
          const px = 16 + frac * totalLen;
          const py = petalDividerH / 2;
          return (
            <g key={i} opacity={progress}>
              <circle cx={px} cy={py} r={3.5} fill={color} opacity={0.7} />
              <circle cx={px - 5} cy={py - 3} r={2} fill={color} opacity={0.5} />
              <circle cx={px + 5} cy={py - 3} r={2} fill={color} opacity={0.5} />
            </g>
          );
        })}
      </svg>
    );
  };

  // Divider line: two halves drawing from midpoint outward
  const halfH = dividerLineHeight / 2;
  const topDashOffset = halfH * (1 - dividerProgress);
  const bottomDashOffset = halfH * (1 - dividerProgress);

  const padding = p ? 40 : 60;
  const colPadding = p ? 24 : 36;

  return (
    <AbsoluteFill style={{ background: washiBg, overflow: "hidden", opacity: sceneOpacity }}>
      {/* WashiBackground */}
      <AbsoluteFill>
        <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="washiGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#FDF6F0" />
              <stop offset="100%" stopColor="#F8EAE0" />
            </radialGradient>
            <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="black" stopOpacity={0} />
              <stop offset="100%" stopColor="black" stopOpacity={0.18} />
            </radialGradient>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#washiGrad)" />
          {fibers.map((f, i) => (
            <line
              key={i}
              x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
              stroke="#2A0A12"
              strokeWidth={0.7}
              opacity={0.07}
            />
          ))}
          <rect width={canvasW} height={canvasH} fill="url(#vignetteGrad)" />
        </svg>
      </AbsoluteFill>

      {/* SeigaihaPattern */}
      <AbsoluteFill>
        <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0 }} opacity={0.04}>
          {seigaihaEllipses.map((e) => (
            <ellipse
              key={e.key}
              cx={e.cx}
              cy={e.cy}
              rx={e.rx}
              ry={e.ry}
              fill="none"
              stroke={crimson}
              strokeWidth={0.8}
            />
          ))}
        </svg>
      </AbsoluteFill>

      {/* PetalRain */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0 }}>
          {petals.map((petal, i) => (
            <g
              key={i}
              transform={`translate(${petal.x}, ${petal.y}) rotate(${petal.rotation})`}
              opacity={petal.opacity}
            >
              <ellipse cx={0} cy={0} rx={petal.radius} ry={petal.radius * 0.55} fill={petal.color} />
              <ellipse cx={petal.radius * 0.6} cy={-petal.radius * 0.3} rx={petal.radius * 0.7} ry={petal.radius * 0.4} fill={petal.color} opacity={0.7} />
              <ellipse cx={-petal.radius * 0.6} cy={-petal.radius * 0.3} rx={petal.radius * 0.7} ry={petal.radius * 0.4} fill={petal.color} opacity={0.7} />
            </g>
          ))}
        </svg>
      </AbsoluteFill>

      {/* Center Divider Line */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0 }}>
          {/* Top half: draws upward from midpoint */}
          <line
            x1={dividerX}
            y1={canvasH / 2}
            x2={dividerX}
            y2={dividerTop}
            stroke={crimson}
            strokeWidth={1}
            strokeDasharray={halfH}
            strokeDashoffset={topDashOffset}
          />
          {/* Bottom half: draws downward from midpoint */}
          <line
            x1={dividerX}
            y1={canvasH / 2}
            x2={dividerX}
            y2={dividerTop + dividerLineHeight}
            stroke={crimson}
            strokeWidth={1}
            strokeDasharray={halfH}
            strokeDashoffset={bottomDashOffset}
          />
        </svg>

        {/* KamonCircle at divider midpoint */}
        <div
          style={{
            position: "absolute",
            left: dividerX - kamonR,
            top: canvasH / 2 - kamonR,
            opacity: kamonOpacity,
            pointerEvents: "none",
          }}
        >
          <svg width={kamonR * 2} height={kamonR * 2}>
            {/* Outer ring */}
            <circle cx={kamonCx} cy={kamonCy} r={kamonR - 2} fill="none" stroke={crimson} strokeWidth={1.2} />
            {/* Inner ring */}
            <circle cx={kamonCx} cy={kamonCy} r={kamonR - 7} fill="none" stroke={crimson} strokeWidth={0.8} />
            {/* Three sakura flowers at 120° intervals */}
            {[0, 120, 240].map((angleDeg, i) => {
              const angle = (angleDeg - 90) * (Math.PI / 180);
              const flowerR = kamonR - 10;
              const fx = kamonCx + Math.cos(angle) * flowerR;
              const fy = kamonCy + Math.sin(angle) * flowerR;
              return sakuraFlower(fx, fy, 4, angleDeg, crimson, i);
            })}
          </svg>
        </div>
      </AbsoluteFill>

      {/* Two Columns */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          padding: `${padding}px`,
          gap: 0,
        }}
      >
        {/* Left Column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: colPadding,
            transform: `translateX(${leftX}px)`,
            opacity: leftOpacity,
          }}
        >
          {/* Left Headline */}
          <div
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 38 : 44),
              color: ink,
              lineHeight: 1.25,
              marginBottom: p ? 14 : 18,
              letterSpacing: "0.01em",
            }}
          >
            {leftHeadline}
          </div>

          {/* Left Petal Divider */}
          <div style={{ marginBottom: p ? 14 : 20 }}>
            <PetalDivider progress={leftDividerProgress} color={crimson} width={petalDividerW} />
          </div>

          {/* Left Body */}
          <div
            style={{
              fontFamily: "'Shippori Mincho', serif",
              fontWeight: 400,
              fontSize: descriptionFontSize ?? (p ? 20 : 24),
              color: ink,
              lineHeight: 1.7,
              opacity: leftDividerProgress,
            }}
          >
            {leftBody}
          </div>
        </div>

        {/* Right Column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: colPadding,
            transform: `translateX(${rightX}px)`,
            opacity: rightOpacity,
          }}
        >
          {/* Right Headline */}
          <div
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 38 : 44),
              color: ink,
              lineHeight: 1.25,
              marginBottom: p ? 14 : 18,
              letterSpacing: "0.01em",
            }}
          >
            {rightHeadline || title}
          </div>

          {/* Right Petal Divider */}
          <div style={{ marginBottom: p ? 14 : 20 }}>
            <PetalDivider progress={rightDividerProgress} color={crimson} width={petalDividerW} />
          </div>

          {/* Right Body or Image */}
          {imageUrl ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: p ? 320 : 500,
                border: `2px solid ${crimson}`,
                overflow: "hidden",
                opacity: rightDividerProgress,
              }}
            >
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: imageObjectPosition ?? "50% 50%",
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                fontFamily: "'Shippori Mincho', serif",
                fontWeight: 400,
                fontSize: descriptionFontSize ?? (p ? 20 : 24),
                color: ink,
                lineHeight: 1.7,
                opacity: rightDividerProgress,
              }}
            >
              {rightBody || narration}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
