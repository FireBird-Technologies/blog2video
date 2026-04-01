import React from "react";
import { interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SocialIcons } from "../../SocialIcons";
import { glass, COLORS } from "../utils/styles";
import type { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY, GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY } from "../constants";

export const EndingSocials: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  bgColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig(); // Using actual config for better spring accuracy
  const p = aspectRatio === "portrait";

  // Match Editorial animations
  const spr = spring({ frame, fps, config: { damping: 14 } });
  const scale = interpolate(spr, [0, 1], [0.95, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const slideUp = interpolate(spr, [0, 1], [30, 0]);

  // Specific Socials animations
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [16, 40], [0, 1], { extrapolateRight: "clamp" });
  const announceSpring = spring({ frame: frame - 25, fps, config: { damping: 10 } });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const rawFont = (fontFamily ?? "").trim();
  const titleFont = rawFont || GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const bodyFont = rawFont || GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "60%", // Decreased card size
        height: "60%", // Decreased card size
        margin: "auto",
        backgroundColor: bgColor ?? undefined,
      }}
    >
      <div
        style={{
          ...glass(false),
          display: "grid", // Changed from flex
          gridTemplateColumns: "1fr", // Single column
          gap: 24, // Added gap between grid items (sections)
          alignItems: "center",
          justifyItems: "center", // Center content horizontally within the grid item
          width: "100%",
          height: "100%",
          padding: p ? 40 : 60, // Match Editorial padding style
          overflow: "hidden",
          borderRadius: 28, // Keep the socials card aesthetic
          border: `1px solid ${accentColor || COLORS.ACCENT}40`,
          boxShadow: `0 16px 60px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.65)`,
          transform: `scale(${scale}) translateY(${slideUp}px)`, // Match Editorial entrance
          opacity, // Match Editorial entrance
          textAlign: "center",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 70 : 60), // Decreased font size for smaller card
            fontWeight: 900,
            color: textColor || COLORS.DARK,
            fontFamily: titleFont,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            opacity: titleOpacity,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>

        <div
          style={{
            height: 4,
            width: p ? "40%" : "20%", // Match Editorial divider style
            backgroundColor: accentColor || COLORS.ACCENT,
            // Removed marginTop/marginBottom to rely on parent grid gap
            opacity: Math.min(1, titleOpacity * 1.2),
          }}
        />

        {/* ANNOUNCEMENT CTA SECTION */}
        {showWebsiteCta && (
          <div 
            style={{ 
              // Removed marginBottom to rely on parent grid gap
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: 20,
              transform: `scale(${announceSpring})`,
              opacity: announceSpring
            }}
          >
            <div style={{ flexShrink: 0, transform: 'rotate(-10deg)' }}>
              <svg width={p ? 60 : 70} height={p ? 60 : 70} viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" fill={accentColor || COLORS.ACCENT} stroke={accentColor || COLORS.ACCENT} strokeWidth="2" strokeLinejoin="round" />
                <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke={accentColor || COLORS.ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div 
                style={{ 
                  backgroundColor: accentColor || COLORS.ACCENT,
                  color: "#FFFFFF",
                  padding: "12px 24px",
                  borderRadius: "16px 16px 16px 4px",
                  fontSize: p ? 24 : 20, // Decreased font size for smaller card
                  fontWeight: 800,
                  fontFamily: bodyFont,
                }}
              >
                {resolvedCta}
              </div>
              <div style={{ fontSize: p ? 18 : 16, fontFamily: bodyFont, fontWeight: 600, color: textColor || COLORS.DARK, marginTop: 8, opacity: 0.8 }}> {/* Decreased font size for smaller card */}
                {resolvedWebsiteLink}
              </div>
            </div>
          </div>
        )}

        {/* Narration/Subtext */}
        {subtext && (
          <div
            style={{
              fontSize: descriptionFontSize ?? (p ? 28 : 26), // Decreased font size for smaller card
              fontWeight: 500,
              color: textColor || COLORS.DARK,
              lineHeight: 1.4,
              maxWidth: 800,
              opacity: subOpacity * 0.85,
              fontFamily: bodyFont,
              // Removed marginBottom to rely on parent grid gap
            }}
          >
            {subtext}
          </div>
        )}

        <div>
          <SocialIcons 
            socials={socials} 
            accentColor={accentColor} 
            textColor={textColor || COLORS.DARK} 
            maxPerRow={p ? 3 : 4} 
            fontFamily={bodyFont} 
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </div>
  );
};
