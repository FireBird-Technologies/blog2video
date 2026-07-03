import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  KamonWatermark,
  BrushUnderline,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraTextNarration: React.FC<SceneLayoutProps> = (props) => {
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
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const eyebrow = (props as any).eyebrow ?? "";
  const headline = (props as any).headline ?? title ?? "";
  const body = (props as any).body ?? narration ?? "";

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 60 : 58);
  const bodyPx = descriptionFontSize ?? (p ? 28 : 24);

  // Eyebrow
  const eyebrowReveal = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline spring
  const headlineSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 18, stiffness: 60 },
  });
  const headlineOpacity = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Body
  const bodyReveal = interpolate(frame, [22, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_text_narration"
      bgColor={bgColor}
      accentColor={crimson}
      side="right"
      dur={dur}
      petals={p ? 9 : 12}
      petalIntensity={0.5}
      petalSeed={77}
      petalsBehind
      chrome={
        <KamonWatermark
          cx={p ? width / 2 : width * 0.74}
          cy={height / 2}
          r={p ? 420 : 360}
          color={crimson}
          opacity={0.045}
        />
      }
    >
      {/* Off-center: headline block anchored left, not centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: p ? "center" : "flex-start",
          justifyContent: "center",
          textAlign: p ? "center" : "left",
          padding: p ? "160px 90px" : "110px 130px",
          maxWidth: p ? "100%" : "64%",
          boxSizing: "border-box",
        }}
      >
        {/* Eyebrow */}
        {eyebrow ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 20 : 17,
              color: SAKURA.gold,
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              textIndent: "0.55em",
              marginBottom: 26,
              opacity: eyebrowReveal,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        {/* Headline */}
        <h1
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: ink,
            lineHeight: 1.2,
            margin: "0 0 26px 0",
            opacity: headlineOpacity,
            transform: `scale(${interpolate(headlineSpring, [0, 1], [0.94, 1])})`,
          }}
        >
          {headline}
        </h1>

        {/* Brush underline */}
        <div style={{ marginBottom: 32 }}>
          <BrushUnderline width={p ? 220 : 260} color={crimson} startFrame={14} durationFrames={14} />
        </div>

        {/* Body */}
        <p
          style={{
            fontFamily: SAKURA_BODY_FONT,
            fontSize: bodyPx,
            color: hexToRgba(ink, 0.78),
            lineHeight: 1.8,
            letterSpacing: "0.01em",
            maxWidth: p ? 820 : 1000,
            margin: 0,
            opacity: bodyReveal,
            transform: `translateY(${(1 - bodyReveal) * 16}px)`,
          }}
        >
          {body}
        </p>
      </div>
    </SakuraScene>
  );
};
