import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import type { MosaicLayoutProps } from "../types";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { SocialIcons } from "../../SocialIcons";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import { resolveCtas } from "../../shared/resolveCtas";

export const EndingSocials: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
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
  const p = aspectRatio === "portrait";
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const line = accentColor || MOSAIC_COLORS.gold;

  // CTA cards (1-3). Only render cards with toggle on + a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;

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
        <div style={{ fontFamily: family, fontSize: titleFontSize ?? (p ? 92 : 72), color: textColor || MOSAIC_COLORS.textPrimary, fontWeight: 700, opacity: titleIn }}>
          {title}
        </div>
        <div style={{ width: 300 * lineIn, height: 2, background: line, marginTop: 16, marginBottom: 16 }} />
        <div style={{ fontFamily: family, fontSize: descriptionFontSize ?? (p ? 38 : 30), color: textColor || MOSAIC_COLORS.textSecondary, opacity: bodyIn }}>
          {narration}
        </div>
        {hasAnyCard ? (
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: p ? 18 : 28,
              width: "100%",
              opacity: bodyIn,
            }}
          >
            {cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  flex: cards.length === 1 ? "0 1 auto" : "1 1 0",
                  minWidth: 200,
                  maxWidth: cards.length === 1 ? "100%" : cards.length === 2 ? "48%" : "32%",
                }}
              >
                <div style={{ color: line, fontFamily: family, fontSize: 28, fontWeight: 700 }}>
                  {card.ctaButtonText.trim() || "Explore more on"}
                </div>
                <div
                  style={{
                    color: textColor || MOSAIC_COLORS.textPrimary,
                    fontFamily: family,
                    fontSize: 20,
                    wordBreak: "break-word",
                    textAlign: "center",
                  }}
                >
                  {card.websiteLink}
                </div>
              </div>
            ))}
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
