import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraEndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
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

  const brandName = (props as any).brandName ?? title ?? "Brand Name";
  const tagline = (props as any).tagline ?? narration ?? "Your tagline here";
  const ctaText = (props as any).ctaText ?? "Follow us for more";
  const websiteUrl = (props as any).websiteUrl ?? "www.example.com";
  const socialHandles: string[] = (props as any).socialHandles ?? [];

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Typography
  const titlePx = titleFontSize ?? (p ? 80 : 72);
  const descPx = descriptionFontSize ?? (p ? 38 : 32);

  // Colors
  const washi = "#FDF6F0";
  const mist = "#E8D5DF";
  const crimson = "#C0143C";
  const lacquer = "#3D0F1F";
  const gold = "#C8963C";
  const blush = "#F4B8C8";
  const ink = "#2A0A12";

  // Exit transition
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Radial petal burst (frames 0–20) ──────────────────────────────────────
  const burstRadius = interpolate(frame, [0, 20], [0, 380], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3), // Easing.out(Easing.cubic)
  });
  const burstOpacity = interpolate(frame, [0, 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Brand name (frames 0–16) ──────────────────────────────────────────────
  const brandScale = spring({ frame, fps, from: 0.6, to: 1.0, config: { damping: 18, stiffness: 60 } });
  const brandOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Tagline (frames 12–24) ────────────────────────────────────────────────
  const taglineOpacity = interpolate(frame, [12, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [12, 24], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA box border draw (frames 18–32) ────────────────────────────────────
  // Box dimensions
  const boxW = p ? 480 : 560;
  const boxH = 120;
  const boxPerimeter = 2 * (boxW + boxH);

  // Each edge: top, right, bottom, left — 4-frame stagger
  const edgeLength = [boxW, boxH, boxW, boxH];
  const edgeOffsets = [18, 22, 26, 30];

  const getEdgeDash = (edgeIdx: number) => {
    const len = edgeLength[edgeIdx];
    const start = edgeOffsets[edgeIdx];
    const end = start + 14;
    const progress = interpolate(frame, [start, end], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      strokeDasharray: len,
      strokeDashoffset: len * (1 - progress),
    };
  };

  // Box fill opacity (frames 18–32)
  const boxFillOpacity = interpolate(frame, [18, 32], [0, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA petal corner ornaments (frames 20–32, staggered 3 frames) ─────────
  const petalCornerScale = (idx: number) => {
    const start = 20 + idx * 3;
    return spring({ frame: Math.max(0, frame - start), fps, from: 0, to: 1, config: { damping: 18, stiffness: 60 } });
  };

  // ── CTA text (frames 26–38) ───────────────────────────────────────────────
  const ctaOpacity = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaY = interpolate(frame, [26, 38], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Website URL (frames 32–44) ────────────────────────────────────────────
  const urlOpacity = interpolate(frame, [32, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlLetterSpacing = interpolate(frame, [32, 44], [0.05, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── PetalRain helper ──────────────────────────────────────────────────────
  const petalCount = 35;
  const petalIntensity = 1.5;

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  };

  const renderPetalRain = () => {
    return Array.from({ length: petalCount }, (_, i) => {
      const seed = i * 7;
      const r1 = seededRandom(seed);
      const r2 = seededRandom(seed + 1);
      const r3 = seededRandom(seed + 2);
      const r4 = seededRandom(seed + 3);
      const r5 = seededRandom(seed + 4);
      const r6 = seededRandom(seed + 5);
      const r7 = seededRandom(seed + 6);

      const radius = 8 + r1 * 18;
      const startX = r2 * width;
      const delay = r3 * 60;
      const amplitude = (12 + r4 * 28) * petalIntensity;
      const frequency = 0.018 + r5 * 0.027;
      const rotSpeed = (0.4 + r6 * 1.8) * petalIntensity;
      const color = i % 2 === 0 ? blush : mist;
      const fallDuration = dur - delay;

      const localFrame = Math.max(0, frame - delay);
      const progress = localFrame / Math.max(1, fallDuration);

      if (frame < delay) return null;

      const y = progress * (height + radius * 2) - radius;
      const x = startX + Math.sin(localFrame * frequency * Math.PI * 2) * amplitude;
      const rotation = localFrame * rotSpeed;

      let opacity = 1;
      if (progress < 0.1) opacity = progress / 0.1;
      else if (progress > 0.85) opacity = 1 - (progress - 0.85) / 0.15;

      return (
        <g
          key={i}
          transform={`translate(${x}, ${y}) rotate(${rotation})`}
          opacity={opacity * exit}
        >
          {Array.from({ length: 5 }, (_, pi) => {
            const angle = (pi * 72 * Math.PI) / 180;
            const px = Math.cos(angle) * radius * 0.5;
            const py = Math.sin(angle) * radius * 0.5;
            return (
              <ellipse
                key={pi}
                cx={px}
                cy={py}
                rx={radius * 0.38}
                ry={radius * 0.22}
                fill={color}
                transform={`rotate(${pi * 72}, ${px}, ${py})`}
              />
            );
          })}
          <circle cx={0} cy={0} r={radius * 0.15} fill={blush} opacity={0.6} />
        </g>
      );
    });
  };

  // ── WashiBackground (dark variant) ───────────────────────────────────────
  const renderWashiBackground = () => (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="washiDark" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={lacquer} />
          <stop offset="100%" stopColor="#0D0508" />
        </radialGradient>
        <radialGradient id="vigDark" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.18} />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#washiDark)" />
      {/* Fiber lines */}
      {Array.from({ length: 28 }, (_, i) => {
        const sr = seededRandom(i * 3 + 100);
        const sr2 = seededRandom(i * 3 + 101);
        const sr3 = seededRandom(i * 3 + 102);
        const angle = sr * 180;
        const x1 = sr2 * width;
        const y1 = sr3 * height;
        const len = 80 + sr * 200;
        const x2 = x1 + Math.cos((angle * Math.PI) / 180) * len;
        const y2 = y1 + Math.sin((angle * Math.PI) / 180) * len;
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="white"
            strokeWidth={0.5}
            opacity={0.07}
          />
        );
      })}
      <rect width={width} height={height} fill="url(#vigDark)" />
    </svg>
  );

  // ── SeigaihaPattern ───────────────────────────────────────────────────────
  const renderSeigaiha = () => {
    const scaleW = 60;
    const scaleH = 40;
    const cols = Math.ceil(width / scaleW) + 1;
    const rows = Math.ceil(height / scaleH) + 1;
    const scales = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * scaleW - (row % 2 === 1 ? scaleW / 2 : 0);
        const y = row * scaleH * 0.65;
        scales.push(
          <ellipse
            key={`${row}-${col}`}
            cx={x}
            cy={y}
            rx={scaleW * 0.52}
            ry={scaleH * 0.75}
            fill="none"
            stroke={washi}
            strokeWidth={0.8}
          />
        );
      }
    }
    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      >
        {scales}
      </svg>
    );
  };

  // ── KamonCircle ───────────────────────────────────────────────────────────
  const renderKamon = () => {
    const cx = width / 2;
    const cy = height / 2;
    const d = 500;
    const r = d / 2;
    const innerR = r * 0.78;
    const petalPositions = [0, 120, 240];

    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0.09 }}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={crimson} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={crimson} strokeWidth={1.5} />
        {petalPositions.map((angleDeg, i) => {
          const angle = (angleDeg * Math.PI) / 180;
          const px = cx + Math.cos(angle - Math.PI / 2) * innerR;
          const py = cy + Math.sin(angle - Math.PI / 2) * innerR;
          return (
            <g key={i} transform={`translate(${px}, ${py})`}>
              {Array.from({ length: 5 }, (_, pi) => {
                const pa = (pi * 72 * Math.PI) / 180;
                return (
                  <ellipse
                    key={pi}
                    cx={Math.cos(pa) * 10}
                    cy={Math.sin(pa) * 10}
                    rx={5}
                    ry={3}
                    fill={crimson}
                    transform={`rotate(${pi * 72}, ${Math.cos(pa) * 10}, ${Math.sin(pa) * 10})`}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  // ── Radial petal burst ────────────────────────────────────────────────────
  const renderPetalBurst = () => {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 16 }, (_, i) => {
          const angleDeg = i * 22.5;
          const angle = (angleDeg * Math.PI) / 180;
          const px = cx + Math.cos(angle) * burstRadius;
          const py = cy + Math.sin(angle) * burstRadius;
          return (
            <g key={i} transform={`translate(${px}, ${py}) rotate(${angleDeg})`} opacity={burstOpacity}>
              {Array.from({ length: 5 }, (_, pi) => {
                const pa = (pi * 72 * Math.PI) / 180;
                return (
                  <ellipse
                    key={pi}
                    cx={Math.cos(pa) * 9}
                    cy={Math.sin(pa) * 9}
                    rx={5}
                    ry={3}
                    fill={blush}
                    transform={`rotate(${pi * 72}, ${Math.cos(pa) * 9}, ${Math.sin(pa) * 9})`}
                  />
                );
              })}
              <circle cx={0} cy={0} r={3} fill={mist} />
            </g>
          );
        })}
      </svg>
    );
  };

  // ── Small petal SVG ornament ──────────────────────────────────────────────
  const PetalOrnament: React.FC<{ scale: number }> = ({ scale: s }) => (
    <svg width={20} height={20} viewBox="-10 -10 20 20" style={{ transform: `scale(${s})` }}>
      {Array.from({ length: 5 }, (_, pi) => {
        const pa = (pi * 72 * Math.PI) / 180;
        return (
          <ellipse
            key={pi}
            cx={Math.cos(pa) * 5}
            cy={Math.sin(pa) * 5}
            rx={3.5}
            ry={2}
            fill={crimson}
            transform={`rotate(${pi * 72}, ${Math.cos(pa) * 5}, ${Math.sin(pa) * 5})`}
          />
        );
      })}
      <circle cx={0} cy={0} r={2} fill={blush} />
    </svg>
  );

  // ── CTA Box border paths ──────────────────────────────────────────────────
  const renderCtaBorder = () => {
    const bx = (width - boxW) / 2;
    const by = height * 0.58 - boxH / 2;
    const r4 = 4;

    // Four edges as separate paths for staggered draw
    const topDash = getEdgeDash(0);
    const rightDash = getEdgeDash(1);
    const bottomDash = getEdgeDash(2);
    const leftDash = getEdgeDash(3);

    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {/* Box fill */}
        <rect
          x={bx}
          y={by}
          width={boxW}
          height={boxH}
          rx={r4}
          fill={lacquer}
          opacity={boxFillOpacity}
        />
        {/* Top edge */}
        <line
          x1={bx + r4} y1={by}
          x2={bx + boxW - r4} y2={by}
          stroke={crimson}
          strokeWidth={1.5}
          strokeDasharray={topDash.strokeDasharray}
          strokeDashoffset={topDash.strokeDashoffset}
        />
        {/* Right edge */}
        <line
          x1={bx + boxW} y1={by + r4}
          x2={bx + boxW} y2={by + boxH - r4}
          stroke={crimson}
          strokeWidth={1.5}
          strokeDasharray={rightDash.strokeDasharray}
          strokeDashoffset={rightDash.strokeDashoffset}
        />
        {/* Bottom edge */}
        <line
          x1={bx + boxW - r4} y1={by + boxH}
          x2={bx + r4} y2={by + boxH}
          stroke={crimson}
          strokeWidth={1.5}
          strokeDasharray={bottomDash.strokeDasharray}
          strokeDashoffset={bottomDash.strokeDashoffset}
        />
        {/* Left edge */}
        <line
          x1={bx} y1={by + boxH - r4}
          x2={bx} y2={by + r4}
          stroke={crimson}
          strokeWidth={1.5}
          strokeDasharray={leftDash.strokeDasharray}
          strokeDashoffset={leftDash.strokeDashoffset}
        />
      </svg>
    );
  };

  const boxTop = height * 0.58 - boxH / 2;
  const boxLeft = (width - boxW) / 2;

  return (
    <AbsoluteFill style={{ background: bgColor ?? "#0D0508", overflow: "hidden" }}>
      {/* WashiBackground dark */}
      {renderWashiBackground()}

      {/* SeigaihaPattern */}
      {renderSeigaiha()}

      {/* KamonCircle */}
      {renderKamon()}

      {/* PetalRain */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {renderPetalRain()}
      </svg>

      {/* Radial petal burst */}
      {renderPetalBurst()}

      {/* Brand name */}
      <div
        style={{
          position: "absolute",
          top: `${height * 0.36 - titlePx / 2}px`,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: brandOpacity * exit,
          transform: `scale(${brandScale})`,
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontWeight: 700,
            fontSize: titleFontSize ?? (p ? 80 : 72),
            color: washi,
            textAlign: "center",
            letterSpacing: "0.05em",
          }}
        >
          {brandName}
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          top: `${height * 0.36 + titlePx / 2 + 20}px`,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: taglineOpacity * exit,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontWeight: 400,
            fontSize: descriptionFontSize ?? (p ? 38 : 32),
            color: mist,
            textAlign: "center",
            letterSpacing: "0.08em",
          }}
        >
          {tagline}
        </span>
      </div>

      {/* CTA Box border (SVG) */}
      <div style={{ opacity: exit }}>
        {renderCtaBorder()}
      </div>

      {/* CTA petal corner ornaments */}
      {[
        { top: boxTop - 10, left: boxLeft - 10 },
        { top: boxTop - 10, left: boxLeft + boxW - 10 },
        { top: boxTop + boxH - 10, left: boxLeft - 10 },
        { top: boxTop + boxH - 10, left: boxLeft + boxW - 10 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            opacity: exit,
            transformOrigin: "center",
          }}
        >
          <PetalOrnament scale={petalCornerScale(i)} />
        </div>
      ))}

      {/* CTA text */}
      <div
        style={{
          position: "absolute",
          top: boxTop,
          left: boxLeft,
          width: boxW,
          height: boxH,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: ctaOpacity * exit,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontWeight: 500,
            fontSize: 30,
            color: washi,
            textAlign: "center",
            letterSpacing: "0.06em",
          }}
        >
          {ctaText}
        </span>
      </div>

      {/* Website URL */}
      <div
        style={{
          position: "absolute",
          top: `${height * 0.76}px`,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: urlOpacity * exit,
        }}
      >
        <span
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontWeight: 400,
            fontSize: 22,
            color: gold,
            letterSpacing: `${urlLetterSpacing}em`,
            textAlign: "center",
          }}
        >
          {websiteUrl}
        </span>
      </div>

      {/* Social handles */}
      {socialHandles.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: `${height * 0.76 + 40}px`,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 32,
            opacity: urlOpacity * exit,
          }}
        >
          {socialHandles.map((handle, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Shippori Mincho', serif",
                fontWeight: 400,
                fontSize: 18,
                color: mist,
                letterSpacing: "0.1em",
              }}
            >
              {handle}
            </span>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
