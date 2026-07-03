import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  KamonWatermark,
  SoftPetal,
  hexToRgba,
  sakuraRand,
} from "../sakuraStyle";

export const SakuraChapterTransition: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    accentColor,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const chapterNumber = (props as any).chapterNumber ?? "";
  const chapterTitle = (props as any).chapterTitle ?? title ?? "";
  const accent = accentColor || SAKURA.crimson;

  const numberPx = titleFontSize ?? (p ? 200 : 260);
  const titlePx = descriptionFontSize ?? (p ? 40 : 52);

  const cx = width / 2;
  const cy = height / 2;

  // Big kanji numeral blooms in
  const numberSpring = spring({ frame, fps, config: { damping: 16, stiffness: 55 }, from: 0.6, to: 1 });
  const numberOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chapter title reveal
  const titleReveal = interpolate(frame, [26, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Horizontal petal current crossing mid-scene
  const currentProgress = interpolate(frame, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const currentPetals = Array.from({ length: p ? 8 : 12 }, (_, i) => {
    const s = 40 + i * 19.3;
    const lane = sakuraRand(s, 1);
    const y = cy - (p ? 40 : 30) + (lane - 0.5) * (p ? 260 : 180);
    const speed = 0.7 + sakuraRand(s, 2) * 0.6;
    const phase = sakuraRand(s, 3);
    const x = ((currentProgress * speed + phase) % 1.2) * (width + 200) - 100;
    const r = 12 + sakuraRand(s, 4) * 16;
    return { x, y: y + Math.sin(frame * 0.05 + i) * 18, r, rot: frame * (1 + sakuraRand(s, 5) * 2) + i * 40, i };
  });

  return (
    <SakuraScene
      backdrop="vertical_band"
      entranceLayout="sakura_chapter_transition"
      bgColor={bgColor}
      accentColor={accent}
      side="left"
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.9}
      petalSeed={44}
      chrome={
        <>
          {/* Kamon watermark, pushed to the right, off-center */}
          <KamonWatermark cx={width - (p ? 200 : 340)} cy={cy} r={p ? 300 : 260} color={SAKURA.gold} opacity={0.06} />
          {/* Horizontal petal current */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {currentPetals.map((c) => (
              <SoftPetal
                key={c.i}
                cx={c.x}
                cy={c.y}
                r={c.r}
                rotation={c.rot}
                color={c.i % 2 === 0 ? SAKURA.blush : SAKURA.mist}
                opacity={0.4}
              />
            ))}
          </svg>
        </>
      }
    >
      {/* Asymmetric: giant vertical kanji numeral on the band side,
          roman chapter title stacked beside it. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: p ? 40 : 80,
          padding: p ? "0 70px 0 90px" : "0 160px 0 160px",
        }}
      >
        {/* Big chapter numeral */}
        {chapterNumber ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: numberPx,
              color: SAKURA.blush,
              lineHeight: 0.92,
              letterSpacing: "0.02em",
              textShadow: `0 0 80px ${hexToRgba(SAKURA.blush, 0.35)}`,
              opacity: numberOpacity,
              transform: `scale(${numberSpring})`,
              flexShrink: 0,
            }}
          >
            {chapterNumber}
          </div>
        ) : null}

        {/* Title column: vertical rule + eyebrow + roman title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 3,
              background: accent,
              opacity: interpolate(titleReveal, [0, 1], [0, 1]),
              transformOrigin: "left",
              transform: `scaleX(${titleReveal})`,
            }}
          />
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 16 : 15,
              color: SAKURA.gold,
              letterSpacing: "0.5em",
              textTransform: "uppercase",
              opacity: titleReveal,
            }}
          >
            {(props as any).chapterLabel ?? "Chapter"}
          </div>
          {chapterTitle ? (
            <div
              style={{
                fontFamily: SAKURA_DISPLAY_FONT,
                fontWeight: 700,
                fontSize: titlePx,
                color: SAKURA.washi,
                letterSpacing: "0.02em",
                lineHeight: 1.15,
                maxWidth: p ? 500 : 640,
                opacity: titleReveal,
                transform: `translateY(${(1 - titleReveal) * 16}px)`,
              }}
            >
              {chapterTitle}
            </div>
          ) : null}
        </div>
      </div>
    </SakuraScene>
  );
};
