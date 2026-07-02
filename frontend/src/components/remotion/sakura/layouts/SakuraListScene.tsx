import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraListScene: React.FC<SceneLayoutProps> = (props) => {
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

  const headline = (props as any).headline ?? title ?? "";
  const items: string[] = (props as any).items ?? [];

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 52 : 52);
  const descPx = descriptionFontSize ?? (p ? 32 : 28);

  // Colors
  const inkColor = textColor ?? "#2A0A12";
  const accent = accentColor ?? "#C0143C";
  const bg = bgColor ?? "#FDF6F0";
  const blush = "#F4B8C8";
  const mist = "#E8D5DF";
  const gold = "#C8963C";
  const crimson = accent;

  // Scene transitions
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOpacity = enter * exit;

  // Headline animation: frames 0–12, slide from x=-30 to 0
  const headlineOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineX = interpolate(frame, [0, 12], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Petal divider: frames 10–22, strokeDashoffset from 320 to 0
  const dividerProgress = interpolate(frame, [10, 22], [320, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // PetalRain: 18 petals, intensity 0.6
  const petalCount = 18;
  const petalIntensity = 0.6;

  // Deterministic petal rain
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const petals = React.useMemo(() => {
    return Array.from({ length: petalCount }, (_, i) => {
      const rng = seededRandom(i * 137 + 42);
      const startX = rng() * width;
      const startDelay = Math.floor(rng() * 60);
      const radius = 8 + rng() * 18;
      const swayAmplitude = (12 + rng() * 28) * petalIntensity;
      const swayFrequency = 0.018 + rng() * 0.027;
      const rotationSpeed = (0.4 + rng() * 1.8) * petalIntensity;
      const color = i % 2 === 0 ? blush : mist;
      const fallDuration = 120 + rng() * 80;
      return { startX, startDelay, radius, swayAmplitude, swayFrequency, rotationSpeed, color, fallDuration };
    });
  }, [width]);

  // List item animations
  // item N starts at frame 18 + N*10
  // bullet: spring scale 0->1 at that frame
  // text: fade in 4 frames later with 16px upward translate

  const listItems = items.slice(0, 6);

  const padding = p ? 60 : 80;
  const contentWidth = width - padding * 2;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, background: bg, fontFamily: fontFamily ?? "serif" }}>
      {/* WashiBackground - light variant */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            <radialGradient id="washiGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#FDF6F0" />
              <stop offset="100%" stopColor="#F8EAE0" />
            </radialGradient>
            <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.18" />
            </radialGradient>
          </defs>
          <rect width={width} height={height} fill="url(#washiGrad)" />
          {/* Washi fiber lines */}
          {Array.from({ length: 30 }, (_, i) => {
            const rng = seededRandom(i * 73 + 11);
            const x1 = rng() * width;
            const y1 = rng() * height;
            const angle = rng() * Math.PI;
            const len = 60 + rng() * 120;
            const x2 = x1 + Math.cos(angle) * len;
            const y2 = y1 + Math.sin(angle) * len;
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#8B4A5A"
                strokeWidth={0.5}
                opacity={0.07}
              />
            );
          })}
          <rect width={width} height={height} fill="url(#vignetteGrad)" />
        </svg>
      </AbsoluteFill>

      {/* SeigaihaPattern at opacity 0.04 */}
      <AbsoluteFill style={{ opacity: 0.04 }}>
        <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            <pattern id="seigaiha" x="0" y="0" width="60" height="40" patternUnits="userSpaceOnUse">
              {/* Row 1 */}
              <ellipse cx="30" cy="40" rx="30" ry="20" fill="none" stroke={crimson} strokeWidth="1" />
              <ellipse cx="0" cy="40" rx="30" ry="20" fill="none" stroke={crimson} strokeWidth="1" />
              <ellipse cx="60" cy="40" rx="30" ry="20" fill="none" stroke={crimson} strokeWidth="1" />
              {/* Row 2 offset */}
              <ellipse cx="15" cy="20" rx="30" ry="20" fill="none" stroke={crimson} strokeWidth="1" />
              <ellipse cx="45" cy="20" rx="30" ry="20" fill="none" stroke={crimson} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#seigaiha)" />
        </svg>
      </AbsoluteFill>

      {/* PetalRain */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
          {petals.map((petal, i) => {
            const effectiveFrame = frame - petal.startDelay;
            if (effectiveFrame < 0) return null;
            const progress = effectiveFrame / petal.fallDuration;
            if (progress > 1) return null;

            const y = progress * (height + petal.radius * 2) - petal.radius;
            const x = petal.startX + Math.sin(effectiveFrame * petal.swayFrequency * Math.PI * 2) * petal.swayAmplitude;
            const rotation = effectiveFrame * petal.rotationSpeed;

            // Fade in over first 10%, fade out over last 15%
            let opacity = 1;
            if (progress < 0.1) opacity = progress / 0.1;
            else if (progress > 0.85) opacity = (1 - progress) / 0.15;

            const r = petal.radius;
            // Simple 5-petal sakura SVG
            return (
              <g key={i} transform={`translate(${x}, ${y}) rotate(${rotation})`} opacity={opacity}>
                {[0, 72, 144, 216, 288].map((deg, j) => {
                  const rad = (deg * Math.PI) / 180;
                  const px = Math.cos(rad) * r * 0.6;
                  const py = Math.sin(rad) * r * 0.6;
                  return (
                    <ellipse
                      key={j}
                      cx={px}
                      cy={py}
                      rx={r * 0.45}
                      ry={r * 0.28}
                      fill={petal.color}
                      transform={`rotate(${deg}, ${px}, ${py})`}
                    />
                  );
                })}
                <circle cx={0} cy={0} r={r * 0.18} fill="#F9D0DC" />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Main content */}
      <AbsoluteFill style={{ padding: `${padding}px`, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
        {/* Headline */}
        <div
          style={{
            opacity: headlineOpacity,
            transform: `translateX(${headlineX}px)`,
            marginBottom: 0,
          }}
        >
          <h1
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 52 : 52),
              color: inkColor,
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: "0.02em",
            }}
          >
            {headline}
          </h1>
        </div>

        {/* Petal Divider */}
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <svg width={320} height={24} style={{ overflow: "visible" }}>
            <line
              x1={0}
              y1={12}
              x2={320}
              y2={12}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={320}
              strokeDashoffset={dividerProgress}
            />
            {/* Three tiny petal SVGs centered on the line */}
            {[80, 160, 240].map((cx, i) => (
              <g key={i} transform={`translate(${cx}, 12)`}>
                {[0, 72, 144, 216, 288].map((deg, j) => {
                  const rad = (deg * Math.PI) / 180;
                  const px = Math.cos(rad) * 5;
                  const py = Math.sin(rad) * 5;
                  return (
                    <ellipse
                      key={j}
                      cx={px}
                      cy={py}
                      rx={4}
                      ry={2.5}
                      fill={crimson}
                      transform={`rotate(${deg}, ${px}, ${py})`}
                      opacity={interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                    />
                  );
                })}
                <circle cx={0} cy={0} r={1.5} fill="#F9D0DC" opacity={interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
              </g>
            ))}
          </svg>
        </div>

        {/* List Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {listItems.map((item, idx) => {
            const itemStartFrame = 18 + idx * 10;
            const bulletScale = spring({
              frame: frame - itemStartFrame,
              fps,
              config: { damping: 20, stiffness: 80 },
            });
            const clampedBulletScale = Math.min(bulletScale, 1);

            const textStartFrame = itemStartFrame + 4;
            const textOpacity = interpolate(frame, [textStartFrame, textStartFrame + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const textTranslateY = interpolate(frame, [textStartFrame, textStartFrame + 8], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div key={idx}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingTop: 16,
                    paddingBottom: 16,
                    gap: 20,
                  }}
                >
                  {/* Crimson petal bullet */}
                  <div
                    style={{
                      flexShrink: 0,
                      transform: `scale(${clampedBulletScale})`,
                      transformOrigin: "center center",
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width={24} height={24} viewBox="-12 -12 24 24">
                      {[0, 72, 144, 216, 288].map((deg, j) => {
                        const rad = (deg * Math.PI) / 180;
                        const px = Math.cos(rad) * 5.5;
                        const py = Math.sin(rad) * 5.5;
                        return (
                          <ellipse
                            key={j}
                            cx={px}
                            cy={py}
                            rx={5}
                            ry={3}
                            fill={crimson}
                            transform={`rotate(${deg}, ${px}, ${py})`}
                          />
                        );
                      })}
                      <circle cx={0} cy={0} r={2} fill="#F9D0DC" />
                    </svg>
                  </div>

                  {/* Item text */}
                  <div
                    style={{
                      opacity: textOpacity,
                      transform: `translateY(${textTranslateY}px)`,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Shippori Mincho', serif",
                        fontWeight: 500,
                        fontSize: descriptionFontSize ?? (p ? 32 : 28),
                        color: inkColor,
                        lineHeight: 1.5,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                </div>

                {/* Horizontal rule between items */}
                {idx < listItems.length - 1 && (
                  <div
                    style={{
                      width: "100%",
                      height: 1,
                      background: mist,
                      opacity: 0.3,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Narration text (if present) */}
        {narration && (
          <div
            style={{
              marginTop: 32,
              opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <p
              style={{
                fontFamily: "'Shippori Mincho', serif",
                fontWeight: 400,
                fontSize: descriptionFontSize ?? (p ? 32 : 28),
                color: inkColor,
                opacity: 0.7,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {narration}
            </p>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
