<<<<<<< HEAD
import React from "react";
=======
import * as React from "react";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY, GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { SocialIcons } from "../../SocialIcons";
<<<<<<< HEAD
=======
import { resolveCtas } from "../../../../utils/resolveCtas";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

const BOX_STAGGER_DELAY = 8;

export const EndingSocials: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
<<<<<<< HEAD
=======
  ctas,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  accentColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const subtext = (narration ?? "").trim();
<<<<<<< HEAD
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
=======

  // CTA cards (1-3). Only render cards with toggle on + a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const showWebsiteCta = cards.length > 0;
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  
  const rawFont = (fontFamily ?? "").trim();
  const titleFont = rawFont || GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const bodyFont = rawFont || GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  // Animation & Style Helper
  const getBoxStyle = (index: number, isHighlighted: boolean) => {
    const startFrame = index * BOX_STAGGER_DELAY;
    const spr = spring({
      frame: Math.max(0, frame - startFrame),
      fps,
      config: { damping: 14, mass: 0.8 },
    });
    
    return {
      ...glass(isHighlighted),
      backgroundColor: isHighlighted ? (accentColor || COLORS.ACCENT) : undefined,
      opacity: interpolate(spr, [0, 1], [0, 1]),
      transform: `scale(${interpolate(spr, [0, 1], [0.9, 1])}) translateY(${interpolate(spr, [0, 1], [20, 0])}px)`,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      padding: p ? "24px" : "40px",
      borderRadius: 24,
      border: isHighlighted ? "none" : `1px solid ${accentColor || COLORS.ACCENT}30`,
      textAlign: "center" as const,
    };
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: p ? "1fr" : "1.2fr 0.8fr",
          gridTemplateRows: p ? "auto" : "minmax(200px, auto) auto",
          gap: 20,
          width: p ? "90%" : "85%",
          maxWidth: 1200,
          fontFamily: bodyFont,
        }}
      >
        {/* 1. Title Box: Spans full width if no CTA */}
        <div 
          style={{ 
            ...getBoxStyle(0, false), 
            gridColumn: (p || !showWebsiteCta) ? "span 2" : "span 1" 
          }}
        >
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 50 : 64),
              fontWeight: 900,
              fontFamily: titleFont,
              color: textColor || COLORS.DARK,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          <div
            style={{
              height: 4,
              width: "40px",
              backgroundColor: accentColor || COLORS.ACCENT,
              marginTop: 20,
            }}
          />
        </div>

<<<<<<< HEAD
        {/* 2. CTA Box (Accent Background) */}
        {showWebsiteCta && (
          <div style={{ ...getBoxStyle(1, true) }}>
             <div
                style={{
                  fontSize: Math.max(24, (titleFontSize ?? (p ? 50 : 64)) * 0.5), 
                  fontWeight: 800,
                  color: "#FFFFFF",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>{resolvedCta}</span>
                <span style={{ fontSize: "1.1em" }}>→</span>
              </div>
              <div style={{ 
                marginTop: 14, 
                fontSize: 20, // Increased link size from 16 to 20
                fontWeight: 600, 
                color: "rgba(255,255,255,0.85)", // Slightly higher opacity for better visibility
              }}>
                {resolvedWebsiteLink}
              </div>
=======
        {/* 2. CTA Box (Accent Background) — stacks 1-3 CTAs vertically inside the box */}
        {showWebsiteCta && (
          <div style={{ ...getBoxStyle(1, true), gap: cards.length > 1 ? 18 : 0 }}>
            {cards.map((card, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 ? (
                  <div style={{ height: 1, width: "60%", background: "rgba(255,255,255,0.25)" }} />
                ) : null}
                <div
                  style={{
                    fontSize: cards.length === 1
                      ? Math.max(24, (titleFontSize ?? (p ? 50 : 64)) * 0.5)
                      : Math.max(20, (titleFontSize ?? (p ? 50 : 64)) * 0.35),
                    fontWeight: 800,
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span>{card.ctaButtonText.trim() || "Get started"}</span>
                  <span style={{ fontSize: "1.1em" }}>→</span>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: cards.length === 1 ? 20 : 16,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.85)",
                    wordBreak: "break-word",
                  }}
                >
                  {card.websiteLink}
                </div>
              </React.Fragment>
            ))}
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
          </div>
        )}

        {/* 3. Narration Box */}
        {subtext && (
          <div style={{ ...getBoxStyle(2, false), gridColumn: "span 2" }}>
            <div
              style={{
                fontSize: descriptionFontSize ?? (p ? 26 : 30),
                fontWeight: 500,
                color: textColor || COLORS.DARK,
                lineHeight: 1.5,
                maxWidth: 850,
              }}
            >
              {subtext}
            </div>
          </div>
        )}

        {/* 4. Social Icons Box (Accent Background) */}
        <div style={{ ...getBoxStyle(3, true), gridColumn: "span 2", padding: "24px" }}>
          <SocialIcons
            socials={socials}
            accentColor="#FFFFFF"
            textColor="#FFFFFF"
            maxPerRow={p ? 3 : 6}
            fontFamily={bodyFont}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </div>
  );
};