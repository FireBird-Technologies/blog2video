import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicTitle: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 34, 24);
  const titleIn = getStaggeredReveal(frame, 0, 34);
  const subIn = getStaggeredReveal(frame, 14, 28);
  const taglineIn = getStaggeredReveal(frame, 26, 24);
  const borderSettle = getStaggeredReveal(frame, 4, 30);
  const seamDraw = getStaggeredReveal(frame, 12, 24);
  const tileEntry = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 24), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exitBreak = interpolate(
    frame,
    [Math.max(0, durationInFrames - 26), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="titleBands"
        frameReveal={borderSettle * motion.exit}
        frameDrift={0.3 + motion.entry * 0.7}
        tileBuildProgress={tileEntry}
        tileEntryPattern="center"
        tileEntryIntensity={22}
        tileExitProgress={tileExit}
        tileExitSeed={19}
        tileExitIntensity={26}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 8%",
          opacity: motion.presence,
          transform: `translateY(${(1 - motion.exit) * 8}px)`,
          filter: `blur(${(1 - motion.exit) * 2.2}px)`,
        }}
      >
        <div
          style={{
            fontFamily: family,
            fontStyle: "italic",
            fontSize: 22,
            letterSpacing: "0.22em",
            color: "#3A6070",
            textTransform: "uppercase",
            opacity: subIn * 0.9 * motion.exit,
            marginBottom: 22,
          }}
        >
          Tesserae - Mosaic Template System
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: 940,
            opacity: titleIn * motion.exit,
            transform: `translateY(${(1 - titleIn) * 16}px)`,
          }}
        >
          <TileWordSvg
            text={title || "TESSERAE"}
            tileSize={titleFontSize ? Math.max(Math.floor(titleFontSize / 10), 8) : 11}
            gap={1}
            revealProgress={titleIn}
            revealMode="cluster"
            exitProgress={exitBreak}
            colors={["#E0B870", "#D4A860", "#DAA040", "#C87828", "#D06030", "#C03820", "#A83018", "#4A7880"]}
            style={{ width: "100%", height: "auto", aspectRatio: "7 / 1.3" }}
          />
        </div>
        <div style={{ width: "100%", maxWidth: 580, marginTop: 12, opacity: subIn * motion.exit }}>
          <TileWordSvg
            text={narration || "STONE"}
            tileSize={descriptionFontSize ? Math.max(Math.floor(descriptionFontSize / 6), 5) : 7}
            gap={1}
            revealProgress={subIn}
            revealMode="diagonal"
            exitProgress={exitBreak * 0.8}
            colors={["#4A7880", "#5A9090", "#3A6070"]}
            style={{ width: "100%", height: "auto", aspectRatio: "7 / 1.1" }}
          />
        </div>
        <div
          style={{
            marginTop: 16,
            height: 1,
            width: 300 * seamDraw * motion.exit,
            background: accentColor || MOSAIC_COLORS.gold,
            opacity: titleIn * 0.7 * motion.exit,
          }}
        />
        <div
          style={{
            marginTop: 18,
            fontFamily: family,
            fontStyle: "italic",
            fontSize: descriptionFontSize ?? 36,
            color: "#4A7880",
            opacity: taglineIn * motion.exit,
            transform: `translateY(${(1 - taglineIn) * 12 + (1 - motion.exit) * 8}px)`,
          }}
        >
          Stone cut. Tide set. Fire held.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
