import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { getSceneTransition } from "../transitions";
import type { MosaicLayoutProps } from "../types";

export const MosaicStream: React.FC<MosaicLayoutProps> = ({
  title,
  items,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 26, 20);
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const stream = items && items.length > 0 ? items : [title];
  const streamItems = stream.slice(0, 8);
  const boxBuild = interpolate(frame, [0, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
        tileEntryPattern="center"
        tileEntryIntensity={13}
        tileExitProgress={tileExit}
        tileExitSeed={37}
        tileExitIntensity={31}
      />
      <AbsoluteFill style={{ padding: "8% 10%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                <div style={{ fontFamily: family, color: MOSAIC_COLORS.gold, fontSize: 18, fontWeight: 700 }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    width: 6,
                    height: 44,
                    background: isActive ? MOSAIC_COLORS.gold : "rgba(42,42,40,0.35)",
                  }}
                />
                <div
                  style={{
                    fontFamily: family,
                    color: textColor || MOSAIC_COLORS.textPrimary,
                    fontSize: titleFontSize ?? 34,
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
        <div
          style={{
            marginTop: 16,
            color: MOSAIC_COLORS.textSecondary,
            fontFamily: family,
            fontSize: descriptionFontSize ?? 20,
            opacity: 0.9,
            fontStyle: "italic",
          }}
        >
          Ordered inlaid sequence
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
