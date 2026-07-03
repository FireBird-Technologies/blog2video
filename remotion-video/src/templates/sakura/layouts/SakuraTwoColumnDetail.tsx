import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  KamonWatermark,
  SoftPetal,
  CornerBrackets,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraTwoColumnDetail: React.FC<SceneLayoutProps> = (props) => {
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
  const { width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const leftHeadline = (props as any).leftHeadline ?? title ?? "";
  const leftBody = (props as any).leftBody ?? narration ?? "";
  const rightHeadline = (props as any).rightHeadline ?? "";
  const rightBody = (props as any).rightBody ?? "";

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 42 : 44);
  const bodyPx = descriptionFontSize ?? (p ? 24 : 22);

  // Column slide-ins
  const leftProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const rightProgress = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Center brush divider draws down, blossom blooms at midpoint
  const dividerProgress = interpolate(frame, [6, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  const column = (
    headlineText: string,
    bodyText: string,
    progress: number,
    slideDir: number,
    eyebrowText: string,
  ) => (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        opacity: progress,
        transform: p
          ? `translateY(${(1 - progress) * 30}px)`
          : `translateX(${(1 - progress) * 50 * slideDir}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {eyebrowText ? (
        <div
          style={{
            fontFamily: SAKURA_BODY_FONT,
            fontSize: p ? 17 : 14,
            color: SAKURA.gold,
            letterSpacing: "0.5em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          {eyebrowText}
        </div>
      ) : null}
      <h2
        style={{
          fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
          fontWeight: 700,
          fontSize: titlePx,
          color: ink,
          lineHeight: 1.2,
          margin: "0 0 18px 0",
        }}
      >
        {headlineText}
      </h2>
      <svg width={120} height={20} viewBox="0 0 120 20" style={{ overflow: "visible", marginBottom: 20 }}>
        <line x1={0} y1={10} x2={78 * progress} y2={10} stroke={crimson} strokeWidth={2} />
        <SoftPetal cx={94} cy={10} r={8} color={crimson} bloomProgress={progress} />
      </svg>
      <p
        style={{
          fontFamily: SAKURA_BODY_FONT,
          fontSize: bodyPx,
          color: hexToRgba(ink, 0.75),
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        {bodyText}
      </p>
    </div>
  );

  const imageColumn = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: rightProgress,
        transform: p
          ? `translateY(${(1 - rightProgress) * 30}px)`
          : `translateX(${(1 - rightProgress) * 50}px)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: p ? 760 : 640,
          height: p ? 520 : 560,
          backgroundColor: SAKURA.mist,
          padding: 14,
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <Img
            src={imageUrl!}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imageObjectPosition ?? "50% 50%",
              transform: `scale(${imageZoom ?? 1})`,
            }}
          />
        </div>
        <CornerBrackets topColor={crimson} bottomColor={SAKURA.deepBlush} />
      </div>
    </div>
  );

  const dividerLen = p ? width - 260 : height - 320;

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_two_column_detail"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.55}
      petalSeed={31}
      petalsBehind
      chrome={
        <KamonWatermark cx={p ? 110 : 140} cy={height - (p ? 120 : 130)} r={p ? 80 : 100} color={crimson} opacity={0.07} />
      }
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "stretch",
          gap: p ? 44 : 70,
          padding: p ? "140px 90px" : "110px 130px",
          boxSizing: "border-box",
        }}
      >
        {column(leftHeadline, leftBody, leftProgress, -1, "")}

        {/* Center brush divider with blossom at midpoint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {p ? (
            <svg width={dividerLen} height={26} viewBox={`0 0 ${dividerLen} 26`} style={{ overflow: "visible" }}>
              <line
                x1={dividerLen / 2}
                y1={13}
                x2={dividerLen / 2 - (dividerLen / 2) * dividerProgress}
                y2={13}
                stroke={hexToRgba(crimson, 0.5)}
                strokeWidth={1.5}
              />
              <line
                x1={dividerLen / 2}
                y1={13}
                x2={dividerLen / 2 + (dividerLen / 2) * dividerProgress}
                y2={13}
                stroke={hexToRgba(crimson, 0.5)}
                strokeWidth={1.5}
              />
              <SoftPetal cx={dividerLen / 2} cy={13} r={11} color={SAKURA.deepBlush} bloomProgress={dividerProgress} />
            </svg>
          ) : (
            <svg width={26} height={dividerLen} viewBox={`0 0 26 ${dividerLen}`} style={{ overflow: "visible" }}>
              <line
                x1={13}
                y1={0}
                x2={13}
                y2={(dividerLen / 2) * dividerProgress}
                stroke={hexToRgba(crimson, 0.5)}
                strokeWidth={1.5}
              />
              <line
                x1={13}
                y1={dividerLen}
                x2={13}
                y2={dividerLen - (dividerLen / 2) * dividerProgress}
                stroke={hexToRgba(crimson, 0.5)}
                strokeWidth={1.5}
              />
              <SoftPetal cx={13} cy={dividerLen / 2} r={11} color={SAKURA.deepBlush} bloomProgress={dividerProgress} />
            </svg>
          )}
        </div>

        {imageUrl
          ? imageColumn
          : column(rightHeadline, rightBody, rightProgress, 1, "")}
      </div>
    </SakuraScene>
  );
};
