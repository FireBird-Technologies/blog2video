import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { DiamondIndicators } from "../mosaicPrimitives";
import { getSceneTransition } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicPhrases: React.FC<MosaicLayoutProps> = ({
  title,
  phrases,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 16, 12);
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  
  // Custom Buildup Logic
  const boxBuild = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 20), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const list = phrases && phrases.length > 0 ? phrases : [title];
  const freezeFrame = Math.max(0, durationInFrames - 18);
  const cycleFrame = frame >= freezeFrame ? freezeFrame : frame;
  const idx = Math.floor(cycleFrame / 72) % Math.max(list.length, 1);
  
  const fade = interpolate(cycleFrame % 72, [0, 10, 54, 70], [0, 1, 1, 0], { 
    extrapolateLeft: "clamp", 
    extrapolateRight: "clamp" 
  });

  // Panel Entrance Spring
  const panelSpring = (delay: number) => spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="phrasesFrame"
        frameReveal={motion.entry}
        frameDrift={motion.entry}
        tileBuildProgress={boxBuild}
        tileEntryPattern="center"
        tileEntryIntensity={20}
        tileExitProgress={tileExit}
        tileExitSeed={29}
        tileExitIntensity={24}
      />
      
      {/* Mosaic Grid Layout Container */}
      <AbsoluteFill style={{ 
        display: "grid",
        gridTemplateColumns: "1fr 3fr 1fr", // Multi-column "Tiled" feel
        gridTemplateRows: "1fr auto 1fr",
        gap: 20,
        padding: "5%",
        alignItems: "center"
      }}>
        
        {/* TOP LEFT TILE: System Status */}
        <div style={{
          gridColumn: "1",
          border: "1px solid rgba(212, 168, 96, 0.2)",
          padding: 15,
          background: "rgba(17,24,32,0.6)",
          opacity: interpolate(panelSpring(10), [0, 1], [0, 1]),
          transform: `translateX(${interpolate(panelSpring(10), [0, 1], [-20, 0])}px)`
        }}>
          <div style={{ color: accentColor || "#D4A860", fontSize: 12, letterSpacing: 2, fontFamily: family }}>STATUS: ACTIVE</div>
          <div style={{ height: 2, width: "100%", background: accentColor || "#D4A860", marginTop: 8, opacity: 0.3 }} />
        </div>

        {/* MAIN CENTER MOSAIC (The Bento Primary Tile) */}
        <div style={{ 
          gridColumn: "2",
          border: "1px solid #1E3040", 
          padding: "60px 40px", 
          background: "rgba(17,24,32,0.9)", 
          position: "relative", 
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          opacity: motion.presence,
          transform: `scale(${interpolate(panelSpring(5), [0, 1], [0.95, 1])})`,
        }}>
          <div style={{ color: "#4A7080", fontFamily: family, letterSpacing: "0.5em", textTransform: "uppercase", fontSize: 12 }}>
            Central Processing
          </div>
          <div style={{
              marginTop: 20,
              fontFamily: family,
              fontSize: titleFontSize ?? 54,
              color: textColor || "#D4A860",
              lineHeight: 1.1,
              opacity: fade,
          }}>
            {list[idx]}
          </div>
          <div style={{ marginTop: 30 }}>
            <DiamondIndicators count={list.length} activeIndex={idx} activeColor={accentColor} />
          </div>
        </div>

        {/* BOTTOM RIGHT TILE: Metadata */}
        <div style={{
          gridColumn: "3",
          gridRow: "3",
          borderLeft: `4px solid ${accentColor || "#D4A860"}`,
          padding: 15,
          background: "rgba(17,24,32,0.6)",
          opacity: interpolate(panelSpring(20), [0, 1], [0, 1]),
          transform: `translateY(${interpolate(panelSpring(20), [0, 1], [20, 0])}px)`
        }}>
          <div style={{ color: "#FFF", fontSize: 14, fontFamily: family, opacity: 0.8 }}>
            SEC_ID: 00{idx + 1}
          </div>
          <div style={{ color: "#4A7080", fontSize: 10, fontFamily: family, marginTop: 4 }}>
            INLAID SEQUENCE V2.6
          </div>
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};