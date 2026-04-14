import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicPunch: React.FC<MosaicLayoutProps> = ({
  title,
  word,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 24, 18);
  // Tile sweep — 100 frames ≈ 3.3s
  const tileEntry = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Content starts at frame 60 (60% of tile sweep)
  const scale   = interpolate(frame, [60, 76, 95], [0.92, 1.03, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [60, 82], [0, 1], { extrapolateRight: "clamp" });
  const seamGrow = getStaggeredReveal(frame, 68, 30);
  const exitBreak = interpolate(
    frame,
    [Math.max(0, durationInFrames - 24), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Image blurs in when tiles are ~65% done
  const imageReveal = interpolate(frame, [65, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line = accentColor || MOSAIC_COLORS.gold;
  const value = (word || title || "ENDURES").toUpperCase();

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="punchField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern="center"
        tileEntryIntensity={13}
        tileExitProgress={tileExit}
        tileExitSeed={31}
        tileExitIntensity={32}
      />

      {/* ── Full-bleed image revealed tile-by-tile with center ripple ── */}
      {imageUrl && (
        <MosaicImageReveal
          imageUrl={imageUrl}
          revealProgress={tileEntry}
          clarityProgress={imageReveal}
          pattern="center"
          intensity={13}
          style={{ opacity: motion.exit }}
          overlay={
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(234,228,218,0.58)",
              }}
            />
          }
        />
      )}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${scale})`,
            opacity: opacity * motion.exit,
            width: "100%",
            maxWidth: 980,
            filter: `blur(${(1 - motion.exit) * 2}px)`,
          }}
        >
          <TileWordSvg
            text={value}
            tileSize={titleFontSize ? Math.max(Math.floor(titleFontSize / 12), 9) : 12}
            gap={1}
            revealProgress={motion.entry}
            revealMode="cluster"
            exitProgress={exitBreak}
            colors={["#C26240", "#D28B6C", "#C77D5A", "#B96E4E", "#2A2A28", "#6B645E"]}
            style={{ width: "100%", height: "auto", aspectRatio: "8 / 1.45" }}
          />
        </div>
        <div style={{ position: "absolute", top: "34%", left: "8%", right: "8%", height: 1, background: "rgba(42,42,40,0.25)", opacity: 0.35 * motion.exit }} />
        <div style={{ position: "absolute", left: "50%", top: "8%", bottom: "8%", width: 1, background: "rgba(42,42,40,0.25)", opacity: 0.35 }} />
        <div style={{ position: "absolute", top: "34%", left: "12%", width: 260 * seamGrow, height: 1, background: line, opacity: 0.8 * motion.exit }} />
        <div style={{ position: "absolute", bottom: "34%", right: "12%", width: 260 * seamGrow, height: 1, background: line, opacity: 0.8 * motion.exit }} />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            fontFamily: fontFamily || MOSAIC_DEFAULT_FONT_FAMILY,
            fontStyle: "italic",
            letterSpacing: "0.14em",
            fontSize: 24,
            color: MOSAIC_COLORS.textSecondary,
            opacity: motion.entry * motion.exit,
          }}
        >
          fire and tide and time
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
