import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

/** Split text into word-wrapped lines not exceeding maxChars each */
function wrapToLines(text: string, maxChars: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

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
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
  aspectRatio,
}) => {
  const isPortrait = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 34, 12);
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
  // Border builds IN SYNC with tiles from frame 0
  const borderSettle   = getStaggeredReveal(frame, 0, 110);
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Image reveals after tiles are ~70% done
  const imageReveal = interpolate(frame, [90, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;

  const titleLines = wrapToLines((title || "TESSERAE").toUpperCase(), isPortrait ? 14 : 16);
  const narrationLines = wrapToLines((narration || "STONE").toUpperCase(), isPortrait ? 18 : 22);
  const titleLineH = titleFontSize ? Math.round(titleFontSize * 1.5) : (isPortrait ? 100 : 110);
  const narLineH   = descriptionFontSize ? Math.round(descriptionFontSize * 1.8) : (isPortrait ? 58 : 66);

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="titleBands"
        frameReveal={borderSettle * motion.exit}
        frameDrift={0.3 + tileEntry * 0.7}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "scatter"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={19}
        tileExitIntensity={mosaicIntensity ?? 26}
        tileExitPattern={mosaicPattern ?? "scatter"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />

      {/* ── Full-bleed image revealed tile-by-tile with center ripple ── */}
      {imageUrl && (
        <MosaicImageReveal
          imageUrl={imageUrl}
          revealProgress={tileEntry}
          clarityProgress={imageReveal}
          pattern={mosaicPattern ?? "scatter"}
          intensity={mosaicIntensity ?? 13}
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isPortrait ? "space-evenly" : "center",
          textAlign: "center",
          padding: isPortrait ? "12% 6%" : "0 8%",
          opacity: motion.presence,
          filter: `blur(${(1 - motion.exit) * 2}px)`,
        }}
      >
        {/* ── Title — one TileWordSvg per wrapped line ─────────── */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: titleIn * motion.exit,
            transform: `translateY(${(1 - titleIn) * 16}px)`,
          }}
        >
          {titleLines.map((line, i) => (
            <div key={i} style={{ width: "100%", height: titleLineH }}>
              <TileWordSvg
                text={line}
                tileSize={mosaicTileSize ?? 7}
                gap={mosaicTileGap ?? 1}
                revealProgress={titleBlocksIn}
                revealMode="linear"
                exitProgress={0}
                colors={["#E0B870", "#D4A860", "#DAA040", "#C87828", "#D06030", "#C03820", "#A83018", "#4A7880"]}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ))}
        </div>

        {/* ── Narration — one TileWordSvg per wrapped line ──────── */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: isPortrait ? 60 : 24,
            opacity: subIn * motion.exit,
          }}
        >
          {narrationLines.map((line, i) => (
            <div key={i} style={{ width: "100%", height: narLineH }}>
              <TileWordSvg
                text={line}
                tileSize={mosaicTileSize ?? 5}
                gap={mosaicTileGap ?? 1}
                revealProgress={subIn}
                revealMode="linear"
                exitProgress={0}
                colors={["#4A7880", "#5A9090", "#3A6070"]}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};