import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<NightfallLayoutProps> = ({
  title,
  narration, // Restored narration prop
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

  // --- LOOPS & TIMING ---
  const LOOP_DURATION = 90; 
  const localFrame = frame % LOOP_DURATION;

  // --- CURSOR & SELECTION LOGIC ---
  const cursorX = interpolate(
    localFrame,
    [0, 20, 50, 75],
    [200, -140, 140, 250], 
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
  );

  const cursorY = interpolate(
    localFrame,
    [0, 20, 75],
    [150, 10, 150], 
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const selectionWidth = interpolate(
    localFrame,
    [20, 50],
    [0, 100], 
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // General Card Transitions
  const cardOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const markerFont = (fontFamily ?? "").trim() || "'Playfair Display', Georgia, serif";
  const bodyFont = (fontFamily ?? "").trim() || "'Inter', system-ui, sans-serif";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: p ? 50 : 100 }}>
        <div
          style={{
            ...glassCardStyle(accentColor, 0.08),
            width: p ? "96%" : "78%",
            maxWidth: 1060,
            padding: p ? 56 : 64,
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardOpacity) * 10}px)`,
            textAlign: "center",
          }}
        >
          {/* Title */}
          <div style={{ fontSize: titleFontSize ?? (p ? 88 : 72), fontWeight: 800, color: textColor || "#E2E8F0", fontFamily: markerFont, opacity: titleOpacity, marginBottom: 30 }}>
            {title}
          </div>

          {showWebsiteCta && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              
              {/* The CTA Button */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 16, 
                  padding: "16px 44px",
                  backgroundColor: accentColor || "#7C3AED",
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: bodyFont,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <span>{resolvedCta}</span>
                <span>→</span>
              </div>

              {/* URL Selection Area */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <div 
                  style={{
                    position: "absolute",
                    left: 0,
                    top: -2,
                    bottom: -2,
                    width: `${selectionWidth}%`,
                    backgroundColor: `${accentColor || "#7C3AED"}55`,
                    borderRadius: 4,
                    zIndex: 1,
                  }}
                />

                <div 
                  style={{ 
                    position: "relative",
                    zIndex: 2,
                    fontSize: 22, 
                    fontWeight: 600, 
                    color: textColor || "#E2E8F0", 
                    fontFamily: bodyFont,
                    letterSpacing: "0.02em"
                  }}
                >
                  {resolvedWebsiteLink}
                </div>

                {/* The Arrow Cursor */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%", 
                    top: "0%", 
                    opacity: interpolate(localFrame, [0, 5, 80, 90], [0, 1, 1, 0]),
                    transform: `translateX(${cursorX}px) translateY(${cursorY}px)`,
                    zIndex: 100,
                    pointerEvents: "none",
                  }}
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <path 
                      d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.83-4.83 2.87 6.58a.5.5 0 0 0 .66.26l2.31-1.01a.5.5 0 0 0 .26-.66l-2.87-6.58h6.1a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" 
                      fill="white" 
                      stroke="black" 
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Narration Text */}
          {subtext ? (
            <div
              style={{
                marginTop: 30,
                fontSize: descriptionFontSize ?? (p ? 36 : 34),
                fontWeight: 500,
                color: `${textColor || "#E2E8F0"}CC`,
                lineHeight: 1.4,
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

          {/* Social Icons */}
          <div style={{ marginTop: 40 }}>
            <SocialIcons 
              socials={socials} 
              accentColor={accentColor} 
              textColor={textColor || "#E2E8F0"} 
              maxPerRow={p ? 3 : 4} 
              fontFamily={bodyFont} 
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};