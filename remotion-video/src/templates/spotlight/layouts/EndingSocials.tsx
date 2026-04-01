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

  // Animation configuration for "pop up" effect
  // Added an initial delay of 20 frames for the entire sequence
  let currentDelay = 20; // Initial delay for the first item
  // MODIFIED: Decreased animation duration and item spacing for a snappier, more "punchy" feel
  const animationDuration = 8; // How long each item animates (frames) - decreased from 10
  const itemSpacing = 4;     // Delay between the start of each item's animation (frames) - decreased from 5

  const getPopUpStyles = (delay: number) => {
    const animationStart = delay;
    const animationEnd = animationStart + animationDuration;

    const opacity = interpolate(frame, [animationStart, animationEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // MODIFIED: Increased the initial scale difference for a more pronounced "pop" from background
    const scale = interpolate(frame, [animationStart, animationEnd], [0.6, 1], { // Changed from 0.8 to 0.6
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // MODIFIED: Increased the initial translateY for a stronger "punch" from below
    const translateY = interpolate(frame, [animationStart, animationEnd], [40, 0], { // Changed from 20 to 40
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return {
      opacity,
      transform: `scale(${scale}) translateY(${translateY}px)`,
    };
  };

  // Calculate animation styles for each element, progressing the delay
  const titleAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  const separatorAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  let ctaAnim;
  if (showWebsiteCta) {
    ctaAnim = getPopUpStyles(currentDelay);
    currentDelay += itemSpacing;
  }

  // Social icons are now displayed before the narration text
  const socialAnim = getPopUpStyles(currentDelay);
  currentDelay += itemSpacing;

  let subtextAnim;
  if (subtext) {
    subtextAnim = getPopUpStyles(currentDelay);
    // No more items after subtext, so no need to increment currentDelay further
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: p ? "center" : "space-between", // Modified for portrait centering
          padding: p ? "10% 8% 8%" : "10% 12% 8%",
          textAlign: "center",
        }}
      >
        {/* Top group: Title, Separator, CTA */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: p ? 50 : 0, // Add margin between top and bottom groups when centered in portrait
        }}>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 97 : 100),
              fontWeight: 800,
              color: textColor || "#FFFFFF",
              fontFamily: bodyFont,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              ...titleAnim,
            }}
          >
            {title}
          </div>

          <div
            style={{
              marginTop: p ? 16 : 20,
              width: p ? 220 : 320,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${accentColor}55`,
              ...separatorAnim,
            }}
          />

          {showWebsiteCta ? (
            <div style={{
              // Increased marginTop to bring the CTA button and link downward
              marginTop: p ? 40 : 50, // Original was p ? 16 : 20
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: p ? 10 : 10,
              ...ctaAnim,
            }}>
              <div style={{
                color: accentColor || "#7C3AED",
                fontSize: p ? 64 : 62, // Increased from p ? 54 : 52
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: bodyFont,
                textAlign: "center"
              }}>
                <span>{resolvedCta}</span>
              </div>
              <div style={{ fontSize: p ? 26 : 24, fontWeight: 600, color: textColor || "#FFFFFF", fontFamily: bodyFont, lineHeight: 1.2, maxWidth: p ? 560 : 760, wordBreak: "break-word" }}>
                {resolvedWebsiteLink}
              </div>
            </div>
          ) : null}
        </div> {/* End of Top group */}

        {/* Bottom group: Social Icons and Narration */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          {/* Social Icons moved above narration */}
          <div style={{ width: "100%", marginBottom: p ? 26 : 34, ...socialAnim }}> {/* Added marginBottom for spacing */}
            <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#FFFFFF"} maxPerRow={p ? 3 : 4} fontFamily={bodyFont} aspectRatio={aspectRatio} />
          </div>

          {subtext ? (
            <div
              style={{
                fontSize: descriptionFontSize ?? (p ? 44 : 41),
                fontWeight: 500,
                color: `${textColor || "#FFFFFF"}CC`,
                lineHeight: 1.35,
                maxWidth: p ? 560 : 860,
                fontFamily: bodyFont,
                ...subtextAnim,
              }}
            >
              {subtext}
            </div>
          ) : null}
        </div> {/* End of Bottom group */}
      </div>
    </AbsoluteFill>
  );
};
