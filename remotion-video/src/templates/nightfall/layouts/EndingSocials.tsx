import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<NightfallLayoutProps> = ({
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

  // --- DIMENSION & SIZE LOGIC ---
  const resolvedTitleSize = titleFontSize ?? (p ? 88 : 72);
  const ctaFontSize = resolvedTitleSize - 25; // Set to -5 the size of the title

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

  // Transitions
  const cardOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const contentOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const bodyFont = (fontFamily ?? "").trim() || "'Playfair Display', Georgia, serif";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "40px 20px" : "60px 40px",
        }}
      >
        {/* Title: Outside the Card */}
        <div
          style={{
            fontSize: resolvedTitleSize,
            fontWeight: 800,
            color: textColor || "#E2E8F0",
            fontFamily: bodyFont,
            opacity: titleOpacity,
            marginBottom: p ? 20 : 30,
            textAlign: "center",
            transform: `translateY(${(1 - titleOpacity) * -20}px)`,
          }}
        >
          {title}
        </div>

        {/* The Glass Card */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.08),
            width: p ? "96%" : "78%",
            maxWidth: 950,
            minHeight: p ? 500 : 450,
            padding: p ? 30 : 50,
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardOpacity) * 20}px)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            textAlign: "center",
          }}
        >
          {/* Middle Content: Narration and Icons */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 20,
              opacity: contentOpacity,
            }}
          >
            {subtext && (
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 32 : 30),
                  fontWeight: 500,
                  color: `${textColor || "#E2E8F0"}CC`,
                  lineHeight: 1.4,
                  maxWidth: 700,
                  fontFamily: bodyFont,
                  marginBottom: 10,
                }}
              >
                {subtext}
              </div>
            )}

            <SocialIcons
              socials={socials}
              accentColor={accentColor}
              textColor={textColor || "#E2E8F0"}
              maxPerRow={p ? 3 : 5}
              fontFamily={bodyFont}
              aspectRatio={aspectRatio}
            />
          </div>

          {/* Bottom Section: Text-Only CTA (TitleSize - 5) and Link */}
          {showWebsiteCta && (
            <div
              style={{
                marginTop: 30,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                opacity: contentOpacity,
              }}
            >
              {/* Pure Text CTA (Title - 5) */}
              <div
                style={{
                  fontSize: ctaFontSize,
                  fontWeight: 800,
                  color: accentColor || "#7C3AED",
                  fontFamily: bodyFont,
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                }}
              >
                <span>{resolvedCta}</span>
                <span style={{ fontSize: ctaFontSize }}>→</span>
              </div>

              {/* Website Link Below CTA */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -4,
                    right: -4,
                    top: -2,
                    bottom: -2,
                    width: `${selectionWidth}%`,
                    backgroundColor: `${accentColor || "#7C3AED"}33`,
                    borderRadius: 4,
                    zIndex: 1,
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    fontSize: p ? 20 : 18,
                    fontWeight: 600,
                    color: textColor || "#E2E8F0",
                    fontFamily: bodyFont,
                    opacity: 0.7,
                  }}
                >
                  {resolvedWebsiteLink}
                </div>

                {/* Arrow Cursor */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "10%",
                    opacity: interpolate(localFrame, [0, 5, 80, 90], [0, 1, 1, 0]),
                    transform: `translateX(${cursorX}px) translateY(${cursorY}px)`,
                    zIndex: 100,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
        </div>
      </div>
    </AbsoluteFill>
  );
};