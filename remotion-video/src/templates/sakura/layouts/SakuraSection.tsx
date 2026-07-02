import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraSection: React.FC<SceneLayoutProps> = (props) => {
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

  const chapterKanji = (props as any).chapterKanji ?? "第一章";
  const chapterLabel = (props as any).chapterLabel ?? "Chapter One";
  const headline = (props as any).headline ?? title ?? "";
  const body = (props as any).body ?? narration ?? "";

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Tokens
  const blush = "#F4B8C8";
  const mist = "#E8D5DF";
  const deep = "#E8739A";
  const crimson = accentColor ?? "#C0143C";
  const ink = textColor ?? "#2A0A12";
  const washi = bgColor ?? "#FDF6F0";
  const parchment = "#F8EAE0";
  const gold = "#C8963C";

  const titlePx = titleFontSize ?? (p ? 48 : 56);
  const bodyPx = descriptionFontSize ?? (p ? 22 : 26);

  // Enter / exit
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  // Left column slide in: frames 0–10
  const leftX = interpolate(frame, [0, 10], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const leftOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Headline spring: frames 6–18
  const headlineSpring = spring({ frame: frame - 6, fps, config: { damping: 22, stiffness: 90 } });
  const headlineScale = interpolate(headlineSpring, [0, 1], [0.92, 1.0]);
  const headlineOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Petal divider: frames 14–26
  const dividerProgress = interpolate(frame, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dividerLength = 320;
  const dividerDash = dividerLength * (1 - dividerProgress);

  // Body text line-by-line: frames 20–40, stagger 4 frames per line
  const bodyLines = body ? body.split("\n").filter((l: string) => l.trim().length > 0) : [""];
  const getLineOpacity = (lineIndex: number) => {
    const start = 20 + lineIndex * 4;
    const end = start + 10;
    return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };

  // Right column: frames 8–22
  const rightX = interpolate(frame, [8, 22], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) * (1 - t),
  });
  const rightOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) * (1 - t),
  });

  // PetalRain
  const petalCount = 22;
  const petalIntensity = 0.7;

  const petals = React.useMemo(() => {
    const arr = [];
    const seed = 42;
    const pseudoRand = (n: number) => {
      const x = Math.sin(n * seed + 1.234) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < petalCount; i++) {
      const r = pseudoRand(i * 7 + 1);
      const r2 = pseudoRand(i * 7 + 2);
      const r3 = pseudoRand(i * 7 + 3);
      const r4 = pseudoRand(i * 7 + 4);
      const r5 = pseudoRand(i * 7 + 5);
      const r6 = pseudoRand(i * 7 + 6);
      const r7 = pseudoRand(i * 7 + 7);
      arr.push({
        x: r * width,
        radius: 8 + r2 * 18,
        color: i % 2 === 0 ? blush : mist,
        swayAmp: (12 + r3 * 28) * petalIntensity,
        swayFreq: 0.018 + r4 * 0.027,
        rotSpeed: 0.4 + r5 * 1.8,
        delay: r6 * 60,
        fallSpeed: 1.5 + r7 * 2.5,
      });
    }
    return arr;
  }, [width]);

  const PetalShape: React.FC<{ cx: number; cy: number; radius: number; color: string; rotation: number }> = ({
    cx, cy, radius, color, rotation,
  }) => {
    const petals5 = [0, 72, 144, 216, 288];
    return (
      <g transform={`translate(${cx},${cy}) rotate(${rotation})`}>
        {petals5.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const px = Math.cos(rad) * radius * 0.7;
          const py = Math.sin(rad) * radius * 0.7;
          return (
            <ellipse
              key={i}
              cx={px}
              cy={py}
              rx={radius * 0.45}
              ry={radius * 0.28}
              fill={color}
              transform={`rotate(${angle}, ${px}, ${py})`}
              opacity={0.85}
            />
          );
        })}
        <circle cx={0} cy={0} r={radius * 0.18} fill="#fff" opacity={0.6} />
      </g>
    );
  };

  const totalFallFrames = dur;

  // WashiBackground
  const WashiBackground = () => (
    <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <radialGradient id="washiGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={washi} />
          <stop offset="100%" stopColor={parchment} />
        </radialGradient>
        <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.18} />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#washiGrad)" />
      {/* Fiber lines */}
      {Array.from({ length: 30 }).map((_, i) => {
        const x1 = (i * 71.3) % width;
        const y1 = (i * 53.7) % height;
        const angle = (i * 37.1) % 180;
        const len = 80 + (i * 23) % 120;
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x1 + Math.cos(rad) * len}
            y2={y1 + Math.sin(rad) * len}
            stroke={ink}
            strokeWidth={0.5}
            opacity={0.07}
          />
        );
      })}
      <rect width={width} height={height} fill="url(#vignetteGrad)" />
    </svg>
  );

  // SeigaihaPattern
  const SeigaihaPattern = () => {
    const scaleW = 40;
    const scaleH = 26;
    const cols = Math.ceil(width / scaleW) + 1;
    const rows = Math.ceil(height / scaleH) + 1;
    const scales = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = row % 2 === 0 ? 0 : scaleW / 2;
        const cx = col * scaleW + offsetX;
        const cy = row * scaleH;
        scales.push({ cx, cy, key: `${row}-${col}` });
      }
    }
    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.04 }}
      >
        {scales.map(({ cx, cy, key }) => (
          <ellipse
            key={key}
            cx={cx}
            cy={cy}
            rx={scaleW * 0.55}
            ry={scaleH * 0.85}
            fill="none"
            stroke={crimson}
            strokeWidth={0.8}
          />
        ))}
      </svg>
    );
  };

  // Decorative SVG cherry blossom tree
  const DecorativeTree = () => (
    <svg width={360} height={460} viewBox="0 0 360 460" style={{ display: "block" }}>
      {/* Trunk */}
      <path
        d="M180 440 C178 400 172 370 168 340 C164 310 160 280 165 250 C170 220 175 200 180 180"
        stroke="#8B5E3C"
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
      />
      {/* Main branches */}
      <path d="M180 280 C160 260 130 240 100 220" stroke="#8B5E3C" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M180 260 C200 240 230 220 260 200" stroke="#8B5E3C" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M180 230 C165 210 145 190 120 170" stroke="#8B5E3C" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M180 220 C195 200 215 180 240 160" stroke="#8B5E3C" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M180 200 C170 175 160 155 155 130" stroke="#8B5E3C" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M180 195 C190 170 200 150 205 125" stroke="#8B5E3C" strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* Sub-branches */}
      <path d="M100 220 C85 205 70 195 55 185" stroke="#8B5E3C" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M100 220 C90 200 85 185 80 168" stroke="#8B5E3C" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M260 200 C275 185 290 175 305 165" stroke="#8B5E3C" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M260 200 C270 180 275 165 278 148" stroke="#8B5E3C" strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* Blossoms */}
      {[
        { cx: 55, cy: 182, r: 14, color: blush },
        { cx: 78, cy: 165, r: 12, color: mist },
        { cx: 100, cy: 215, r: 16, color: blush },
        { cx: 118, cy: 168, r: 13, color: deep },
        { cx: 120, cy: 145, r: 11, color: blush },
        { cx: 145, cy: 125, r: 15, color: mist },
        { cx: 155, cy: 105, r: 12, color: blush },
        { cx: 155, cy: 128, r: 10, color: deep },
        { cx: 180, cy: 175, r: 18, color: blush },
        { cx: 180, cy: 150, r: 14, color: mist },
        { cx: 180, cy: 125, r: 12, color: blush },
        { cx: 205, cy: 122, r: 15, color: deep },
        { cx: 205, cy: 100, r: 11, color: blush },
        { cx: 215, cy: 145, r: 13, color: mist },
        { cx: 240, cy: 157, r: 16, color: blush },
        { cx: 260, cy: 195, r: 17, color: mist },
        { cx: 278, cy: 145, r: 12, color: blush },
        { cx: 305, cy: 162, r: 14, color: deep },
        { cx: 90, cy: 195, r: 11, color: mist },
        { cx: 270, cy: 175, r: 11, color: blush },
        { cx: 165, cy: 248, r: 13, color: mist },
        { cx: 195, cy: 238, r: 12, color: blush },
        { cx: 135, cy: 195, r: 10, color: deep },
        { cx: 225, cy: 185, r: 10, color: mist },
        { cx: 170, cy: 200, r: 11, color: blush },
        { cx: 190, cy: 195, r: 10, color: deep },
        { cx: 108, cy: 240, r: 12, color: blush },
        { cx: 252, cy: 220, r: 12, color: mist },
        { cx: 160, cy: 170, r: 10, color: blush },
        { cx: 200, cy: 168, r: 10, color: mist },
      ].map((b, i) => {
        const petals5 = [0, 72, 144, 216, 288];
        const rot = (i * 23) % 360;
        return (
          <g key={i} transform={`translate(${b.cx},${b.cy}) rotate(${rot})`}>
            {petals5.map((angle, j) => {
              const rad = (angle * Math.PI) / 180;
              const px = Math.cos(rad) * b.r * 0.65;
              const py = Math.sin(rad) * b.r * 0.65;
              return (
                <ellipse
                  key={j}
                  cx={px}
                  cy={py}
                  rx={b.r * 0.48}
                  ry={b.r * 0.3}
                  fill={b.color}
                  transform={`rotate(${angle}, ${px}, ${py})`}
                  opacity={0.88}
                />
              );
            })}
            <circle cx={0} cy={0} r={b.r * 0.2} fill="#fff" opacity={0.55} />
          </g>
        );
      })}
    </svg>
  );

  // Image frame with petal ornaments at corners
  const ImageFrame = ({ children }: { children: React.ReactNode }) => (
    <div style={{ position: "relative", width: 360, height: 460 }}>
      {children}
      <svg
        width={360}
        height={460}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {/* Border */}
        <rect
          x={1}
          y={1}
          width={358}
          height={458}
          fill="none"
          stroke={crimson}
          strokeWidth={1.5}
          rx={4}
        />
        {/* Corner petal ornaments */}
        {[
          { cx: 0, cy: 0 },
          { cx: 360, cy: 0 },
          { cx: 0, cy: 460 },
          { cx: 360, cy: 460 },
        ].map((corner, i) => {
          const petals5 = [0, 72, 144, 216, 288];
          const r = 8;
          return (
            <g key={i} transform={`translate(${corner.cx},${corner.cy})`}>
              {petals5.map((angle, j) => {
                const rad = (angle * Math.PI) / 180;
                const px = Math.cos(rad) * r * 0.65;
                const py = Math.sin(rad) * r * 0.65;
                return (
                  <ellipse
                    key={j}
                    cx={px}
                    cy={py}
                    rx={r * 0.48}
                    ry={r * 0.3}
                    fill={crimson}
                    transform={`rotate(${angle}, ${px}, ${py})`}
                    opacity={0.8}
                  />
                );
              })}
              <circle cx={0} cy={0} r={r * 0.2} fill="#fff" opacity={0.5} />
            </g>
          );
        })}
      </svg>
    </div>
  );

  // Layout dimensions
  const leftColWidth = p ? width * 0.9 : 860;
  const rightColWidth = p ? width * 0.9 : 360;
  const leftPad = p ? 40 : 80;
  const rightPad = p ? 40 : 80;

  return (
    <AbsoluteFill style={{ background: washi, opacity: sceneOpacity, overflow: "hidden" }}>
      {/* Background layers */}
      <WashiBackground />
      <SeigaihaPattern />

      {/* PetalRain */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {petals.map((petal, i) => {
          const effectiveFrame = Math.max(0, frame - petal.delay);
          const totalH = height + petal.radius * 2;
          const y = ((effectiveFrame * petal.fallSpeed) % totalH) - petal.radius;
          const x = petal.x + Math.sin(effectiveFrame * petal.swayFreq * Math.PI * 2) * petal.swayAmp;
          const rotation = effectiveFrame * petal.rotSpeed;
          const progress = y / totalH;
          let alpha = 1;
          if (progress < 0.1) alpha = progress / 0.1;
          if (progress > 0.85) alpha = 1 - (progress - 0.85) / 0.15;
          alpha = Math.max(0, Math.min(1, alpha));
          if (effectiveFrame <= 0) return null;
          return (
            <g key={i} opacity={alpha}>
              <PetalShape cx={x} cy={y} radius={petal.radius} color={petal.color} rotation={rotation} />
            </g>
          );
        })}
      </svg>

      {/* Main layout */}
      {p ? (
        // Portrait: stacked
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 80,
          }}
        >
          {/* Left column */}
          <div
            style={{
              transform: `translateX(${leftX}px)`,
              opacity: leftOpacity,
              width: leftColWidth,
              paddingLeft: leftPad,
              paddingRight: leftPad,
              boxSizing: "border-box",
            }}
          >
            {/* Eyebrow row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  writingMode: "vertical-rl",
                  fontFamily: "Noto Serif JP, serif",
                  fontWeight: 400,
                  fontSize: 22,
                  color: crimson,
                  opacity: 0.7,
                  letterSpacing: "0.1em",
                  lineHeight: 1.4,
                }}
              >
                {chapterKanji}
              </div>
              <div
                style={{
                  fontFamily: "Shippori Mincho, serif",
                  fontWeight: 400,
                  fontSize: 18,
                  color: deep,
                  alignSelf: "flex-end",
                  letterSpacing: "0.05em",
                }}
              >
                {chapterLabel}
              </div>
            </div>

            {/* Headline */}
            <div
              style={{
                transform: `scale(${headlineScale})`,
                opacity: headlineOpacity,
                transformOrigin: "left center",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontFamily: "Noto Serif JP, serif",
                  fontWeight: 700,
                  fontSize: titleFontSize ?? (p ? 48 : 56),
                  color: ink,
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                {headline || title}
              </h2>
            </div>

            {/* Petal divider */}
            <div style={{ marginBottom: 24 }}>
              <svg width={dividerLength + 40} height={28} viewBox={`0 0 ${dividerLength + 40} 28`}>
                <line
                  x1={20}
                  y1={14}
                  x2={dividerLength + 20}
                  y2={14}
                  stroke={crimson}
                  strokeWidth={1.5}
                  strokeDasharray={dividerLength}
                  strokeDashoffset={dividerDash}
                />
                {/* Three petal ornaments on divider */}
                {[0.2, 0.5, 0.8].map((pos, i) => {
                  const cx = 20 + dividerLength * pos;
                  const petals5 = [0, 72, 144, 216, 288];
                  const r = 6;
                  return (
                    <g key={i} transform={`translate(${cx}, 14)`} opacity={dividerProgress}>
                      {petals5.map((angle, j) => {
                        const rad = (angle * Math.PI) / 180;
                        const px = Math.cos(rad) * r * 0.65;
                        const py = Math.sin(rad) * r * 0.65;
                        return (
                          <ellipse
                            key={j}
                            cx={px}
                            cy={py}
                            rx={r * 0.48}
                            ry={r * 0.3}
                            fill={crimson}
                            transform={`rotate(${angle}, ${px}, ${py})`}
                          />
                        );
                      })}
                      <circle cx={0} cy={0} r={r * 0.2} fill="#fff" opacity={0.6} />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Body text */}
            <div
              style={{
                fontFamily: "Shippori Mincho, serif",
                fontWeight: 400,
                fontSize: descriptionFontSize ?? (p ? 22 : 26),
                color: ink,
                lineHeight: 1.75,
              }}
            >
              {bodyLines.map((line: string, i: number) => (
                <p
                  key={i}
                  style={{
                    margin: "0 0 8px 0",
                    opacity: getLineOpacity(i),
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Right column (image or tree) — portrait: below */}
          <div
            style={{
              transform: `translateX(${rightX}px)`,
              opacity: rightOpacity,
              marginTop: 40,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {imageUrl ? (
              <ImageFrame>
                <div
                  style={{
                    width: 360,
                    height: 460,
                    borderRadius: 4,
                    overflow: "hidden",
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
              </ImageFrame>
            ) : (
              <DecorativeTree />
            )}
          </div>
        </div>
      ) : (
        // Landscape: two-column
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {/* Left column */}
          <div
            style={{
              width: leftColWidth,
              paddingLeft: leftPad,
              paddingRight: 60,
              boxSizing: "border-box",
              transform: `translateX(${leftX}px)`,
              opacity: leftOpacity,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Eyebrow row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  writingMode: "vertical-rl",
                  fontFamily: "Noto Serif JP, serif",
                  fontWeight: 400,
                  fontSize: 22,
                  color: crimson,
                  opacity: 0.7,
                  letterSpacing: "0.1em",
                  lineHeight: 1.4,
                }}
              >
                {chapterKanji}
              </div>
              <div
                style={{
                  fontFamily: "Shippori Mincho, serif",
                  fontWeight: 400,
                  fontSize: 18,
                  color: deep,
                  alignSelf: "flex-end",
                  letterSpacing: "0.05em",
                }}
              >
                {chapterLabel}
              </div>
            </div>

            {/* Headline */}
            <div
              style={{
                transform: `scale(${headlineScale})`,
                opacity: headlineOpacity,
                transformOrigin: "left center",
                marginBottom: 28,
              }}
            >
              <h2
                style={{
                  fontFamily: "Noto Serif JP, serif",
                  fontWeight: 700,
                  fontSize: titleFontSize ?? (p ? 48 : 56),
                  color: ink,
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                {headline || title}
              </h2>
            </div>

            {/* Petal divider */}
            <div style={{ marginBottom: 28 }}>
              <svg width={dividerLength + 40} height={28} viewBox={`0 0 ${dividerLength + 40} 28`}>
                <line
                  x1={20}
                  y1={14}
                  x2={dividerLength + 20}
                  y2={14}
                  stroke={crimson}
                  strokeWidth={1.5}
                  strokeDasharray={dividerLength}
                  strokeDashoffset={dividerDash}
                />
                {[0.2, 0.5, 0.8].map((pos, i) => {
                  const cx = 20 + dividerLength * pos;
                  const petals5 = [0, 72, 144, 216, 288];
                  const r = 6;
                  return (
                    <g key={i} transform={`translate(${cx}, 14)`} opacity={dividerProgress}>
                      {petals5.map((angle, j) => {
                        const rad = (angle * Math.PI) / 180;
                        const px = Math.cos(rad) * r * 0.65;
                        const py = Math.sin(rad) * r * 0.65;
                        return (
                          <ellipse
                            key={j}
                            cx={px}
                            cy={py}
                            rx={r * 0.48}
                            ry={r * 0.3}
                            fill={crimson}
                            transform={`rotate(${angle}, ${px}, ${py})`}
                          />
                        );
                      })}
                      <circle cx={0} cy={0} r={r * 0.2} fill="#fff" opacity={0.6} />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Body text */}
            <div
              style={{
                fontFamily: "Shippori Mincho, serif",
                fontWeight: 400,
                fontSize: descriptionFontSize ?? (p ? 22 : 26),
                color: ink,
                lineHeight: 1.75,
              }}
            >
              {bodyLines.map((line: string, i: number) => (
                <p
                  key={i}
                  style={{
                    margin: "0 0 8px 0",
                    opacity: getLineOpacity(i),
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div
            style={{
              width: rightColWidth,
              paddingRight: rightPad,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${rightX}px)`,
              opacity: rightOpacity,
              flexShrink: 0,
            }}
          >
            {imageUrl ? (
              <ImageFrame>
                <div
                  style={{
                    width: 360,
                    height: 460,
                    borderRadius: 4,
                    overflow: "hidden",
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
              </ImageFrame>
            ) : (
              <DecorativeTree />
            )}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
