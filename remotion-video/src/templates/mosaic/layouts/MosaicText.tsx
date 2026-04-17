import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground, bgTilePalette } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MosaicTiledText } from "../MosaicTiledText";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicText: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  imageUrl,
  highlightPhrase,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  aspectRatio,
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 18, 14);
  const boxifyHold = 8;
  const breakFrames = 16;
  const rebuildStart = boxifyHold + breakFrames;
  const rebuildFrames = 130;
  const rebuildEnd = rebuildStart + rebuildFrames;
  const contentRevealStart = rebuildStart + Math.round(rebuildFrames * 0.6);
  const tileEntry = interpolate(frame, [rebuildStart, rebuildEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const frameDraw = tileEntry;
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
  const sweepIn = interpolate(
    frame,
    [contentRevealStart - 8, contentRevealStart + 44],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const p = aspectRatio === "portrait";
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const tp = bgTilePalette(bgColor || MOSAIC_COLORS.deepNavy);
  const panelBg = tp[1] + "F2";     // near-lightest tile stop, 95% opacity
  const panelBorder = tp[6] + "60"; // mid-palette stop, ~38% opacity
  const dividerColor = tp[8] + "55"; // slightly deeper, 33% opacity
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
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "diagonal"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={23}
        tileExitIntensity={mosaicIntensity ?? 24}
        tileExitPattern={mosaicPattern ?? "diagonal"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <div style={{ position: "absolute", inset: 0, opacity: fullScreenCoverOpacity, pointerEvents: "none" }}>
        <MosaicBackground
          bgColor={bgColor}
          accentColor={accentColor}
          variant="coverField"
          frameReveal={0}
          frameDrift={0}
          tileBuildProgress={fullScreenCoverBuild}
          tileEntryPattern="ltr"
          tileEntryIntensity={mosaicIntensity ?? 11}
          tileExitProgress={fullScreenCoverExit}
          tileExitSeed={71}
          tileExitIntensity={mosaicIntensity ?? 22}
          tileGridSize={mosaicTileSize}
          tileGridGap={mosaicTileGap}
        />
      </div>

      {/* ── Image panel — left 46%, revealed tile-by-tile left-to-right ── */}
      {imageUrl && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "46%", height: "100%", zIndex: 1 }}>
          <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <MosaicImageReveal
              imageUrl={imageUrl}
              revealProgress={tileEntry}
              clarityProgress={panelIntro}
              pattern={mosaicPattern ?? "diagonal"}
              intensity={mosaicIntensity ?? 13}
              style={{ opacity: motion.exit }}
              overlay={
                <div
                  style={{
                    position: "absolute",
                    top: 0, bottom: 0, right: 0,
                    width: 3,
                    background: accentColor || MOSAIC_COLORS.gold,
                    opacity: panelIntro * motion.exit,
                  }}
                />
              }
            />
          </div>
        </div>
      )}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: imageUrl ? "0 5% 0 48%" : "0 10%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1120,
            border: `1px solid ${panelBorder}`,
            background: panelBg,
            padding: "42px 52px",
            position: "relative",
            opacity: panelIntro * motion.exit,
            transform: `translateY(${(1 - panelIntro) * 12}px) scale(${0.94 + panelIntro * 0.06})`,
            filter: `blur(${(1 - panelIntro) * 2 + (1 - motion.exit) * 1.8}px)`,
            clipPath: `inset(0 ${(1 - sweepIn) * 102}% 0 0)`,
            willChange: "clip-path",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 8,
              border: `1px solid ${tp[7] + "44"}`,
              pointerEvents: "none",
              opacity: frameDraw * motion.exit,
            }}
          />
         
          <div
            style={{
              fontFamily: family,
              fontSize: titleFontSize ?? (p ? 52 : 44),
              color: textColor || MOSAIC_COLORS.textPrimary,
              lineHeight: 1.5,
            }}
          >
              {parts.map((part, idx) =>
                idx % 2 === 1 ? (
                  <span key={`hl-${idx}`} style={{ color: accentColor || MOSAIC_COLORS.gold, fontWeight: 700 }}>
                    <MosaicTiledText text={part} revealProgress={tileEntry} speed={1.3} fontFamily={fontFamily} />
                  </span>
                ) : (
                  <MosaicTiledText key={`tx-${idx}`} text={part} revealProgress={tileEntry} speed={1.3} fontFamily={fontFamily} />
                ),
              )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
