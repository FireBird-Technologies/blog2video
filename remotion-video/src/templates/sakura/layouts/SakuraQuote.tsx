import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  SoftPetal,
  PetalDivider,
  hexToRgba,
  sakuraRand,
} from "../sakuraStyle";

export const SakuraQuote: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const quote = (props as any).quote ?? title ?? "";
  const quoteRoman = (props as any).quoteRoman ?? "";
  const quoteTranslation = (props as any).quoteTranslation ?? narration ?? "";
  const attribution = (props as any).attribution ?? "";

  const quotePx = titleFontSize ?? (p ? 84 : 96);
  const translationPx = descriptionFontSize ?? (p ? 30 : 26);

  // Concentric rings expand out (cubic-out)
  const circleScale = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Staggered reveals
  const quoteReveal = interpolate(frame, [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const romanReveal = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translationReveal = interpolate(frame, [30, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const attributionReveal = interpolate(frame, [44, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;
  const ringRadii = p ? [520, 390, 260] : [480, 360, 240];
  const ringOps = [0.12, 0.08, 0.06];
  const ringColors = [SAKURA.blush, SAKURA.gold, SAKURA.blush];

  // Petal strips top + bottom: staggered fade with a slow horizontal drift
  const stripCount = p ? 12 : 20;
  const strip = (yPos: number, dirSign: number, seedBase: number) => (
    <svg
      width={width}
      height={44}
      viewBox={`0 0 ${width} 44`}
      style={{ position: "absolute", top: yPos, left: 0, pointerEvents: "none" }}
    >
      {Array.from({ length: stripCount }, (_, i) => {
        const appear = interpolate(frame, [8 + i * 1.5, 20 + i * 1.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const drift = Math.sin(frame * 0.02 + i) * 6 * dirSign;
        return (
          <SoftPetal
            key={i}
            cx={(i + 0.5) * (width / stripCount) + drift}
            cy={22}
            r={9 + sakuraRand(seedBase + i, 1) * 3}
            rotation={i * 23 * dirSign}
            color={i % 2 === 0 ? SAKURA.blush : SAKURA.mist}
            opacity={0.6 * appear}
          />
        );
      })}
    </svg>
  );

  return (
    <SakuraScene
      backdrop="celebration"
      entranceLayout="sakura_quote"
      bgColor={bgColor}
      dur={dur}
      petals={p ? 26 : 40}
      petalIntensity={1.2}
      petalSeed={23}
      chrome={
        <>
          {/* Expanding concentric rings */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {ringRadii.map((r, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r * circleScale}
                fill="none"
                stroke={ringColors[i]}
                strokeWidth={1.2 - i * 0.3}
                opacity={ringOps[i]}
              />
            ))}
            {/* Giant ghost kanji backdrop */}
            <text
              x={cx}
              y={cy + (p ? 220 : 180)}
              textAnchor="middle"
              fontFamily={SAKURA_DISPLAY_FONT}
              fontSize={p ? 420 : 560}
              fill={SAKURA.blush}
              opacity={0.03}
            >
              桜
            </text>
          </svg>
          {strip(p ? 90 : 26, 1, 51)}
          {strip(height - (p ? 130 : 70), -1, 87)}
        </>
      }
    >
      {/* Quote content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "160px 90px" : "100px 200px",
        }}
      >
        {/* Main quote */}
        <div
          style={{
            fontFamily: SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: quotePx,
            color: SAKURA.blush,
            letterSpacing: "0.14em",
            lineHeight: 1.25,
            textShadow: `0 0 60px ${hexToRgba(SAKURA.blush, 0.3)}`,
            opacity: quoteReveal,
            transform: `scale(${0.9 + 0.1 * quoteReveal})`,
            marginBottom: 30,
          }}
        >
          {quote}
        </div>

        {/* Romanized reading in angle brackets */}
        {quoteRoman ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 24 : 22,
              color: SAKURA.gold,
              letterSpacing: "0.5em",
              opacity: romanReveal,
              marginBottom: 30,
            }}
          >
            《&nbsp;&nbsp;{quoteRoman}&nbsp;&nbsp;》
          </div>
        ) : null}

        {/* line — blossom — line divider */}
        <div style={{ marginBottom: 28 }}>
          <PetalDivider
            width={p ? 380 : 500}
            flowerR={12}
            startFrame={22}
            durationFrames={16}
          />
        </div>

        {/* Translation */}
        <div
          style={{
            fontFamily: SAKURA_BODY_FONT,
            fontStyle: "italic",
            fontSize: translationPx,
            color: SAKURA.washi,
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            maxWidth: p ? 800 : 900,
            opacity: translationReveal * 0.9,
            transform: `translateY(${(1 - translationReveal) * 18}px)`,
          }}
        >
          “{quoteTranslation}”
        </div>

        {/* Attribution */}
        {attribution ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 18 : 15,
              color: hexToRgba(SAKURA.washi, 0.32),
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              marginTop: 34,
              opacity: attributionReveal,
            }}
          >
            — {attribution}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
