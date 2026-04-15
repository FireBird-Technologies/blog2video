import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicMetric: React.FC<MosaicLayoutProps> = ({
  title,
  metrics,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 18, 14);
  // Content starts when tiles are ≥55% done (frame 55)
  const contentStart = 55;
  const ringIn       = getStaggeredReveal(frame, contentStart,      18);
  const secondaryIn  = getStaggeredReveal(frame, contentStart + 10, 14);
  const tileEntry = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 16), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const list = metrics && metrics.length > 0 ? metrics.slice(0, 3) : [{ value: "97", label: title || "craft precision", suffix: "%" }];
  const first = list[0];
  const line = accentColor || MOSAIC_COLORS.gold;

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="metricField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={59}
        tileExitIntensity={mosaicIntensity ?? 27}
        tileExitPattern={mosaicPattern}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div
          style={{
            border: `1px solid ${line}88`,
            padding: "40px 70px",
            background: "rgba(234,228,218,0.94)",
            opacity: motion.presence,
            transform: `scale(${0.97 + ringIn * 0.03})`,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 860,
            }}
          >
            <TileWordSvg
              text={`${first.value}${first.suffix || ""}`}
              tileSize={mosaicTileSize ?? (titleFontSize ? Math.max(Math.floor(titleFontSize / 10), 9) : 14)}
              gap={mosaicTileGap ?? 1}
              revealProgress={ringIn}
              colors={["#C26240", "#D28B6C", "#C77D5A", "#B96E4E", "#2A2A28", "#6B645E"]}
              style={{ width: "100%", height: "auto", aspectRatio: "8 / 1.65" }}
            />
          </div>
          <div style={{ marginTop: 14, height: 1, background: `${line}` }} />
          <div
            style={{
              marginTop: 14,
              fontFamily: family,
              fontSize: descriptionFontSize ?? 32,
              color: MOSAIC_COLORS.textSecondary,
              fontStyle: "italic",
            }}
          >
            {first.label}
          </div>
          {list.length > 1 ? (
            <div style={{ marginTop: 30, display: "flex", gap: 48, justifyContent: "center" }}>
              {list.slice(1).map((metric, idx) => (
                <div key={`${metric.value}-${metric.label}`} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: family, fontSize: 40, color: MOSAIC_COLORS.gold, fontWeight: 700, opacity: secondaryIn * (1 - idx * 0.06) }}>
                    {metric.value}
                    {metric.suffix || ""}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: family, fontSize: 24, color: MOSAIC_COLORS.textSecondary, fontStyle: "italic", opacity: secondaryIn * (1 - idx * 0.06) }}>
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
