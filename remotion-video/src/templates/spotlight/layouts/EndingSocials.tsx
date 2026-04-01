import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY } from "../constants";

export const EndingSocials: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const bodyFont = fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;

  const resolvedTitleSize = titleFontSize ?? (p ? 95 : 113);
  const resolvedCtaSize = resolvedTitleSize + 30;

  let currentDelay = 20; 
  const animationDuration = 8; 
  const itemSpacing = 4; 

  const getPopUpStyles = (delay: number) => {
    const animationStart = delay;
    const animationEnd = animationStart + animationDuration;

    const opacity = interpolate(frame, [animationStart, animationEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const scale = interpolate(frame, [animationStart, animationEnd], [0.6, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(frame, [animationStart, animationEnd], [40, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return {
      opacity,
      transform: `scale(${scale}) translateY(${translateY}px)`,
    };
  };

  const titleAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  const separatorAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  let ctaTextAnim;
  let ctaLinkAnim;
  if (showWebsiteCta) {
    ctaTextAnim = getPopUpStyles(currentDelay);
    currentDelay += itemSpacing; 
    ctaLinkAnim = getPopUpStyles(currentDelay);
    currentDelay += itemSpacing;
  }

  const socialAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  let subtextAnim;
  if (subtext) {
    subtextAnim = getPopUpStyles(currentDelay);
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      {/* 1. TOP GROUP: Moved further down from the top edge */}
      <div style={{
        position: "absolute",
        top: p ? "18%" : "15%", // Increased from 10%/8% to bring closer to center
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 1,
      }}>
        <div style={{
          fontSize: resolvedTitleSize,
          fontWeight: 800,
          color: textColor || "#FFFFFF",
          fontFamily: bodyFont,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          textAlign: "center",
          padding: "0 15%",
          ...titleAnim,
        }}>
          {title}
        </div>
        <div style={{
          marginTop: p ? 15 : 10,
          width: p ? 180 : 260,
          height: 6,
          borderRadius: 999,
          backgroundColor: `${accentColor}55`,
          ...separatorAnim,
        }} />
      </div>

      {/* 2. CENTER GROUP */}
      {showWebsiteCta && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          zIndex: 2,
        }}>
          <div style={{
            color: accentColor || "#7C3AED",
            fontSize: resolvedCtaSize,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: bodyFont,
            textAlign: "center",
            textTransform: "uppercase",
            ...ctaTextAnim,
          }}>
            {resolvedCta}
          </div>
          <div style={{ 
            marginTop: 8,
            fontSize: p ? 28 : 26, 
            fontWeight: 600, 
            color: textColor || "#FFFFFF", 
            fontFamily: bodyFont, 
            ...ctaLinkAnim, 
          }}>
            {resolvedWebsiteLink}
          </div>
        </div>
      )}

      {/* 3. BOTTOM GROUP: Moved further up from the bottom edge */}
      <div style={{
        position: "absolute",
        bottom: p ? "15%" : "12%", // Increased from 6%/5% to bring closer to center
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 10%",
        zIndex: 1,
      }}>
        {subtext && (
          <div style={{
            fontSize: descriptionFontSize ?? (p ? 44 : 32),
            fontWeight: 500,
            color: `${textColor || "#FFFFFF"}CC`,
            lineHeight: 1.35,
            maxWidth: 860,
            fontFamily: bodyFont,
            textAlign: "center",
            marginBottom: 20,
            ...subtextAnim,
          }}>
            {subtext}
          </div>
        )}

        <div style={{ 
          width: "100%", 
          display: "flex", 
          justifyContent: "center",
          ...socialAnim 
        }}>
          <SocialIcons 
            socials={socials} 
            accentColor={accentColor} 
            textColor={textColor || "#FFFFFF"} 
            maxPerRow={p ? 3 : 6} 
            fontFamily={bodyFont} 
            aspectRatio={aspectRatio} 
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};