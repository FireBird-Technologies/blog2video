import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
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
  const resolvedWebsiteLink = (websiteLink ?? "https://yourwebsite.com").trim() || "https://yourwebsite.com";
  const showWebsiteCta = showWebsiteButton !== false;

  // Calculate dynamic margins based on presence of elements and portrait mode
  const marginTopAfterSeparatorForCta = p ? 40 : 48; // Increased margin to place CTA "over"
  const marginTopAfterCtaForNarration = p ? 24 : 30; // Margin for narration after CTA
  const marginTopAfterSeparatorForNarrationWhenNoCta = p ? 18 : 22; // Original narration margin after separator
  const marginTopAfterNarrationOrCtaForSocials = p ? 26 : 34; // Margin for socials

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.25 * bgOpacity} fontFamily={fontFamily} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "9% 8%" : "8% 12%",
          textAlign: "center",
          opacity: fade,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 97 : 72),
            fontWeight: 900,
            color: accentColor,
            fontFamily: fontFamily ?? "'Source Sans 3', system-ui, sans-serif",
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

        {showWebsiteCta ? (
          <div
            style={{
              marginTop: marginTopAfterSeparatorForCta,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: p ? 16 : 10, // Increased gap for portrait mode
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: p ? "18px 24px" : "12px 24px", // Increased vertical padding for portrait mode
                backgroundColor: accentColor || "#7C3AED",
                color: "#FFFFFF",
                fontSize: p ? 24 : 22, // Increased font size for portrait mode
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif",
              }}
            >
              <span>Get Started with</span>
              <span style={{ fontSize: p ? 26 : 24 }}>→</span> {/* Increased arrow size for portrait mode */}
            </div>
            <div
              style={{
                fontSize: p ? 22 : 20, // Increased font size for portrait mode
                fontWeight: 600,
                color: textColor || "#00FF41",
                fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif",
                lineHeight: 1.2,
                maxWidth: p ? 560 : 760,
                wordBreak: "break-word",
              }}
            >
              {resolvedWebsiteLink}
            </div>
          </div>
        ) : null}

        {subtext ? (
          <div
            style={{
              marginTop: showWebsiteCta
                ? marginTopAfterCtaForNarration
                : marginTopAfterSeparatorForNarrationWhenNoCta,
              fontSize: descriptionFontSize ?? (p ? 44 : 36),
              fontWeight: 500,
              color: `${textColor || "#00FF41"}CC`,
              lineHeight: 1.35,
              maxWidth: p ? 560 : 900,
              opacity: subOpacity,
              fontFamily: fontFamily ?? "'Source Sans 3', system-ui, sans-serif",
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: marginTopAfterNarrationOrCtaForSocials, width: "100%" }}>
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#00FF41"} maxPerRow={p ? 3 : 4} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
