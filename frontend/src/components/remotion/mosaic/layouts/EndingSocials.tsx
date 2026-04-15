import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import type { MosaicLayoutProps } from "../types";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { SocialIcons } from "../../SocialIcons";
import { getSceneTransition, getStaggeredReveal } from "../transitions";

export const EndingSocials: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
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
  const motion = getSceneTransition(frame, durationInFrames, 20, 14);
  // All content starts when tiles are ≈57% done (frame 65)
  const contentStart = 65;
  const titleIn = getStaggeredReveal(frame, contentStart,      18);
  const lineIn  = getStaggeredReveal(frame, contentStart + 8,  16);
  const bodyIn  = getStaggeredReveal(frame, contentStart + 16, 16);
  const iconsIn = getStaggeredReveal(frame, contentStart + 24, 16);
  const tileEntry = interpolate(frame, [0, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const line = accentColor || MOSAIC_COLORS.gold;
  const showCta = showWebsiteButton !== false && Boolean((websiteLink || "").trim());

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern}
        tileEntryIntensity={mosaicIntensity ?? 11}
        tileExitProgress={tileExit}
        tileExitSeed={47}
        tileExitIntensity={mosaicIntensity ?? 24}
        tileExitPattern={mosaicPattern}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "8% 10%",
          opacity: motion.presence,
        }}
      >
        <div style={{ fontFamily: family, fontSize: titleFontSize ?? 72, color: textColor || MOSAIC_COLORS.textPrimary, fontWeight: 700, opacity: titleIn }}>
          {title}
        </div>
        <div style={{ width: 300 * lineIn, height: 2, background: line, marginTop: 16, marginBottom: 16 }} />
        <div style={{ fontFamily: family, fontSize: descriptionFontSize ?? 28, color: textColor || MOSAIC_COLORS.textSecondary, opacity: bodyIn }}>
          {narration}
        </div>
        {showCta ? (
          <div style={{ marginTop: 20, color: line, fontFamily: family, fontSize: 28, fontWeight: 700, opacity: bodyIn }}>
            {(ctaButtonText || "Explore more on").trim()}
          </div>
        ) : null}
        {showCta ? (
          <div style={{ marginTop: 8, color: textColor || MOSAIC_COLORS.textPrimary, fontFamily: family, fontSize: 20, opacity: bodyIn }}>
            {(websiteLink || "").trim()}
          </div>
        ) : null}
        <div style={{ marginTop: 24, width: "100%", opacity: iconsIn * motion.exit }}>
          <SocialIcons
            socials={socials}
            accentColor={line}
            textColor={textColor || MOSAIC_COLORS.textPrimary}
            maxPerRow={aspectRatio === "portrait" ? 3 : 4}
            fontFamily={family}
            aspectRatio={aspectRatio}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
