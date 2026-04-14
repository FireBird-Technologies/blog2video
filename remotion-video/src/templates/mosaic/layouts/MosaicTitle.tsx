import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicTitle: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  imageUrl,
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
  // Tile sweep — 130 frames ≈ 4.3s
  const tileEntry = interpolate(frame, [0, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Content starts at frame 72 (≈55% of tile sweep done)
  const contentStart = 72;
  const titleIn        = getStaggeredReveal(frame, contentStart,      45);
  const titleBlocksIn  = getStaggeredReveal(frame, contentStart,      80);
  const subIn          = getStaggeredReveal(frame, contentStart + 12, 34);
  const taglineIn      = getStaggeredReveal(frame, contentStart + 24, 30);
  // Border builds IN SYNC with tiles from frame 0
  const borderSettle   = getStaggeredReveal(frame, 0, 110);
  const seamDraw       = getStaggeredReveal(frame, contentStart + 10, 30);
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
  // Image reveals after tiles are ~70% done
  const imageReveal = interpolate(frame, [90, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="titleBands"
        frameReveal={borderSettle * motion.exit}
        frameDrift={0.3 + tileEntry * 0.7}
        tileBuildProgress={tileEntry}
        tileEntryPattern="center"
        tileEntryIntensity={13}
        tileExitProgress={tileExit}
        tileExitSeed={19}
        tileExitIntensity={26}
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
                background: "linear-gradient(160deg, rgba(234,228,218,0.55) 0%, rgba(234,228,218,0.38) 100%)",
              }}
            />
          }
        />
      )}

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
            color: MOSAIC_COLORS.textSecondary,
            textTransform: "uppercase",
            opacity: subIn * 0.9 * motion.exit,
            marginBottom: 22,
          }}
        >
          Tesserae - Mosaic Template System
        </div>

        {/* ── Title word — 4px tiles, 0px gap, LTR sweep ───────── */}
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
            tileSize={4}
            gap={0}
            revealProgress={titleBlocksIn}
            revealMode="linear"
            exitProgress={exitBreak}
            colors={["#E0B870", "#D4A860", "#DAA040", "#C87828", "#D06030", "#C03820", "#A83018", "#4A7880"]}
            style={{ width: "100%", height: "auto", aspectRatio: "7 / 1.3" }}
          />
        </div>

        {/* ── Narration word — 4px tiles, 0px gap, LTR sweep ───── */}
        <div style={{ width: "100%", maxWidth: 580, marginTop: 12, opacity: subIn * motion.exit }}>
          <TileWordSvg
            text={narration || "STONE"}
            tileSize={4}
            gap={0}
            revealProgress={subIn}
            revealMode="linear"
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
            color: MOSAIC_COLORS.textSecondary,
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