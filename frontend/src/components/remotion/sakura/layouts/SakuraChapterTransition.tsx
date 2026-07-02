import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraChapterTransition: React.FC<SceneLayoutProps> = (props) => {
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

  const chapterNumber = (props as any).chapterNumber ?? "一";
  const chapterTitle = (props as any).chapterTitle ?? title ?? "";

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 80 : 96);
  const descPx = descriptionFontSize ?? (p ? 38 : 48);

  // Exit transition
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frames 0–18: KamonCircle fades in, opacity 0→0.10, scales 0.85→1.0
  const kamonOpacityRaw = interpolate(frame, [0, 18], [0, 0.10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kamonScale = spring({
    frame: frame,
    fps,
    config: { damping: 16, stiffness: 50 },
    from: 0.85,
    to: 1.0,
  });

  // Frames 6–24: Brush-stroke line draws via strokeDashoffset
  const strokeLength = p ? 400 : 600;
  const brushProgress = interpolate(frame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => {
      // Easing.inOut(Easing.cubic)
      const c = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return c;
    },
  });
  const strokeDashoffset = strokeLength * (1 - brushProgress);

  // Frames 12–26: Chapter number scales 0.7→1.0 and fades in
  const kanji_spring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 18, stiffness: 60 },
    from: 0.7,
    to: 1.0,
  });
  const kanjiFade = interpolate(frame, [12, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frames 20–34: Chapter title fades in and translates up 20px→0
  const titleFade = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleTranslate = interpolate(frame, [20, 34], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) * (1 - t), // Easing.out(Easing.quad)
  });

  // Colors
  const gold = "#C8963C";
  const crimson = "#C0143C";
  const washi = "#FDF6F0";
  const lacquer = "#3D0F1F";
  const voidColor = "#0D0508";
  const blush = "#F4B8C8";
  const mist = "#E8D5DF";

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const cx = W / 2;
  const cy = H / 2;

  // KamonCircle diameter
  const kamonDiam = p ? 420 : 560;
  const kamonR = kamonDiam / 2;

  // Petal rain
  const petalCount = 30;
  const intensity = 1.2;

  // Deterministic petal generator
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const petals = React.useMemo(() => {
    return Array.from({ length: petalCount }, (_, i) => {
      const rng = seededRandom(i * 7919 + 42);
      const startX = rng() * W;
      const radius = 8 + rng() * 18;
      const swayAmp = (12 + rng() * 28) * intensity;
      const swayFreq = 0.018 + rng() * 0.027;
      const rotSpeed = 0.4 + rng() * 1.8;
      const fallSpeed = 1.5 + rng() * 2.5;
      const startDelay = Math.floor(rng() * 60);
      const color = i % 2 === 0 ? blush : mist;
      const totalFrames = dur;
      return { startX, radius, swayAmp, swayFreq, rotSpeed, fallSpeed, startDelay, color, totalFrames };
    });
  }, [petalCount, dur, W]);

  // WashiBackground - dark variant
  const washiFiberId = `washi-fiber-dark-ct`;
  const washiGradId = `washi-grad-dark-ct`;
  const vignetteId = `washi-vignette-dark-ct`;

  // Seigaiha pattern
  const seigaihaId = `seigaiha-ct`;

  return (
    <AbsoluteFill style={{ background: voidColor, overflow: "hidden" }}>
      {/* Scene opacity wrapper for exit */}
      <AbsoluteFill style={{ opacity: exit }}>

        {/* WashiBackground - dark */}
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <radialGradient id={washiGradId} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor={lacquer} />
              <stop offset="100%" stopColor={voidColor} />
            </radialGradient>
            {/* Fiber lines */}
            <filter id={washiFiberId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" mode="overlay" />
            </filter>
            <radialGradient id={vignetteId} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.18" />
            </radialGradient>
          </defs>
          {/* Base gradient */}
          <rect width={W} height={H} fill={`url(#${washiGradId})`} />
          {/* Fiber texture */}
          {Array.from({ length: 18 }, (_, i) => {
            const rng = seededRandom(i * 31337);
            const x1 = rng() * W;
            const y1 = rng() * H;
            const angle = rng() * Math.PI;
            const len = 80 + rng() * 200;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x1 + Math.cos(angle) * len}
                y2={y1 + Math.sin(angle) * len}
                stroke="white"
                strokeWidth={0.5}
                opacity={0.07}
              />
            );
          })}
          {/* Vignette */}
          <rect width={W} height={H} fill={`url(#${vignetteId})`} />
        </svg>

        {/* SeigaihaPattern at opacity 0.06 */}
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", top: 0, left: 0, opacity: 0.06 }}
        >
          <defs>
            <pattern id={seigaihaId} x="0" y="0" width="60" height="40" patternUnits="userSpaceOnUse">
              {/* Classic seigaiha: overlapping ellipses */}
              <ellipse cx="30" cy="40" rx="30" ry="22" fill="none" stroke={washi} strokeWidth="1" />
              <ellipse cx="0" cy="40" rx="30" ry="22" fill="none" stroke={washi} strokeWidth="1" />
              <ellipse cx="60" cy="40" rx="30" ry="22" fill="none" stroke={washi} strokeWidth="1" />
              <ellipse cx="15" cy="20" rx="30" ry="22" fill="none" stroke={washi} strokeWidth="1" />
              <ellipse cx="45" cy="20" rx="30" ry="22" fill="none" stroke={washi} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#${seigaihaId})`} />
        </svg>

        {/* KamonCircle - centered, diameter 560px, opacity 0.10 */}
        <div
          style={{
            position: "absolute",
            top: cy - kamonR,
            left: cx - kamonR,
            width: kamonDiam,
            height: kamonDiam,
            opacity: kamonOpacityRaw * exit,
            transform: `scale(${kamonScale})`,
            transformOrigin: "center center",
          }}
        >
          <svg
            width={kamonDiam}
            height={kamonDiam}
            viewBox={`0 0 ${kamonDiam} ${kamonDiam}`}
          >
            {/* Outer ring */}
            <circle
              cx={kamonR}
              cy={kamonR}
              r={kamonR - 4}
              fill="none"
              stroke={gold}
              strokeWidth="2.5"
            />
            {/* Inner ring */}
            <circle
              cx={kamonR}
              cy={kamonR}
              r={kamonR * 0.72}
              fill="none"
              stroke={gold}
              strokeWidth="1.5"
            />
            {/* Three sakura flowers at 120° intervals on inner ring */}
            {[0, 120, 240].map((deg, idx) => {
              const rad = (deg - 90) * (Math.PI / 180);
              const flowerR = kamonR * 0.72;
              const fx = kamonR + flowerR * Math.cos(rad);
              const fy = kamonR + flowerR * Math.sin(rad);
              const pr = 7;
              return (
                <g key={idx} transform={`translate(${fx}, ${fy})`}>
                  {[0, 72, 144, 216, 288].map((pd, pi) => {
                    const prad = (pd - 90) * (Math.PI / 180);
                    return (
                      <ellipse
                        key={pi}
                        cx={Math.cos(prad) * pr * 0.6}
                        cy={Math.sin(prad) * pr * 0.6}
                        rx={pr * 0.45}
                        ry={pr * 0.28}
                        fill={gold}
                        opacity={0.9}
                        transform={`rotate(${pd}, ${Math.cos(prad) * pr * 0.6}, ${Math.sin(prad) * pr * 0.6})`}
                      />
                    );
                  })}
                  <circle cx={0} cy={0} r={2.5} fill={gold} />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Horizontal crimson brush-stroke line */}
        <svg
          width={strokeLength}
          height={12}
          viewBox={`0 0 ${strokeLength} 12`}
          style={{
            position: "absolute",
            top: cy - 6,
            left: cx - strokeLength / 2,
          }}
        >
          <line
            x1={0}
            y1={6}
            x2={strokeLength}
            y2={6}
            stroke={crimson}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={strokeLength}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        {/* Chapter number (kanji) - above the line */}
        <div
          style={{
            position: "absolute",
            top: cy - (p ? 160 : 140),
            left: 0,
            width: W,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: kanjiFade * exit,
            transform: `scale(${kanji_spring})`,
            transformOrigin: "center center",
          }}
        >
          <span
            style={{
              fontFamily: "Noto Serif JP, serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 80 : 96),
              color: gold,
              letterSpacing: "0.05em",
              textShadow: `0 0 40px rgba(200,150,60,0.4)`,
              lineHeight: 1,
            }}
          >
            {chapterNumber}
          </span>
        </div>

        {/* Chapter title (Roman) - below the line */}
        <div
          style={{
            position: "absolute",
            top: cy + (p ? 60 : 50),
            left: 0,
            width: W,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: titleFade * exit,
            transform: `translateY(${titleTranslate}px)`,
          }}
        >
          <span
            style={{
              fontFamily: "Noto Serif JP, serif",
              fontWeight: 700,
              fontSize: descriptionFontSize ?? (p ? 38 : 48),
              color: washi,
              letterSpacing: "0.12em",
              textAlign: "center",
              maxWidth: p ? 800 : 1200,
              lineHeight: 1.3,
            }}
          >
            {chapterTitle}
          </span>
        </div>

        {/* PetalRain - count=30, intensity=1.2 */}
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {petals.map((petal, i) => {
            const effectiveFrame = frame - petal.startDelay;
            if (effectiveFrame < 0) return null;

            const totalFallFrames = dur + 60;
            const progress = (effectiveFrame % totalFallFrames) / totalFallFrames;
            const y = progress * (H + petal.radius * 4) - petal.radius * 2;
            const x = petal.startX + Math.sin(effectiveFrame * petal.swayFreq * Math.PI * 2) * petal.swayAmp;
            const rotation = effectiveFrame * petal.rotSpeed;

            // Fade in over first 10%, fade out over last 15%
            let petalOpacity = 1;
            if (progress < 0.10) {
              petalOpacity = progress / 0.10;
            } else if (progress > 0.85) {
              petalOpacity = (1 - progress) / 0.15;
            }
            petalOpacity = Math.max(0, Math.min(1, petalOpacity)) * 0.75;

            const r = petal.radius;
            return (
              <g
                key={i}
                transform={`translate(${x}, ${y}) rotate(${rotation})`}
                opacity={petalOpacity}
              >
                {/* Five-petal sakura flower */}
                {[0, 72, 144, 216, 288].map((pd, pi) => {
                  const prad = (pd - 90) * (Math.PI / 180);
                  return (
                    <ellipse
                      key={pi}
                      cx={Math.cos(prad) * r * 0.55}
                      cy={Math.sin(prad) * r * 0.55}
                      rx={r * 0.5}
                      ry={r * 0.3}
                      fill={petal.color}
                      transform={`rotate(${pd}, ${Math.cos(prad) * r * 0.55}, ${Math.sin(prad) * r * 0.55})`}
                    />
                  );
                })}
                <circle cx={0} cy={0} r={r * 0.18} fill={petal.color} opacity={0.8} />
              </g>
            );
          })}
        </svg>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
