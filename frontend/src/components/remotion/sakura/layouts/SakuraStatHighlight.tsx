import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraStatHighlight: React.FC<SceneLayoutProps> = (props) => {
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

  const stat = (props as any).stat ?? title ?? "0";
  const statLabel = (props as any).statLabel ?? "";
  const context = (props as any).context ?? narration ?? "";

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 140 : 180);
  const descriptionPx = descriptionFontSize ?? (p ? 28 : 32);

  // Scene exit
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stat scale + fade: frames 0–18
  const statSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 55 },
    from: 0.5,
    to: 1.0,
  });
  const statOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Count-up: frames 0–20
  const numericValue = parseFloat(stat.replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(numericValue) && stat.replace(/[^0-9.]/g, "").length > 0;
  const suffix = isNumeric ? stat.replace(/[0-9.,]/g, "") : "";
  const countProgress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const displayedStat = isNumeric
    ? Math.round(numericValue * countProgress).toLocaleString() + suffix
    : stat;

  // Gold underline draw: frames 14–26
  const underlineLength = 280;
  const underlineDash = interpolate(frame, [14, 26], [underlineLength, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Label fade + translate: frames 18–30
  const labelOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelTranslate = interpolate(frame, [18, 30], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Context fade + translate: frames 24–38
  const contextOpacity = interpolate(frame, [24, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contextTranslate = interpolate(frame, [24, 38], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Colors
  const crimson = accentColor ?? "#C0143C";
  const gold = "#C8963C";
  const washi = "#FDF6F0";
  const mist = "#E8D5DF";
  const lacquer = "#3D0F1F";
  const voidColor = "#0D0508";
  const blush = "#F4B8C8";

  // PetalRain deterministic petals
  const petalCount = 25;
  const intensity = 1.0;

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const petals = React.useMemo(() => {
    return Array.from({ length: petalCount }, (_, i) => {
      const rng = seededRandom(i * 7 + 42);
      const r1 = rng();
      const r2 = rng();
      const r3 = rng();
      const r4 = rng();
      const r5 = rng();
      const r6 = rng();
      const r7 = rng();
      const r8 = rng();
      const r9 = rng();
      const r10 = rng();
      return {
        x: r1 * width,
        radius: 8 + r2 * 18,
        color: i % 2 === 0 ? blush : mist,
        swayAmp: (12 + r3 * 28) * intensity,
        swayFreq: 0.018 + r4 * 0.027,
        rotSpeed: 0.4 + r5 * 1.8,
        delay: r6 * 60,
        fallDuration: 120 + r7 * 80,
        startY: -30 - r8 * 60,
        opacity: 0.5 + r9 * 0.5,
        rotOffset: r10 * 360,
      };
    });
  }, [width]);

  const petalElements = petals.map((petal, i) => {
    const effectiveFrame = frame - petal.delay;
    if (effectiveFrame < 0) return null;

    const progress = effectiveFrame / petal.fallDuration;
    if (progress > 1) return null;

    const y = petal.startY + progress * (height + 60);
    const x = petal.x + Math.sin(effectiveFrame * petal.swayFreq * Math.PI * 2) * petal.swayAmp;
    const rotation = petal.rotOffset + effectiveFrame * petal.rotSpeed;

    const fadeIn = interpolate(progress, [0, 0.1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(progress, [0.85, 1], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const petalOpacity = fadeIn * fadeOut * petal.opacity;

    const r = petal.radius;
    return (
      <g
        key={i}
        transform={`translate(${x}, ${y}) rotate(${rotation})`}
        opacity={petalOpacity}
      >
        {[0, 72, 144, 216, 288].map((angle, j) => {
          const rad = (angle * Math.PI) / 180;
          const px = Math.cos(rad) * r * 0.9;
          const py = Math.sin(rad) * r * 0.9;
          return (
            <ellipse
              key={j}
              cx={px * 0.5}
              cy={py * 0.5}
              rx={r * 0.45}
              ry={r * 0.28}
              fill={petal.color}
              transform={`rotate(${angle}, ${px * 0.5}, ${py * 0.5})`}
            />
          );
        })}
        <circle cx={0} cy={0} r={r * 0.15} fill={gold} opacity={0.6} />
      </g>
    );
  });

  // Seigaiha pattern
  const seigaihaScale = p ? 0.6 : 1;
  const seigaihaRows = 8;
  const seigaihaCols = 12;
  const sw = 80 * seigaihaScale;
  const sh = 50 * seigaihaScale;

  const seigaihaPath = Array.from({ length: seigaihaRows }, (_, row) =>
    Array.from({ length: seigaihaCols }, (_, col) => {
      const ox = col * sw + (row % 2 === 0 ? 0 : sw / 2);
      const oy = row * sh * 0.75;
      return `M ${ox} ${oy + sh} A ${sw / 2} ${sh} 0 0 1 ${ox + sw} ${oy + sh} Z`;
    })
  )
    .flat()
    .join(" ");

  // KamonCircle
  const kamonDiameter = p ? 320 : 460;
  const kamonR = kamonDiameter / 2;
  const kamonCx = width / 2;
  const kamonCy = height / 2;

  function sakuraPetal(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle * Math.PI) / 180;
    const px = cx + Math.cos(rad) * r * 0.55;
    const py = cy + Math.sin(rad) * r * 0.55;
    return [0, 72, 144, 216, 288]
      .map((a) => {
        const pr = ((a + angle) * Math.PI) / 180;
        const ex = px + Math.cos(pr) * r * 0.18;
        const ey = py + Math.sin(pr) * r * 0.18;
        return `M ${px} ${py} Q ${ex + Math.cos(pr + Math.PI / 2) * r * 0.1} ${ey + Math.sin(pr + Math.PI / 2) * r * 0.1} ${ex} ${ey}`;
      })
      .join(" ");
  }

  // Gold underline petal ornaments
  const underlineCenterX = width / 2;
  const underlineY = height * 0.45 + (p ? 90 : 110);

  return (
    <AbsoluteFill style={{ background: voidColor, overflow: "hidden" }}>
      {/* WashiBackground dark */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="washiDark" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor={lacquer} />
              <stop offset="100%" stopColor={voidColor} />
            </radialGradient>
            <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.18" />
            </radialGradient>
          </defs>
          <rect width={width} height={height} fill="url(#washiDark)" />
          {/* Fiber lines */}
          {Array.from({ length: 30 }, (_, i) => {
            const rng = seededRandom(i * 13 + 7);
            const x1 = rng() * width;
            const y1 = rng() * height;
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
          <rect width={width} height={height} fill="url(#vignetteGrad)" />
        </svg>
      </AbsoluteFill>

      {/* SeigaihaPattern */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <path d={seigaihaPath} fill="none" stroke={washi} strokeWidth={1} opacity={0.05} />
        </svg>
      </AbsoluteFill>

      {/* KamonCircle watermark */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <circle
            cx={kamonCx}
            cy={kamonCy}
            r={kamonR}
            fill="none"
            stroke={crimson}
            strokeWidth={2}
            opacity={0.08}
          />
          <circle
            cx={kamonCx}
            cy={kamonCy}
            r={kamonR * 0.85}
            fill="none"
            stroke={crimson}
            strokeWidth={1}
            opacity={0.08}
          />
          {[0, 120, 240].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const fx = kamonCx + Math.cos(rad) * kamonR * 0.85;
            const fy = kamonCy + Math.sin(rad) * kamonR * 0.85;
            return (
              <g key={i} opacity={0.08}>
                {[0, 72, 144, 216, 288].map((pa, j) => {
                  const pr = ((pa + angle) * Math.PI) / 180;
                  const pr2 = ((pa + angle + 36) * Math.PI) / 180;
                  const r1 = kamonR * 0.07;
                  const r2 = kamonR * 0.04;
                  return (
                    <ellipse
                      key={j}
                      cx={fx + Math.cos(pr) * r1}
                      cy={fy + Math.sin(pr) * r1}
                      rx={r2}
                      ry={r2 * 0.6}
                      fill={crimson}
                      transform={`rotate(${pa + angle}, ${fx + Math.cos(pr) * r1}, ${fy + Math.sin(pr) * r1})`}
                    />
                  );
                })}
                <circle cx={fx} cy={fy} r={kamonR * 0.015} fill={crimson} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* PetalRain */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {petalElements}
        </svg>
      </AbsoluteFill>

      {/* Main content */}
      <AbsoluteFill
        style={{
          opacity: exit,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Stat number */}
        <div
          style={{
            transform: `scale(${statSpring})`,
            opacity: statOpacity,
            position: "absolute",
            top: p ? "38%" : "40%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 140 : 180),
              color: crimson,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textShadow: `0 0 60px ${crimson}44, 0 2px 24px ${crimson}33`,
            }}
          >
            {displayedStat}
          </span>
        </div>

        {/* Gold underline with petal ornaments */}
        <div
          style={{
            position: "absolute",
            top: p ? "calc(38% + 160px)" : "calc(40% + 200px)",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <svg
            width={underlineLength + 60}
            height={30}
            viewBox={`0 0 ${underlineLength + 60} 30`}
          >
            {/* Main line */}
            <line
              x1={30}
              y1={15}
              x2={underlineLength + 30}
              y2={15}
              stroke={gold}
              strokeWidth={2}
              strokeDasharray={underlineLength}
              strokeDashoffset={underlineDash}
            />
            {/* Three petal ornaments */}
            {[0.25, 0.5, 0.75].map((pos, i) => {
              const cx = 30 + underlineLength * pos;
              const cy = 15;
              const pr = 5;
              const petalOpacity = interpolate(frame, [20, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <g key={i} opacity={petalOpacity}>
                  {[0, 72, 144, 216, 288].map((angle, j) => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <ellipse
                        key={j}
                        cx={cx + Math.cos(rad) * pr * 0.7}
                        cy={cy + Math.sin(rad) * pr * 0.7}
                        rx={pr * 0.5}
                        ry={pr * 0.3}
                        fill={gold}
                        transform={`rotate(${angle}, ${cx + Math.cos(rad) * pr * 0.7}, ${cy + Math.sin(rad) * pr * 0.7})`}
                      />
                    );
                  })}
                  <circle cx={cx} cy={cy} r={1.5} fill={gold} />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stat label */}
        <div
          style={{
            position: "absolute",
            top: p ? "calc(38% + 200px)" : "calc(40% + 240px)",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: labelOpacity,
            transform: `translateY(${labelTranslate}px)`,
          }}
        >
          <span
            style={{
              fontFamily: "'Shippori Mincho', serif",
              fontWeight: 400,
              fontSize: descriptionFontSize ?? (p ? 28 : 32),
              color: washi,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {statLabel}
          </span>
        </div>

        {/* Context sentence */}
        <div
          style={{
            position: "absolute",
            top: p ? "calc(38% + 250px)" : "calc(40% + 290px)",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: contextOpacity,
            transform: `translateY(${contextTranslate}px)`,
            padding: "0 40px",
          }}
        >
          <span
            style={{
              fontFamily: "'Shippori Mincho', serif",
              fontWeight: 400,
              fontSize: p ? 20 : 22,
              color: mist,
              maxWidth: p ? 560 : 720,
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            {context}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
