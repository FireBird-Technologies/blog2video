import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  KamonWatermark,
  SoftPetal,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraListScene: React.FC<SceneLayoutProps> = (props) => {
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
  const { width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const headline = (props as any).headline ?? title ?? "";
  const rawItems: string[] = (props as any).items ?? [];
  const items = rawItems.length > 0 ? rawItems.slice(0, 6) : narration ? [narration] : [];

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 54 : 52);
  const itemPx = descriptionFontSize ?? (p ? 30 : 26);

  // Headline reveal
  const headlineReveal = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Per-item stagger: bullet blossom blooms, then text slides in
  const itemStart = (i: number) => 12 + i * 8;
  const bulletProgress = (i: number) =>
    interpolate(frame, [itemStart(i), itemStart(i) + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 2),
    });
  const textProgress = (i: number) =>
    interpolate(frame, [itemStart(i) + 5, itemStart(i) + 17], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 2),
    });

  // Connector line draws down the bullet column
  const lineProgress = interpolate(
    frame,
    [16, 16 + items.length * 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bulletR = p ? 15 : 13;
  const rowGap = p ? 42 : 34;

  return (
    <SakuraScene
      backdrop="ink_corner"
      entranceLayout="sakura_list_scene"
      bgColor={bgColor}
      accentColor={crimson}
      side="right"
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.55}
      petalSeed={67}
      petalsBehind
      chrome={
        <KamonWatermark
          cx={width - (p ? 110 : 200)}
          cy={height / 2}
          r={p ? 90 : 150}
          color={crimson}
          opacity={0.06}
        />
      }
    >
      {/* Left rail composition: list occupies the left ~55%, kamon breathes on the right */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: p ? "140px 90px" : "100px 120px",
          maxWidth: p ? "100%" : "62%",
          boxSizing: "border-box",
        }}
      >
        {/* Headline */}
        {headline ? (
          <h1
            style={{
              fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: titlePx,
              color: ink,
              lineHeight: 1.18,
              margin: `0 0 ${p ? 20 : 16}px 0`,
              opacity: headlineReveal,
              transform: `translateY(${(1 - headlineReveal) * 18}px)`,
            }}
          >
            {headline}
          </h1>
        ) : null}

        {/* Crimson underline */}
        <svg width={170} height={20} viewBox="0 0 170 20" style={{ overflow: "visible", marginBottom: p ? 46 : 40 }}>
          <line x1={0} y1={10} x2={118 * headlineReveal} y2={10} stroke={crimson} strokeWidth={2.5} />
          <SoftPetal cx={136} cy={10} r={9} color={crimson} bloomProgress={headlineReveal} />
        </svg>

        {/* Items with blooming bullet blossoms and connector line */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: rowGap }}>
          {/* Connector line behind bullets */}
          <div
            style={{
              position: "absolute",
              left: bulletR,
              top: bulletR,
              width: 1.5,
              height: `calc(${lineProgress * 100}% - ${bulletR * 2}px)`,
              background: `linear-gradient(to bottom, ${hexToRgba(crimson, 0.45)}, ${hexToRgba(SAKURA.deepBlush, 0.25)})`,
            }}
          />
          {items.map((item, i) => {
            const bp = bulletProgress(i);
            const tp = textProgress(i);
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: p ? 26 : 24 }}>
                <svg
                  width={bulletR * 2 + 4}
                  height={bulletR * 2 + 4}
                  viewBox={`0 0 ${bulletR * 2 + 4} ${bulletR * 2 + 4}`}
                  style={{ overflow: "visible", flexShrink: 0, marginTop: 2 }}
                >
                  <SoftPetal
                    cx={bulletR + 2}
                    cy={bulletR + 2}
                    r={bulletR}
                    rotation={i * 36}
                    color={i % 2 === 0 ? SAKURA.deepBlush : SAKURA.blush}
                    centerColor={i % 2 === 0 ? SAKURA.blush : SAKURA.deepBlush}
                    bloomProgress={bp}
                  />
                </svg>
                <div
                  style={{
                    fontFamily: SAKURA_BODY_FONT,
                    fontSize: itemPx,
                    color: hexToRgba(ink, 0.82),
                    lineHeight: 1.55,
                    opacity: tp,
                    transform: `translateX(${(1 - tp) * 22}px)`,
                    paddingTop: 2,
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SakuraScene>
  );
};
