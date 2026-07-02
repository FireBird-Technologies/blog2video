import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraTextNarration: React.FC<SceneLayoutProps> = (props) => {
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
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const eyebrow = (props as any).eyebrow ?? "";
  const headline = (props as any).headline ?? title ?? "";
  const body = (props as any).body ?? narration ?? "";

  const dur = sceneDurationInFrames ?? 150;

  // Scene-level exit fade
  const sceneOpacity = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Eyebrow: frames 0–8, opacity 0→1
  const eyebrowOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline: frames 6–20, spring scale + fade
  const headlineProgress = spring({
    frame: frame - 6,
    fps,
    config: { damping: 18, stiffness: 60 },
  });
  const headlineScale = interpolate(headlineProgress, [0, 1], [0.94, 1.0]);
  const headlineOpacity = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Petal divider: frames 16–28, strokeDashoffset draw over 12 frames
  const dividerProgress = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dividerLength = 320;
  const dividerDash = dividerLength * (1 - dividerProgress);

  // Body: frames 22–42, fade + translate up 16px→0, Easing.out(Easing.quad)
  const bodyRaw = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Easing.out(Easing.quad) = t => 1 - (1-t)^2
  const bodyEased = 1 - Math.pow(1 - bodyRaw, 2);
  const bodyOpacity = bodyEased;
  const bodyTranslateY = interpolate(bodyEased, [0, 1], [16, 0]);

  // Typography
  const titlePx = titleFontSize ?? (p ? 80 : 64);
  const bodyPx = descriptionFontSize ?? (p ? 38 : 28);

  // Colors
  const crimson = accentColor ?? "#C0143C";
  const ink = textColor ?? "#2A0A12";
  const washiBg = bgColor ?? "#FDF6F0";

  // PetalRain: 16 petals, intensity 0.55
  const petalCount = 16;
  const intensity = 0.55;

  const petals = React.useMemo(() => {
    const result = [];
    for (let i = 0; i < petalCount; i++) {
      const seed = i * 137.508 + 42;
      const pseudoRand = (offset: number) => {
        const x = Math.sin(seed + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      const startX = pseudoRand(0) * width;
      const startDelay = Math.floor(pseudoRand(1) * 60);
      const radius = 8 + pseudoRand(2) * 18;
      const swayAmplitude = (12 + pseudoRand(3) * 28) * intensity;
      const swayFrequency = 0.018 + pseudoRand(4) * 0.027;
      const rotationSpeed = (0.4 + pseudoRand(5) * 1.8) * intensity;
      const color = pseudoRand(6) > 0.5 ? "#F4B8C8" : "#E8D5DF";
      const fallDuration = 120 + pseudoRand(7) * 80;

      result.push({
        startX,
        startDelay,
        radius,
        swayAmplitude,
        swayFrequency,
        rotationSpeed,
        color,
        fallDuration,
      });
    }
    return result;
  }, [width]);

  const renderPetals = () => {
    return petals.map((petal, i) => {
      const localFrame = frame - petal.startDelay;
      if (localFrame < 0) return null;

      const progress = localFrame / petal.fallDuration;
      if (progress > 1) return null;

      const y = -petal.radius * 2 + progress * (height + petal.radius * 4);
      const x =
        petal.startX +
        Math.sin(localFrame * petal.swayFrequency * Math.PI * 2) *
          petal.swayAmplitude;
      const rotation = localFrame * petal.rotationSpeed;

      // Fade in over first 10%, fade out over last 15%
      let petalOpacity = 1;
      if (progress < 0.1) {
        petalOpacity = progress / 0.1;
      } else if (progress > 0.85) {
        petalOpacity = (1 - progress) / 0.15;
      }

      return (
        <g
          key={i}
          transform={`translate(${x}, ${y}) rotate(${rotation})`}
          opacity={petalOpacity}
        >
          {/* Five-petal sakura flower */}
          {[0, 72, 144, 216, 288].map((angle, pi) => (
            <ellipse
              key={pi}
              cx={0}
              cy={-petal.radius * 0.55}
              rx={petal.radius * 0.38}
              ry={petal.radius * 0.6}
              fill={petal.color}
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx={0} cy={0} r={petal.radius * 0.18} fill="#E8739A" />
        </g>
      );
    });
  };

  // WashiBackground SVG
  const renderWashiBackground = () => {
    const fibers = [];
    for (let i = 0; i < 30; i++) {
      const seed = i * 73.1 + 11;
      const pseudoRand = (offset: number) => {
        const x = Math.sin(seed + offset) * 43758.5453;
        return x - Math.floor(x);
      };
      const x1 = pseudoRand(0) * width;
      const y1 = pseudoRand(1) * height;
      const angle = pseudoRand(2) * Math.PI * 2;
      const len = 60 + pseudoRand(3) * 120;
      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;
      fibers.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#2A0A12"
          strokeWidth={0.5}
          opacity={0.07}
        />
      );
    }
    return fibers;
  };

  // SeigaihaPattern SVG
  const renderSeigaiha = () => {
    const scaleW = width / 1920;
    const scaleH = height / 1080;
    const cellW = 60 * scaleW;
    const cellH = 40 * scaleH;
    const cols = Math.ceil(width / cellW) + 1;
    const rows = Math.ceil(height / cellH) + 2;
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = row % 2 === 0 ? 0 : cellW / 2;
        const cx = col * cellW + offsetX;
        const cy = row * cellH;
        shapes.push(
          <ellipse
            key={`${row}-${col}`}
            cx={cx}
            cy={cy}
            rx={cellW * 0.55}
            ry={cellH * 0.85}
            fill="none"
            stroke="#C0143C"
            strokeWidth={0.8}
          />
        );
      }
    }
    return shapes;
  };

  // KamonCircle (small footer, 80px diameter)
  const renderKamon = (cx: number, cy: number, diameter: number, color: string) => {
    const r = diameter / 2;
    const outerR = r * 0.95;
    const innerR = r * 0.78;
    const petalPositions = [0, 120, 240];

    return (
      <g opacity={0.06}>
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={color} strokeWidth={1} />
        {petalPositions.map((angle, i) => {
          const rad = (angle - 90) * (Math.PI / 180);
          const px = cx + Math.cos(rad) * innerR * 0.65;
          const py = cy + Math.sin(rad) * innerR * 0.65;
          const pr = r * 0.1;
          return (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((pa, pi) => {
                const prad = (pa - 90) * (Math.PI / 180);
                return (
                  <ellipse
                    key={pi}
                    cx={px + Math.cos(prad) * pr * 0.9}
                    cy={py + Math.sin(prad) * pr * 0.9}
                    rx={pr * 0.45}
                    ry={pr * 0.7}
                    fill={color}
                    transform={`rotate(${pa}, ${px + Math.cos(prad) * pr * 0.9}, ${py + Math.sin(prad) * pr * 0.9})`}
                  />
                );
              })}
              <circle cx={px} cy={py} r={pr * 0.25} fill={color} />
            </g>
          );
        })}
      </g>
    );
  };

  const maxTitleWidth = p ? width * 0.88 : 1200;
  const maxBodyWidth = p ? width * 0.88 : 960;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, background: washiBg }}>
      {/* WashiBackground */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
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
          <rect width={width} height={height} fill="url(#washiGrad)" />
          {renderWashiBackground()}
          <rect width={width} height={height} fill="url(#vignetteGrad)" />
        </svg>
      </AbsoluteFill>

      {/* SeigaihaPattern */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.04 }}>
          {renderSeigaiha()}
        </svg>
      </AbsoluteFill>

      {/* PetalRain */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {renderPetals()}
        </svg>
      </AbsoluteFill>

      {/* Main content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "60px 40px" : "80px 60px",
        }}
      >
        {/* Eyebrow label */}
        {eyebrow ? (
          <div
            style={{
              opacity: eyebrowOpacity,
              fontFamily: "'Shippori Mincho', serif",
              fontWeight: 400,
              fontSize: p ? 16 : 20,
              color: crimson,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: p ? 20 : 28,
              textAlign: "center",
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        {/* Headline */}
        <div
          style={{
            opacity: headlineOpacity,
            transform: `scale(${headlineScale})`,
            transformOrigin: "center center",
            fontFamily: "'Noto Serif JP', serif",
            fontWeight: 700,
            fontSize: titleFontSize ?? (p ? 80 : 64),
            color: ink,
            maxWidth: maxTitleWidth,
            textAlign: "center",
            lineHeight: 1.3,
            marginBottom: p ? 32 : 40,
          }}
        >
          {headline}
        </div>

        {/* Petal Divider */}
        <div
          style={{
            marginBottom: p ? 32 : 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={dividerLength + 60}
            height={40}
            viewBox={`0 0 ${dividerLength + 60} 40`}
          >
            {/* Main line */}
            <line
              x1={30}
              y1={20}
              x2={dividerLength + 30}
              y2={20}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={dividerLength}
              strokeDashoffset={dividerDash}
            />
            {/* Three petal ornaments on the line */}
            {[0.2, 0.5, 0.8].map((pos, i) => {
              const px = 30 + pos * dividerLength;
              const py = 20;
              const pr = 6;
              const petalVisible = dividerProgress >= pos;
              return (
                <g key={i} opacity={petalVisible ? 1 : 0}>
                  {[0, 72, 144, 216, 288].map((angle, pi) => {
                    const rad = (angle - 90) * (Math.PI / 180);
                    return (
                      <ellipse
                        key={pi}
                        cx={px + Math.cos(rad) * pr * 0.8}
                        cy={py + Math.sin(rad) * pr * 0.8}
                        rx={pr * 0.38}
                        ry={pr * 0.6}
                        fill={crimson}
                        transform={`rotate(${angle}, ${px + Math.cos(rad) * pr * 0.8}, ${py + Math.sin(rad) * pr * 0.8})`}
                      />
                    );
                  })}
                  <circle cx={px} cy={py} r={pr * 0.22} fill={crimson} />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Body paragraph */}
        <div
          style={{
            opacity: bodyOpacity,
            transform: `translateY(${bodyTranslateY}px)`,
            fontFamily: "'Shippori Mincho', serif",
            fontWeight: 400,
            fontSize: descriptionFontSize ?? (p ? 38 : 28),
            color: ink,
            maxWidth: maxBodyWidth,
            textAlign: "center",
            lineHeight: 1.8,
          }}
        >
          {body}
        </div>
      </AbsoluteFill>

      {/* KamonCircle footer ornament */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {renderKamon(width / 2, height - 60, 80, crimson)}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
