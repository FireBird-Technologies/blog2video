import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../../fonts/chronicle-defaults";
import { SocialIcons } from "../../SocialIcons";
import { OrnamentalBorder, InkDivider } from "../components/OrnamentalBorder";
import { WaxSeal } from "../components/WaxSeal";
import { QuillText } from "../components/QuillInk";

/**
 * EndingSocials — "The End" colophon page.
 * - Large "FINIS" or custom title in ornamental serif
 * - Ornamental corner borders
 * - Wax seal with monogram
 * - Social icons row
 * - Website CTA on a ribbon
 */
export const EndingSocials: React.FC<ChronicleLayoutProps> = ({
  title = "Finis",
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const ctaText = (ctaButtonText ?? "Read the full chronicle").trim();
  const site = (websiteLink ?? "").trim();
  const shouldShowWebsite = showWebsiteButton !== false && site;

  // Title writes in
  const titleOp = interpolate(frame, [5, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Narration fades in
  const narrationOp = interpolate(frame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Seal stamps
  const sealFrame = 55;

  // Socials fade in
  const socialsOp = interpolate(frame, [75, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA ribbon
  const ctaRibbonStart = 95;
  const ctaSpring = spring({
    frame: frame - ctaRibbonStart,
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 8%" : "7% 10%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <OrnamentalBorder
        color={accentColor}
        size={p ? 140 : 170}
        startFrame={0}
        variant="fleur"
      />

      {/* Title */}
      <div
        style={{
          fontFamily: CHRONICLE_HEADING_FONT,
          fontSize: titleFontSize ?? (p ? 130 : 150),
          fontWeight: 900,
          color: textColor,
          textAlign: "center",
          letterSpacing: "0.08em",
          opacity: titleOp,
          textShadow: "2px 2px 0 rgba(184,134,11,0.3)",
          lineHeight: 1,
        }}
      >
        <QuillText text={title} startFrame={5} durationFrames={28} mode="char" showCursor={false} />
      </div>

      {/* Divider */}
      <div style={{ width: p ? "70%" : "50%", margin: "4px 0 10px" }}>
        <InkDivider color={accentColor} width="100%" startFrame={25} />
      </div>

      {/* Narration / sign-off */}
      {narration && (
        <div
          style={{
            fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
            fontStyle: "italic",
            fontSize: descriptionFontSize ?? (p ? 30 : 26),
            color: textColor,
            textAlign: "center",
            opacity: narrationOp * 0.9,
            maxWidth: p ? "95%" : "75%",
            lineHeight: 1.4,
          }}
        >
          <QuillText text={narration} startFrame={32} durationFrames={Math.min(90, narration.length * 1.1)} mode="word" showCursor={false} />
        </div>
      )}

      {/* Wax seal */}
      <div style={{ margin: "10px 0" }}>
        <WaxSeal
          size={p ? 110 : 130}
          color="#8B2E1D"
          monogram={String((title || "C").trim().charAt(0) || "C").toUpperCase()}
          stampFrame={sealFrame}
        />
      </div>

      {/* Socials */}
      {socials && (
        <div style={{ opacity: socialsOp, marginTop: 10 }}>
          <SocialIcons
            socials={socials as never}
            accentColor={accentColor}
            textColor={textColor}
            maxPerRow={p ? 3 : 4}
            fontFamily={fontFamily}
            aspectRatio={aspectRatio}
          />
        </div>
      )}

      {/* Website ribbon CTA */}
      {shouldShowWebsite && (
        <div
          style={{
            marginTop: 18,
            opacity: Math.min(1, ctaSpring),
            transform: `scale(${0.8 + ctaSpring * 0.2})`,
          }}
        >
          <div
            style={{
              padding: p ? "14px 34px" : "16px 44px",
              background: `linear-gradient(to bottom, ${accentColor} 0%, #8A6510 100%)`,
              clipPath: "polygon(6% 0%, 94% 0%, 100% 50%, 94% 100%, 6% 100%, 0% 50%)",
              color: "#F8EFD6",
              fontFamily: CHRONICLE_SMALLCAPS_FONT,
              fontSize: descriptionFontSize ?? (p ? 26 : 22),
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              boxShadow: "0 6px 18px rgba(40,25,12,0.45)",
              textAlign: "center",
              textShadow: "1px 1px 0 rgba(40,25,12,0.5)",
            }}
          >
            {ctaText}
          </div>
          {site && (
            <div
              style={{
                marginTop: 10,
                textAlign: "center",
                color: textColor,
                fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                fontSize: p ? 22 : 20,
                opacity: 0.78,
                fontStyle: "italic",
              }}
            >
              {site.replace(/^https?:\/\//, "")}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
