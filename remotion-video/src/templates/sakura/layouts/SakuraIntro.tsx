import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  KamonWatermark,
  CornerBlossoms,
  SplitBrushLines,
  PetalDivider,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraIntro: React.FC<SceneLayoutProps> = (props) => {
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
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const kanjiTitle = (props as any).kanjiTitle ?? title ?? "桜";
  const romanTitle = (props as any).romanTitle ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const author = (props as any).author ?? "";

  const titlePx = titleFontSize ?? (p ? 150 : 190);
  const taglinePx = descriptionFontSize ?? (p ? 34 : 30);

  // Kanji blooms in
  const kanjiSpring = spring({ frame, fps, config: { damping: 18, stiffness: 60 } });
  const kanjiScale = interpolate(kanjiSpring, [0, 1], [0.6, 1]);
  const kanjiOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gold roman title
  const romanReveal = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Tagline
  const taglineReveal = interpolate(frame, [32, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Author byline
  const authorReveal = interpolate(frame, [50, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;

  return (
    <SakuraScene
      backdrop="plum_radial"
      entranceLayout="sakura_intro"
      bgColor={bgColor}
      dur={dur}
      petals={p ? 24 : 35}
      petalIntensity={1.4}
      petalSeed={42}
      chrome={
        <>
          {/* Twin kamon watermark rings */}
          <KamonWatermark cx={cx} cy={cy} r={p ? 380 : 260} color={SAKURA.gold} opacity={0.07} />
          <KamonWatermark cx={cx} cy={cy} r={p ? 280 : 190} color={SAKURA.blush} opacity={0.05} spin={-0.02} />
          <CornerBlossoms scale={p ? 0.9 : 1} />
        </>
      }
    >
      {/* Centered title stack */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "140px 70px" : "80px 160px",
        }}
      >
        {/* Kanji title */}
        <div
          style={{
            fontFamily: SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: SAKURA.blush,
            lineHeight: 1.05,
            letterSpacing: "0.05em",
            textShadow: `0 0 80px ${hexToRgba(SAKURA.blush, 0.4)}, 0 4px 32px ${hexToRgba(SAKURA.crimson, 0.3)}`,
            transform: `scale(${kanjiScale})`,
            opacity: kanjiOpacity,
            marginBottom: 18,
          }}
        >
          {kanjiTitle}
        </div>

        {/* Split crimson brush lines */}
        <div style={{ marginBottom: 22 }}>
          <SplitBrushLines width={p ? 420 : 520} startFrame={10} durationFrames={20} />
        </div>

        {/* Gold letter-spaced roman title */}
        {romanTitle ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 26 : 24,
              color: SAKURA.gold,
              letterSpacing: "0.75em",
              textTransform: "uppercase",
              textIndent: "0.75em",
              opacity: romanReveal,
              transform: `translateY(${(1 - romanReveal) * 16}px)`,
              marginBottom: 26,
            }}
          >
            {romanTitle}
          </div>
        ) : null}

        {/* line — blossom — line divider */}
        <div style={{ marginBottom: 26 }}>
          <PetalDivider width={p ? 320 : 380} startFrame={24} durationFrames={14} />
        </div>

        {/* Italic tagline */}
        {tagline ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontStyle: "italic",
              fontSize: taglinePx,
              color: SAKURA.washi,
              letterSpacing: "0.14em",
              lineHeight: 1.5,
              maxWidth: p ? 820 : 1000,
              opacity: taglineReveal * 0.92,
              transform: `translateY(${(1 - taglineReveal) * 14}px)`,
            }}
          >
            {tagline}
          </div>
        ) : null}

        {/* Faint author byline */}
        {author ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 18 : 15,
              color: hexToRgba(SAKURA.washi, 0.32),
              letterSpacing: "0.6em",
              textTransform: "uppercase",
              textIndent: "0.6em",
              marginTop: 44,
              opacity: authorReveal,
            }}
          >
            {author}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
