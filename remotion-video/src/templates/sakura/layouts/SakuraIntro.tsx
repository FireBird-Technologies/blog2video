import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraIntro: React.FC<SceneLayoutProps> = (props) => {
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

  const kanjiTitle = (props as any).kanjiTitle ?? title ?? "桜";
  const romanTitle = (props as any).romanTitle ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";

  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 120 : 160);
  const descriptionPx = descriptionFontSize ?? (p ? 32 : 36);

  // Scene-level exit opacity
  const sceneOpacity = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Kanji title: frames 0–12, scale 0.6→1, opacity 0→1
  const kanjiSpring = spring({ frame, fps, config: { damping: 18, stiffness: 60 } });
  const kanjiScale = interpolate(kanjiSpring, [0, 1], [0.6, 1.0]);
  const kanjiOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Romanized subtitle: frames 12–24, opacity 0→1, translateY 18→0
  const subtitleOpacity = interpolate(frame, [12, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2), // Easing.out(Easing.quad)
  });
  const subtitleTranslateY = interpolate(frame, [12, 24], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Brush stroke line: frames 18–36, strokeDashoffset full→0
  const BRUSH_LINE_LENGTH = 480;
  const brushProgress = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, // inOut cubic
  });
  const brushDashOffset = BRUSH_LINE_LENGTH * (1 - brushProgress);

  // Petal divider: frames 24–36
  const DIVIDER_LENGTH = 320;
  const dividerProgress = interpolate(frame, [24, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dividerDashOffset = DIVIDER_LENGTH * (1 - dividerProgress);

  // Tagline: frames 30–42 (6-frame offset after divider starts at 24)
  const taglineOpacity = interpolate(frame, [30, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Colors
  const washi = "#FDF6F0";
  const mist = "#E8D5DF";
  const blush = "#F4B8C8";
  const crimson = "#C0143C";
  const lacquer = "#3D0F1F";
  const voidColor = "#0D0508";
  const gold = "#C8963C";

  // ── WashiBackground (dark variant) ──────────────────────────────────────────
  const WashiBackground: React.FC = () => {
    const fibers = Array.from({ length: 28 }, (_, i) => {
      const seed = i * 137.508;
      const x1 = (Math.sin(seed) * 0.5 + 0.5) * 1920;
      const y1 = (Math.cos(seed * 1.3) * 0.5 + 0.5) * 1080;
      const angle = (seed % Math.PI) - Math.PI / 2;
      const len = 80 + (seed % 120);
      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;
      return { x1, y1, x2, y2 };
    });

    return (
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="washiDarkGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={lacquer} />
            <stop offset="100%" stopColor={voidColor} />
          </radialGradient>
          <radialGradient id="washiVignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.18" />
          </radialGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#washiDarkGrad)" />
        <g opacity="0.07">
          {fibers.map((f, i) => (
            <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#FDF6F0" strokeWidth="0.8" />
          ))}
        </g>
        <rect width="1920" height="1080" fill="url(#washiVignette)" />
      </svg>
    );
  };

  // ── SeigaihaPattern ──────────────────────────────────────────────────────────
  const SeigaihaPattern: React.FC = () => {
    const scaleW = width / 1920;
    const scaleH = height / 1080;
    const cellW = 60;
    const cellH = 40;
    const cols = Math.ceil(1920 / cellW) + 2;
    const rows = Math.ceil(1080 / cellH) + 2;
    const scales: React.ReactNode[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellW + (row % 2 === 1 ? cellW / 2 : 0);
        const y = row * cellH * 0.6;
        scales.push(
          <ellipse
            key={`${row}-${col}`}
            cx={x}
            cy={y}
            rx={cellW / 2}
            ry={cellH * 0.75}
            fill="none"
            stroke={washi}
            strokeWidth="0.8"
          />
        );
      }
    }
    return (
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05 }}
      >
        {scales}
      </svg>
    );
  };

  // ── KamonCircle ──────────────────────────────────────────────────────────────
  const KamonCircle: React.FC<{ cx: number; cy: number; diameter: number; opacity: number }> = ({
    cx, cy, diameter, opacity,
  }) => {
    const r = diameter / 2;
    const outerR = r;
    const innerR = r * 0.78;
    const petalR = r * 0.12;
    const petalOrbitR = innerR * 0.72;
    const strokeColor = gold;

    const petals = [0, 120, 240].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const px = cx + Math.cos(rad) * petalOrbitR;
      const py = cy + Math.sin(rad) * petalOrbitR;
      return { px, py };
    });

    const fivePetalPath = (cx: number, cy: number, r: number) => {
      const pts = Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
      });
      const inner = r * 0.4;
      const innerPts = Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 - 90 + 36) * (Math.PI / 180);
        return [cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner];
      });
      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < 5; i++) {
        d += ` L ${innerPts[i][0]} ${innerPts[i][1]} L ${pts[(i + 1) % 5][0]} ${pts[(i + 1) % 5][1]}`;
      }
      d += " Z";
      return d;
    };

    return (
      <svg
        width={diameter}
        height={diameter}
        viewBox={`${cx - r} ${cy - r} ${diameter} ${diameter}`}
        style={{ position: "absolute", left: cx - r, top: cy - r, opacity }}
      >
        <circle cx={cx} cy={cy} r={outerR - 2} fill="none" stroke={strokeColor} strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={strokeColor} strokeWidth="1.5" />
        {petals.map((pt, i) => (
          <path key={i} d={fivePetalPath(pt.px, pt.py, petalR)} fill={strokeColor} />
        ))}
      </svg>
    );
  };

  // ── Corner Petal Clusters ────────────────────────────────────────────────────
  const cornerPetalData: Array<{ x: number; y: number }> = [
    { x: 60, y: 60 },
    { x: 1860, y: 60 },
    { x: 60, y: 1020 },
    { x: 1860, y: 1020 },
  ];

  const staticPetalOffsets: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 20, y: -15 },
    { x: -18, y: 12 },
    { x: 14, y: 22 },
    { x: -10, y: -22 },
  ];

  const CornerPetals: React.FC = () => (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {cornerPetalData.map((corner, ci) =>
        staticPetalOffsets.map((offset, oi) => {
          const px = corner.x + offset.x;
          const py = corner.y + offset.y;
          const color = oi % 2 === 0 ? blush : mist;
          const r = 10 + (oi * 3);
          return (
            <ellipse
              key={`${ci}-${oi}`}
              cx={px}
              cy={py}
              rx={r}
              ry={r * 0.6}
              fill={color}
              opacity={0.55}
              transform={`rotate(${oi * 36}, ${px}, ${py})`}
            />
          );
        })
      )}
    </svg>
  );

  // ── PetalRain ────────────────────────────────────────────────────────────────
  const PetalRain: React.FC<{ count: number; intensity: number; seed?: number }> = ({
    count, intensity, seed = 42,
  }) => {
    const petals = Array.from({ length: count }, (_, i) => {
      const s = seed + i * 31.7;
      const pseudoRand = (n: number) => Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1;

      const startX = pseudoRand(s) * 1920;
      const startDelay = Math.floor(pseudoRand(s + 1) * 60);
      const radius = 8 + pseudoRand(s + 2) * 18;
      const swayAmp = (12 + pseudoRand(s + 3) * 28) * intensity;
      const swayFreq = 0.018 + pseudoRand(s + 4) * 0.027;
      const rotSpeed = 0.4 + pseudoRand(s + 5) * 1.8;
      const color = i % 2 === 0 ? blush : mist;
      const fallDuration = 120 + pseudoRand(s + 6) * 80;

      const effectiveFrame = Math.max(0, frame - startDelay);
      const progress = effectiveFrame / fallDuration;
      if (progress > 1) return null;

      const y = progress * (1080 + radius * 2) - radius;
      const x = startX + Math.sin(effectiveFrame * swayFreq * Math.PI * 2) * swayAmp;
      const rotation = effectiveFrame * rotSpeed;

      let opacity = 1;
      if (progress < 0.1) opacity = progress / 0.1;
      else if (progress > 0.85) opacity = (1 - progress) / 0.15;

      return { x, y, rotation, radius, color, opacity };
    }).filter(Boolean) as Array<{ x: number; y: number; rotation: number; radius: number; color: string; opacity: number }>;

    const petalPath = (r: number) => {
      const pts = Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        return [Math.cos(angle) * r, Math.sin(angle) * r];
      });
      const inner = r * 0.4;
      const innerPts = Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 - 90 + 36) * (Math.PI / 180);
        return [Math.cos(angle) * inner, Math.sin(angle) * inner];
      });
      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < 5; i++) {
        d += ` L ${innerPts[i][0]} ${innerPts[i][1]} L ${pts[(i + 1) % 5][0]} ${pts[(i + 1) % 5][1]}`;
      }
      d += " Z";
      return d;
    };

    return (
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {petals.map((petal, i) => (
          <g
            key={i}
            transform={`translate(${petal.x}, ${petal.y}) rotate(${petal.rotation})`}
            opacity={petal.opacity}
          >
            <path d={petalPath(petal.radius)} fill={petal.color} />
          </g>
        ))}
      </svg>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────────────────
  const centerX = 960;
  const centerY = 540;

  return (
    <AbsoluteFill style={{ background: voidColor, opacity: sceneOpacity }}>
      {/* Background layers */}
      <WashiBackground />
      <SeigaihaPattern />

      {/* KamonCircle watermark */}
      <KamonCircle cx={centerX} cy={centerY} diameter={480} opacity={0.08} />

      {/* Corner petal clusters */}
      <CornerPetals />

      {/* PetalRain — above background, below text */}
      <PetalRain count={35} intensity={1.5} seed={42} />

      {/* Text layers */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {/* Kanji title at ~38% height */}
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 18 : 24,
            transform: `translateY(-50%)`,
          }}
        >
          {/* Kanji title */}
          <div
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 120 : 160),
              color: washi,
              transform: `scale(${kanjiScale})`,
              opacity: kanjiOpacity,
              letterSpacing: "0.05em",
              textAlign: "center",
              lineHeight: 1.1,
              textShadow: `0 0 60px rgba(192,20,60,0.3)`,
            }}
          >
            {kanjiTitle}
          </div>

          {/* Romanized subtitle */}
          <div
            style={{
              fontFamily: "'Shippori Mincho', serif",
              fontWeight: 400,
              fontSize: descriptionFontSize ?? (p ? 32 : 36),
              color: mist,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleTranslateY}px)`,
              letterSpacing: "0.25em",
              textAlign: "center",
            }}
          >
            {romanTitle}
          </div>

          {/* Crimson brush-stroke line */}
          <svg
            width="480"
            height="12"
            viewBox="0 0 480 12"
            style={{ overflow: "visible", display: "block" }}
          >
            <path
              d="M 0 6 Q 120 2 240 6 Q 360 10 480 6"
              fill="none"
              stroke={crimson}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={BRUSH_LINE_LENGTH}
              strokeDashoffset={brushDashOffset}
            />
          </svg>

          {/* Petal divider + tagline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* Petal divider */}
            <svg
              width="320"
              height="20"
              viewBox="0 0 320 20"
              style={{ overflow: "visible", display: "block" }}
            >
              <line
                x1="0"
                y1="10"
                x2="320"
                y2="10"
                stroke={crimson}
                strokeWidth="1.5"
                strokeDasharray={DIVIDER_LENGTH}
                strokeDashoffset={dividerDashOffset}
              />
              {/* Three tiny petal SVGs centered on the line */}
              {[80, 160, 240].map((xPos) => (
                <g key={xPos} transform={`translate(${xPos}, 10)`} opacity={dividerProgress}>
                  <circle r="3" fill={blush} />
                </g>
              ))}
            </svg>

            {/* Tagline */}
            <div
              style={{
                fontFamily: "'Shippori Mincho', serif",
                fontWeight: 400,
                fontSize: 24,
                color: gold,
                opacity: taglineOpacity,
                letterSpacing: "0.12em",
                textAlign: "center",
              }}
            >
              {tagline}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
