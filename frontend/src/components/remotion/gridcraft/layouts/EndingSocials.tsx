import React from "react";
import { interpolate, useCurrentFrame, spring } from "remotion";
import { SocialIcons } from "../../SocialIcons";
import { glass } from "../utils/styles";
import type { GridcraftLayoutProps } from "../types";

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
  const { fps } = { fps: 30 };
  const p = aspectRatio === "portrait";

  // Animations
  const cardOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [16, 40], [0, 1], { extrapolateRight: "clamp" });
  
  // Announcement pop-in effect
  const announceSpring = spring({ frame: frame - 25, fps, config: { damping: 10 } });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const rawFont = (fontFamily ?? "").trim();
  const titleFont = rawFont || "Inter, system-ui, sans-serif";
  const bodyFont = rawFont || "Inter, system-ui, sans-serif";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: p ? 44 : 68,
        backgroundColor: bgColor ?? undefined,
      }}
    >
      <div
        style={{
          width: p ? "96%" : "78%",
          maxWidth: 1100,
          ...glass(false),
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 16px 60px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.65)`,
          borderRadius: 28,
          padding: p ? 56 : 64,
          textAlign: "center",
          opacity: cardOpacity,
          transform: `translateY(${(1 - cardOpacity) * 10}px)`,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 101 : 80),
            fontWeight: 900,
            color: textColor || "#171717",
            fontFamily: titleFont,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>

        <div
          style={{
            height: 6,
            width: p ? 220 : 320,
            borderRadius: 999,
            backgroundColor: `${accentColor}55`,
            margin: p ? "16px auto 0" : "18px auto 0",
            opacity: Math.min(1, titleOpacity * 1.2),
          }}
        />

        {/* ANNOUNCEMENT CTA SECTION */}
        {showWebsiteCta ? (
          <div 
            style={{ 
              marginTop: p ? 40 : 50, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: 20,
              transform: `scale(${announceSpring})`,
              opacity: announceSpring
            }}
          >
            {/* Speaker / Megaphone Icon */}
            <div style={{ flexShrink: 0, transform: 'rotate(-10deg)' }}>
              <svg width={p ? 80 : 100} height={p ? 80 : 100} viewBox="0 0 24 24" fill="none">
                <path 
                  d="M11 5L6 9H2V15H6L11 19V5Z" 
                  fill={accentColor || "#7C3AED"} 
                  stroke={accentColor || "#7C3AED"} 
                  strokeWidth="2" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" 
                  stroke={accentColor || "#7C3AED"} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>

            {/* Speech Bubble Container */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div 
                style={{ 
                  position: "relative",
                  backgroundColor: accentColor || "#7C3AED",
                  color: "#FFFFFF",
                  padding: p ? "18px 32px" : "16px 28px",
                  borderRadius: "20px 20px 20px 4px", // Bottom left sharpened for bubble effect
                  fontSize: p ? 32 : 30,
                  fontWeight: 800,
                  fontFamily: bodyFont,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
                }}
              >
                {resolvedCta}
              </div>
              
              <div 
                style={{ 
                  fontSize: p ? 26 : 24, 
                  fontWeight: 600, 
                  color: textColor || "#171717", 
                  fontFamily: bodyFont, 
                  marginTop: 12,
                  marginLeft: 4,
                  opacity: 0.9
                }}
              >
                {resolvedWebsiteLink}
              </div>
            </div>
          </div>
        ) : null}

        {/* Narration/Subtext */}
        {subtext ? (
          <div
            style={{
              marginTop: p ? 30 : 40,
              fontSize: descriptionFontSize ?? (p ? 41 : 34),
              fontWeight: 500,
              color: `${textColor || "#171717"}CC`,
              lineHeight: 1.35,
              maxWidth: p ? 520 : 760,
              marginLeft: "auto",
              marginRight: "auto",
              opacity: subOpacity,
              fontFamily: bodyFont,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 22 : 30 }}>
          <SocialIcons 
            socials={socials} 
            accentColor={accentColor} 
            textColor={textColor || "#171717"} 
            maxPerRow={p ? 3 : 4} 
            fontFamily={bodyFont} 
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </div>
  );
};