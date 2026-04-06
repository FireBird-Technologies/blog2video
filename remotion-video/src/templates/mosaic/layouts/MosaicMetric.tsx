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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 18, 14);
  const ringIn = getStaggeredReveal(frame, 2, 14);
  const secondaryIn = getStaggeredReveal(frame, 16, 12);
  const tileEntry = interpolate(frame, [0, 24], [0, 1], {
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
        frameReveal={ringIn * motion.exit}
        frameDrift={motion.entry}
        tileBuildProgress={tileEntry}
        tileEntryPattern="diagonal"
        tileEntryIntensity={22}
        tileExitProgress={tileExit}
        tileExitSeed={59}
        tileExitIntensity={27}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div
          style={{
            border: `1px solid ${line}88`,
            padding: "26px 46px",
            background: "rgba(7,18,33,0.7)",
            opacity: motion.presence,
            transform: `scale(${0.97 + ringIn * 0.03})`,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
            }}
          >
            <TileWordSvg
              text={`${first.value}${first.suffix || ""}`}
              tileSize={titleFontSize ? Math.max(Math.floor(titleFontSize / 10), 9) : 12}
              gap={1}
              revealProgress={ringIn}
              colors={["#E0B870", "#DAA040", "#C87828", "#C84828", "#D06030", "#5A9090", "#4A7880"]}
              style={{ width: "100%", height: "auto", aspectRatio: "8 / 1.65" }}
            />
          </div>
          <div style={{ marginTop: 10, height: 1, background: `${line}` }} />
          <div
            style={{
              marginTop: 10,
              fontFamily: family,
              fontSize: descriptionFontSize ?? 24,
              color: MOSAIC_COLORS.textSecondary,
              fontStyle: "italic",
            }}
          >
            {first.label}
          </div>
          {list.length > 1 ? (
            <div style={{ marginTop: 22, display: "flex", gap: 34, justifyContent: "center" }}>
              {list.slice(1).map((metric, idx) => (
                <div key={`${metric.value}-${metric.label}`} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: family, fontSize: 30, color: "#C84828", fontWeight: 700, opacity: secondaryIn * (1 - idx * 0.06) }}>
                    {metric.value}
                    {metric.suffix || ""}
                  </div>
                  <div style={{ marginTop: 4, fontFamily: family, fontSize: 18, color: "#3A6070", fontStyle: "italic", opacity: secondaryIn * (1 - idx * 0.06) }}>
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
