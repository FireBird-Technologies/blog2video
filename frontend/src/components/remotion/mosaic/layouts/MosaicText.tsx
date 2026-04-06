import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicText: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
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
  const boxifyHold = 8;
  const breakFrames = 16;
  const rebuildStart = boxifyHold + breakFrames;
  const rebuildFrames = 42;
  const rebuildEnd = rebuildStart + rebuildFrames;
  const contentRevealStart = rebuildStart + Math.round(rebuildFrames * 0.7);
  const frameDraw = getStaggeredReveal(frame, contentRevealStart + 4, 20);
  const tileEntry = interpolate(frame, [rebuildStart, rebuildEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introTileBreak = interpolate(
    frame,
    [boxifyHold, boxifyHold + breakFrames, rebuildStart + 4],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneEndTileBreak = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tileExit = Math.max(introTileBreak, sceneEndTileBreak);
  const fullScreenCoverBuild = frame < rebuildStart ? 1 : tileEntry;
  const fullScreenCoverExit = frame < rebuildStart ? introTileBreak : 0;
  const fullScreenCoverOpacity = interpolate(
    frame,
    [rebuildEnd - 4, rebuildEnd + 14],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelIntro = interpolate(
    frame,
    [contentRevealStart, rebuildEnd + 16],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const highlight = (highlightPhrase || "").trim();
  const content =
    highlight && narration.includes(highlight)
      ? narration.replace(highlight, `__HL__${highlight}__HL__`)
      : narration;
  const parts = content.split("__HL__");

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="panelField"
        frameReveal={frameDraw}
        frameDrift={motion.entry}
        tileBuildProgress={tileEntry}
        tileEntryPattern="diagonal"
        tileEntryIntensity={20}
        tileExitProgress={tileExit}
        tileExitSeed={23}
        tileExitIntensity={24}
      />
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="coverField"
        opacity={fullScreenCoverOpacity}
        frameReveal={0}
        frameDrift={0}
        tileBuildProgress={fullScreenCoverBuild}
        tileEntryPattern="diagonal"
        tileEntryIntensity={20}
        tileExitProgress={fullScreenCoverExit}
        tileExitSeed={71}
        tileExitIntensity={22}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 10%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1120,
            border: "1px solid #243848",
            background: "rgba(17, 24, 32, 0.88)",
            padding: "42px 52px",
            position: "relative",
            opacity: panelIntro * motion.exit,
            transform: `translateY(${(1 - panelIntro) * 12}px) scale(${0.94 + panelIntro * 0.06})`,
            filter: `blur(${(1 - panelIntro) * 2 + (1 - motion.exit) * 1.8}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 8,
              border: "1px solid #1E3040",
              pointerEvents: "none",
              opacity: frameDraw * motion.exit,
            }}
          />
          <div
            style={{
              color: "#3A6070",
              fontFamily: family,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontSize: 14,
              marginBottom: 18,
            }}
          >
            Stone Text Layout
          </div>
          <div
            style={{
              fontFamily: family,
              fontSize: titleFontSize ?? 38,
              color: textColor || "#C49858",
              lineHeight: 1.5,
            }}
          >
            {parts.map((part, idx) =>
              idx % 2 === 1 ? (
                <span key={`hl-${idx}`} style={{ color: "#E0B870", fontWeight: 700 }}>
                  {part}
                </span>
              ) : (
                <span key={`tx-${idx}`}>{part}</span>
              ),
            )}
          </div>
          <div style={{ height: 1, margin: "24px 0", background: "#1E3040" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div
                style={{
                  fontFamily: family,
                  fontSize: 12,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#3A6070",
                }}
              >
                Material
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: family,
                  fontStyle: "italic",
                  fontSize: descriptionFontSize ?? 24,
                  color: "#7A9E90",
                }}
              >
                Marble, limestone, smalti glass
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: family,
                  fontSize: 12,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#3A6070",
                }}
              >
                Period
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: family,
                  fontStyle: "italic",
                  fontSize: descriptionFontSize ?? 24,
                  color: "#7A9E90",
                }}
              >
                2nd century to present day
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
