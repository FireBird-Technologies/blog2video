import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  CornerBrackets,
  hexToRgba,
} from "../sakuraStyle";

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
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const caption = (props as any).caption ?? title ?? "";
  const subCaption = (props as any).subCaption ?? narration ?? "";
  const eyebrow = (props as any).eyebrow ?? "";

  const crimson = accentColor || SAKURA.crimson;

  const captionPx = titleFontSize ?? (p ? 56 : 52);
  const subPx = descriptionFontSize ?? (p ? 28 : 24);

  // Image reveal + slow Ken Burns
  const imageSpring = spring({ frame, fps, from: 0.96, to: 1, config: { damping: 20, stiffness: 65 } });
  const imageOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kenBurns = interpolate(frame, [0, dur], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated crimson border draw (four edges, staggered)
  const imgW = p ? 720 : 1120;
  const imgH = p ? 900 : 620;
  const edge = (start: number, len: number) =>
    len *
    (1 -
      interpolate(frame, [start, start + 16], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));

  // Caption reveals
  const eyebrowReveal = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionReveal = interpolate(frame, [24, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const subReveal = interpolate(frame, [34, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  return (
    <SakuraScene
      backdrop="full_bleed_mat"
      entranceLayout="sakura_image_focus"
      bgColor={bgColor}
      dur={dur}
      petals={p ? 6 : 8}
      petalIntensity={0.7}
      petalSeed={83}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 40 : 36,
          padding: p ? "120px 80px" : "70px 120px",
          boxSizing: "border-box",
        }}
      >
        {/* Image with mist mat, Ken Burns, drawn border + corner brackets */}
        <div
          style={{
            position: "relative",
            width: imgW,
            maxWidth: "100%",
            height: imgH,
            maxHeight: p ? "62%" : "70%",
            backgroundColor: SAKURA.mist,
            padding: 14,
            boxSizing: "border-box",
            opacity: imageOpacity,
            transform: `scale(${imageSpring})`,
          }}
        >
          <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            {imageUrl ? (
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: imageObjectPosition ?? "50% 50%",
                  transform: `scale(${(imageZoom ?? 1) * kenBurns})`,
                }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: hexToRgba(SAKURA.plum, 1) }} />
            )}
          </div>

          {/* Crimson border draw overlay */}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${imgW} ${imgH}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <line x1={0} y1={2} x2={imgW} y2={2} stroke={crimson} strokeWidth={4} strokeDasharray={imgW} strokeDashoffset={edge(0, imgW)} />
            <line x1={imgW - 2} y1={0} x2={imgW - 2} y2={imgH} stroke={crimson} strokeWidth={4} strokeDasharray={imgH} strokeDashoffset={edge(4, imgH)} />
            <line x1={imgW} y1={imgH - 2} x2={0} y2={imgH - 2} stroke={crimson} strokeWidth={4} strokeDasharray={imgW} strokeDashoffset={edge(8, imgW)} />
            <line x1={2} y1={imgH} x2={2} y2={0} stroke={crimson} strokeWidth={4} strokeDasharray={imgH} strokeDashoffset={edge(12, imgH)} />
          </svg>

          <CornerBrackets topColor={crimson} bottomColor={SAKURA.deepBlush} startFrame={16} />
        </div>

        {/* Captions */}
        <div style={{ textAlign: "center", maxWidth: p ? 800 : 1000 }}>
          {eyebrow ? (
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontSize: p ? 18 : 15,
                color: SAKURA.gold,
                letterSpacing: "0.5em",
                textTransform: "uppercase",
                textIndent: "0.5em",
                marginBottom: 14,
                opacity: eyebrowReveal,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          {caption ? (
            <div
              style={{
                fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
                fontWeight: 700,
                fontSize: captionPx,
                color: SAKURA.washi,
                lineHeight: 1.2,
                opacity: captionReveal,
                transform: `translateY(${(1 - captionReveal) * 14}px)`,
                marginBottom: subCaption ? 14 : 0,
              }}
            >
              {caption}
            </div>
          ) : null}
          {subCaption ? (
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontStyle: "italic",
                fontSize: subPx,
                color: hexToRgba(SAKURA.washi, 0.75),
                lineHeight: 1.55,
                opacity: subReveal,
                transform: `translateY(${(1 - subReveal) * 12}px)`,
              }}
            >
              {subCaption}
            </div>
          ) : null}
        </div>
      </div>
    </SakuraScene>
  );
};
