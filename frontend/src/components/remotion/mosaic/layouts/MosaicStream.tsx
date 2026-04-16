import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { getSceneTransition } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicStream: React.FC<MosaicLayoutProps> = ({
  title,
  items,
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
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const p = isPortrait;
  const motion = getSceneTransition(frame, durationInFrames, 26, 20);
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const stream = items && items.length > 0 ? items : [title];
  const streamItems = stream.slice(0, 8);
  const boxBuild = interpolate(frame, [0, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepIn = interpolate(frame, [6, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 28), durationInFrames - 8],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 22), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="streamField"
        frameReveal={boxBuild * motion.exit}
        frameDrift={boxBuild}
        tileBuildProgress={boxBuild}
        tileEntryPattern={mosaicPattern ?? "linear"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={37}
        tileExitIntensity={mosaicIntensity ?? 31}
        tileExitPattern={mosaicPattern ?? "linear"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <AbsoluteFill style={{ padding: isPortrait ? "10% 8%" : "8% 10%", justifyContent: (isPortrait || !imageUrl) ? "center" : "flex-start", alignItems: (isPortrait || !imageUrl) ? "center" : "flex-start", textAlign: !imageUrl ? "center" : undefined, opacity: motion.exit, filter: `blur(${(1 - motion.exit) * 2}px)` }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            clipPath: `inset(0 ${(1 - sweepIn) * 102}% 0 0 round 2px)`,
            willChange: "clip-path",
          }}
        >
          {streamItems.map((item, index) => {
            const t = interpolate(frame, [index * 14 + 10, index * 14 + 34], [0, 1], {
              extrapolateRight: "clamp",
            });
            const reverseIndex = Math.max(0, streamItems.length - 1 - index);
            const outStart = Math.max(0, durationInFrames - 30 + reverseIndex * 3);
            const out = interpolate(frame, [outStart, outStart + 16], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isActive = frame > index * 14 + 24;
            return (
              <div
                key={`${item}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 10px 1fr",
                  alignItems: "start",
                  gap: 14,
                  opacity: t * out,
                  transform: `translateX(${(1 - t) * 18 - (1 - out) * 22}px)`,
                }}
              >
                <div style={{ fontFamily: family, color: accentColor || MOSAIC_COLORS.gold, fontSize: isPortrait ? 26 : 18, fontWeight: 700 }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    width: 6,
                    height: 44,
                    background: isActive ? (accentColor || MOSAIC_COLORS.gold) : "rgba(42,42,40,0.35)",
                  }}
                />
                <div
                  style={{
                    fontFamily: family,
                    color: textColor || MOSAIC_COLORS.textPrimary,
                    fontSize: titleFontSize ?? (p ? 46 : 42),
                    lineHeight: 1.2,
                    borderBottom: "1px solid rgba(42,42,40,0.2)",
                    paddingBottom: 10 * out,
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
