import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Sequence } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<MatrixLayoutProps> = ({
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

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 42], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  
  // Use a single font family for all texts
  const resolvedFontFamily = (fontFamily ?? "").trim() || "Inter, system-ui, sans-serif";

  // Timing for CTA text animation
  const ctaAnimationStartFrame = 45; // Start animation after other elements have settled

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.25 * bgOpacity} fontFamily={resolvedFontFamily} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center", // Changed to center content vertically
          padding: p ? "9% 8%" : "8% 12%",
          textAlign: "center",
          opacity: fade,
          gap: p ? 40 : 50, // General gap between content blocks
        }}
      >
        {/* Top Content: Title, Separator, Narration */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%", // Ensure it takes full width for centering
          }}
        >
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 97 : 72),
              fontWeight: 900,
              color: accentColor,
              fontFamily: resolvedFontFamily,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1.04,
              opacity: titleOpacity,
              textShadow: `0 0 18px ${accentColor}66, 0 0 42px ${accentColor}22`,
            }}
          >
            {title}
          </div>

          <div
            style={{
              marginTop: p ? 14 : 18,
              width: p ? 240 : 340,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${accentColor}55`,
              opacity: Math.min(1, titleOpacity * 1.2),
            }}
          />

          {subtext ? (
            <div
              style={{
                marginTop: p ? 30 : 40, // Consistent margin after separator
                fontSize: descriptionFontSize ?? (p ? 44 : 36),
                fontWeight: 500,
                color: `${textColor || "#00FF41"}CC`,
                lineHeight: 1.35,
                maxWidth: p ? 560 : 900,
                opacity: subOpacity,
                fontFamily: resolvedFontFamily,
              }}
            >
              {subtext}
            </div>
          ) : null}
        </div>

        {/* Social Icons (Moved above CTA) */}
        <div style={{ width: "100%" }}>
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={textColor || "#00FF41"}
            maxPerRow={p ? 3 : 4}
            fontFamily={resolvedFontFamily}
            iconSize={p ? 60 : 48} // Increased size for portrait mode
            textFontSize={p ? 28 : 22} // Increased font size for portrait mode
          />
        </div>

        {/* CTA Button and Website Link (Moved above) */}
        {showWebsiteCta ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: p ? 20 : 10, // Gap between button and link, increased for portrait
            }}
          >
            {/* CTA Button with text animation */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 12, // Changed from 999 to 12 for a rectangular shape
                padding: p ? "24px 36px" : "12px 28px", // Increased padding for portrait
                backgroundColor: "transparent", // Changed to transparent for an underlined button appearance
                color: accentColor || "#7C3AED", // Text color matches accent for highlighting
                fontSize: p ? 32 : 22, // Increased font size for portrait
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: resolvedFontFamily,
                minWidth: p ? 300 : 280, // Increased min-width for portrait
                // Slightly highlighted effect
                boxShadow: `0 0 10px ${accentColor || "#7C3AED"}AA, 0 0 20px ${accentColor || "#7C3AED"}55`,
              }}
            >
              {resolvedCta.split("").map((char, i) => {
                const charFade = interpolate(
                  frame,
                  [ctaAnimationStartFrame + i * 2, ctaAnimationStartFrame + i * 2 + 8], // Delay each character's fade-in
                  [0, 1],
                  { extrapolateRight: "clamp" }
                );
                return (
                  <span
                    key={i}
                    style={{
                      opacity: charFade,
                    }}
                  >
                    {char}
                  </span>
                );
              })}
              {/* Arrow always visible */}
              <span style={{ fontSize: p ? 34 : 24, marginLeft: 8 }}>→</span> {/* Increased arrow size for portrait */}
            </div>
            {/* Website Link */}
            <div
              style={{
                fontSize: p ? 26 : 20, // Increased font size for portrait
                fontWeight: 600,
                color: textColor || "#00FF41",
                fontFamily: resolvedFontFamily,
                lineHeight: 1.2,
                maxWidth: p ? 560 : 760,
                wordBreak: "break-word",
              }}
            >
              {resolvedWebsiteLink}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
