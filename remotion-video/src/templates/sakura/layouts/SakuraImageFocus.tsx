import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraImageFocus: React.FC<SceneLayoutProps> = (props) => {
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
  const caption = (props as any).caption ?? title ?? "";
  const subCaption = (props as any).subCaption ?? narration ?? "";

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 80 : 72);
  const descPx = descriptionFontSize ?? (p ? 38 : 32);

  // Scene-level exit
  const sceneOpacity = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Image slot: fade in + scale 0.96→1.0, frames 0–18 ---
  const imageScale = spring({
    frame,
    fps,
    from: 0.96,
    to: 1.0,
    config: { damping: 20, stiffness: 65 },
  });
  const imageOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Border frame: four edges draw clockwise, each starting 4 frames after previous ---
  // Top edge: frames 0–16
  // Right edge: frames 4–20
  // Bottom edge: frames 8–24
  // Left edge: frames 12–28

  const imgW = p ? 630 : 1120;
  const imgH = p ? 354 : 630;
  const perimeter = 2 * (imgW + imgH);
  const topLen = imgW;
  const rightLen = imgH;
  const bottomLen = imgW;
  const leftLen = imgH;

  const topProgress = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightProgress = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bottomProgress = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leftProgress = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Petal corner ornaments: scale 0→1, staggered 3 frames apart, frames 8–20 ---
  const cornerScales = [0, 3, 6, 9].map((offset) =>
    spring({
      frame: Math.max(0, frame - (8 + offset)),
      fps,
      from: 0,
      to: 1,
      config: { damping: 18, stiffness: 60 },
    })
  );

  // --- Caption: fade in + translate up 12px→0, frames 18–30 ---
  const captionOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionTranslate = interpolate(frame, [18, 30], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Sub-caption: fade in + translate up 8px→0, frames 24–36 ---
  const subCaptionOpacity = interpolate(frame, [24, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subCaptionTranslate = interpolate(frame, [24, 36], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Colors
  const crimson = accentColor ?? "#C0143C";
  const ink = textColor ?? "#2A0A12";
  const deep = "#E8739A";
  const blush = "#F4B8C8";
  const mist = "#E8D5DF";
  const washi = bgColor ?? "#FDF6F0";

  // PetalRain: 16 petals, intensity 0.55
  const petalCount = 16;
  const intensity = 0.55;

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const petals = Array.from({ length: petalCount }, (_, i) => {
    const rng = seededRandom(i * 137 + 42);
    const startX = rng() * width;
    const startDelay = Math.floor(rng() * 60);
    const radius = 8 + rng() * 18;
    const swayAmplitude = (12 + rng() * 28) * intensity;
    const swayFrequency = 0.018 + rng() * 0.027;
    const rotationSpeed = (0.4 + rng() * 1.8) * intensity;
    const fallDuration = 120 + rng() * 80;
    const color = i % 2 === 0 ? blush : mist;

    const effectiveFrame = frame - startDelay;
    if (effectiveFrame < 0) return null;

    const progress = effectiveFrame / fallDuration;
    if (progress > 1) return null;

    const y = progress * (height + radius * 2) - radius;
    const x = startX + Math.sin(effectiveFrame * swayFrequency * Math.PI * 2) * swayAmplitude;
    const rotation = effectiveFrame * rotationSpeed;

    // Fade in over first 10%, fade out over last 15%
    let opacity = 1;
    if (progress < 0.1) opacity = progress / 0.1;
    else if (progress > 0.85) opacity = (1 - progress) / 0.15;

    return { x, y, rotation, radius, color, opacity, key: i };
  }).filter(Boolean) as Array<{
    x: number;
    y: number;
    rotation: number;
    radius: number;
    color: string;
    opacity: number;
    key: number;
  }>;

  // Five-petal sakura SVG path for a single flower
  const SakuraPetal: React.FC<{ radius: number; color: string }> = ({ radius, color }) => {
    const r = radius;
    const petalPath = Array.from({ length: 5 }, (_, i) => {
      const angle = (i * 72 - 90) * (Math.PI / 180);
      const cx = Math.cos(angle) * r * 0.5;
      const cy = Math.sin(angle) * r * 0.5;
      const pr = r * 0.45;
      return `M 0 0 C ${cx - pr * 0.4} ${cy - pr * 0.4} ${cx + Math.cos(angle) * pr} ${cy + Math.sin(angle) * pr} 0 0`;
    }).join(" ");

    return (
      <g>
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const cx = Math.cos(angle) * r * 0.55;
          const cy = Math.sin(angle) * r * 0.55;
          return (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={r * 0.38}
              ry={r * 0.22}
              transform={`rotate(${i * 72 - 90}, ${cx}, ${cy})`}
              fill={color}
            />
          );
        })}
        <circle cx={0} cy={0} r={r * 0.18} fill="#FFF0F5" />
      </g>
    );
  };

  // Corner petal ornament SVG
  const CornerOrnament: React.FC<{ scale: number; flipX?: boolean; flipY?: boolean }> = ({
    scale,
    flipX,
    flipY,
  }) => {
    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;
    return (
      <svg
        width={40}
        height={40}
        viewBox="-20 -20 40 40"
        style={{ transform: `scale(${scale * sx}, ${scale * sy})`, transformOrigin: "center" }}
      >
        {/* Three small petals arranged in an L-shape corner */}
        <g opacity={0.9}>
          <ellipse cx={0} cy={-12} rx={5} ry={8} fill={crimson} opacity={0.8} />
          <ellipse cx={-12} cy={0} rx={8} ry={5} fill={crimson} opacity={0.8} />
          <ellipse cx={-8} cy={-8} rx={5} ry={5} fill={blush} opacity={0.9} />
          <circle cx={0} cy={0} r={3} fill={crimson} opacity={0.6} />
        </g>
      </svg>
    );
  };

  // WashiBackground
  const WashiBackground: React.FC = () => (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
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
      {/* Washi fiber lines */}
      {Array.from({ length: 30 }, (_, i) => {
        const rng = seededRandom(i * 31 + 7);
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
            stroke="#8B6060"
            strokeWidth={0.5}
            opacity={0.07}
          />
        );
      })}
      <rect width={width} height={height} fill="url(#vignetteGrad)" />
    </svg>
  );

  // SeigaihaPattern
  const SeigaihaPattern: React.FC = () => {
    const scaleX = p ? 630 : 1120;
    const scaleY = p ? 354 : 630;
    const cellW = 40;
    const cellH = 24;
    const cols = Math.ceil(width / cellW) + 1;
    const rows = Math.ceil(height / cellH) + 1;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.04 }}
      >
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const x = col * cellW - (row % 2 === 0 ? 0 : cellW / 2);
            const y = row * cellH * 0.75;
            return (
              <ellipse
                key={`${row}-${col}`}
                cx={x}
                cy={y}
                rx={cellW / 2}
                ry={cellH * 0.85}
                fill="none"
                stroke={ink}
                strokeWidth={0.8}
              />
            );
          })
        )}
      </svg>
    );
  };

  // Image dimensions
  const containerPadding = p ? 40 : 80;
  const imageWidth = p ? Math.min(width - containerPadding * 2, 630) : 1120;
  const imageHeight = p ? 354 : 630;

  // Border frame paths (clockwise: top, right, bottom, left)
  const bx = 0;
  const by = 0;
  const bw = imageWidth;
  const bh = imageHeight;

  return (
    <AbsoluteFill style={{ background: washi, opacity: sceneOpacity }}>
      {/* Background layers */}
      <WashiBackground />
      <SeigaihaPattern />

      {/* Petal Rain */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {petals.map((petal) => (
          <g
            key={petal.key}
            transform={`translate(${petal.x}, ${petal.y}) rotate(${petal.rotation})`}
            opacity={petal.opacity}
          >
            <SakuraPetal radius={petal.radius} color={petal.color} />
          </g>
        ))}
      </svg>

      {/* Main content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 24 : 32,
          padding: containerPadding,
        }}
      >
        {/* Image slot with border frame and corner ornaments */}
        <div
          style={{
            position: "relative",
            width: imageWidth,
            height: imageHeight,
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            transformOrigin: "center",
          }}
        >
          {/* Image */}
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imageObjectPosition ?? "50% 50%",
                transform: `scale(${imageZoom ?? 1})`,
                borderRadius: 4,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 4,
                background: `linear-gradient(135deg, #F4B8C8 0%, #E8D5DF 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "Shippori Mincho, serif",
                  fontSize: descriptionFontSize ?? (p ? 38 : 32),
                  color: ink,
                  opacity: 0.4,
                }}
              >
                画像
              </span>
            </div>
          )}

          {/* Crimson border frame — four animated SVG paths */}
          <svg
            width={imageWidth}
            height={imageHeight}
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              borderRadius: 4,
            }}
          >
            {/* Top edge: left→right */}
            <line
              x1={0}
              y1={0}
              x2={bw}
              y2={0}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={topLen}
              strokeDashoffset={topLen * (1 - topProgress)}
            />
            {/* Right edge: top→bottom */}
            <line
              x1={bw}
              y1={0}
              x2={bw}
              y2={bh}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={rightLen}
              strokeDashoffset={rightLen * (1 - rightProgress)}
            />
            {/* Bottom edge: right→left */}
            <line
              x1={bw}
              y1={bh}
              x2={0}
              y2={bh}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={bottomLen}
              strokeDashoffset={bottomLen * (1 - bottomProgress)}
            />
            {/* Left edge: bottom→top */}
            <line
              x1={0}
              y1={bh}
              x2={0}
              y2={0}
              stroke={crimson}
              strokeWidth={1.5}
              strokeDasharray={leftLen}
              strokeDashoffset={leftLen * (1 - leftProgress)}
            />
          </svg>

          {/* Corner ornaments */}
          {/* Top-left */}
          <div
            style={{
              position: "absolute",
              top: -20,
              left: -20,
              transformOrigin: "top left",
            }}
          >
            <CornerOrnament scale={cornerScales[0]} />
          </div>
          {/* Top-right */}
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              transformOrigin: "top right",
            }}
          >
            <CornerOrnament scale={cornerScales[1]} flipX />
          </div>
          {/* Bottom-left */}
          <div
            style={{
              position: "absolute",
              bottom: -20,
              left: -20,
              transformOrigin: "bottom left",
            }}
          >
            <CornerOrnament scale={cornerScales[2]} flipY />
          </div>
          {/* Bottom-right */}
          <div
            style={{
              position: "absolute",
              bottom: -20,
              right: -20,
              transformOrigin: "bottom right",
            }}
          >
            <CornerOrnament scale={cornerScales[3]} flipX flipY />
          </div>
        </div>

        {/* Caption */}
        {caption && (
          <div
            style={{
              opacity: captionOpacity,
              transform: `translateY(${captionTranslate}px)`,
              maxWidth: p ? width - containerPadding * 2 : 900,
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "Shippori Mincho, serif",
                fontSize: titleFontSize ?? (p ? 80 : 72),
                fontWeight: 400,
                color: ink,
                lineHeight: 1.5,
                display: "block",
              }}
            >
              {caption}
            </span>
          </div>
        )}

        {/* Sub-caption */}
        {subCaption && (
          <div
            style={{
              opacity: subCaptionOpacity,
              transform: `translateY(${subCaptionTranslate}px)`,
              maxWidth: p ? width - containerPadding * 2 : 900,
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "Shippori Mincho, serif",
                fontSize: descriptionFontSize ?? (p ? 38 : 32),
                fontWeight: 400,
                fontStyle: "italic",
                color: deep,
                lineHeight: 1.6,
                display: "block",
              }}
            >
              {subCaption}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
