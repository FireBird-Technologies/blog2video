import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicTiledText } from "../MosaicTiledText";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { getSceneTransition } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicClose: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
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
  const motion = getSceneTransition(frame, durationInFrames, 24, 14);
  const p = aspectRatio === "portrait";
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  // Text starts at frame 65 (≈56% of tile sweep done)
  const contentStart = 65;
  const inOpacity = interpolate(frame, [contentStart, contentStart + 36], [0, 1], { extrapolateRight: "clamp" });
  const outBlur = interpolate(frame, [Math.max(0, durationInFrames - 14), durationInFrames], [0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileEntry = interpolate(frame, [0, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 20), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sharpen = interpolate(frame, [contentStart, contentStart + 20], [6, 0], { extrapolateRight: "clamp" }) + outBlur;
  const phrase = (highlightPhrase || "").trim();
  const out =
    phrase && title.includes(phrase)
      ? title.replace(phrase, `__HL__${phrase}__HL__`)
      : title;

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="closeField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "diagonal"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={43}
        tileExitIntensity={mosaicIntensity ?? 24}
        tileExitPattern={mosaicPattern ?? "diagonal"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 12%" }}>
        <div style={{ opacity: inOpacity * motion.exit, filter: `blur(${sharpen}px)` }}>
          <div style={{ height: 1, background: "rgba(42,42,40,0.35)", width: 90, margin: "0 auto 22px" }} />
          <div
            style={{
              fontFamily: family,
              fontSize: titleFontSize ?? (p ? 64 : 56),
              color: textColor || MOSAIC_COLORS.textPrimary,
              lineHeight: 1.34,
            }}
          >
            {out.split("__HL__").map((part, i) =>
              i % 2 === 1 ? (
                <span key={`hl-${i}`} style={{ color: accentColor || MOSAIC_COLORS.gold, borderBottom: `1px solid ${accentColor || MOSAIC_COLORS.gold}` }}>
                  <MosaicTiledText text={part} revealProgress={tileEntry} speed={1.2} fontFamily={fontFamily} />
                </span>
              ) : (
                <MosaicTiledText key={`tx-${i}`} text={part} revealProgress={tileEntry} speed={1.2} fontFamily={fontFamily} />
              ),
            )}
          </div>
          <div style={{ marginTop: 16, fontFamily: family, fontSize: descriptionFontSize ?? (p ? 30 : 24), color: textColor || MOSAIC_COLORS.textSecondary }}>
            <MosaicTiledText text={narration} revealProgress={tileEntry} speed={1.5} fontFamily={fontFamily} />
          </div>
          {cta ? (
            <div style={{ marginTop: 22, color: textColor || MOSAIC_COLORS.textSecondary, fontFamily: family, fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              {cta}
            </div>
          ) : null}
          <div style={{ height: 1, background: "rgba(42,42,40,0.35)", width: 90, margin: "22px auto 0" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
