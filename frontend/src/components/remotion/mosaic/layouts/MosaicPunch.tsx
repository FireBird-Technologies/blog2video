import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicPunch: React.FC<MosaicLayoutProps> = ({
  title,
  word,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 24, 18);
  const headlineBlocksIn = getStaggeredReveal(frame, 0, 52);
  const scale = interpolate(frame, [0, 20, 38], [0.92, 1.03, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const seamGrow = getStaggeredReveal(frame, 8, 22);
  const exitBreak = interpolate(
    frame,
    [Math.max(0, durationInFrames - 24), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tileEntry = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const line = accentColor || MOSAIC_COLORS.gold;
  const value = (word || title || "ENDURES").toUpperCase();

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="punchField"
        frameReveal={motion.entry}
        frameDrift={motion.entry}
        tileBuildProgress={tileEntry}
        tileEntryPattern="center"
        tileEntryIntensity={28}
        tileExitProgress={tileExit}
        tileExitSeed={31}
        tileExitIntensity={32}
      />
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
            revealProgress={headlineBlocksIn}
            revealMode="center"
            revealDiscrete
            exitProgress={exitBreak}
            colors={["#D06030", "#C03820", "#A83018", "#C84828", "#B86820", "#C87828", "#5A9090", "#4A7880"]}
            style={{ width: "100%", height: "auto", aspectRatio: "8 / 1.45" }}
          />
        </div>
        <div style={{ position: "absolute", top: "34%", left: "8%", right: "8%", height: 1, background: "#1A2838", opacity: 0.35 * motion.exit }} />
        <div style={{ position: "absolute", left: "50%", top: "8%", bottom: "8%", width: 1, background: "#1A2838", opacity: 0.35 }} />
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
            color: "#1E3040",
            opacity: motion.entry * motion.exit,
          }}
        >
          fire and tide and time
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
