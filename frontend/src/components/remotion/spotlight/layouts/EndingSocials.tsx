import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

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

  const fade = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [6, 26], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [16, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const bodyFont = fontFamily ?? "'Inter, system-ui, sans-serif";

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
          justifyContent: "center",
          padding: p ? "0 8%" : "0 12%",
          textAlign: "center",
          opacity: fade,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 97 : 86),
            fontWeight: 800,
            color: textColor || "#FFFFFF",
            fontFamily: bodyFont,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            opacity: titleOpacity,
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
            opacity: Math.min(1, titleOpacity * 1.2),
          }}
        />

        {showWebsiteCta ? (
          <div style={{ marginTop: p ? 16 : 20, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 10 : 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: p ? "18px 36px" : "16px 32px", backgroundColor: accentColor || "#7C3AED", color: "#FFFFFF", fontSize: p ? 28 : 26, fontWeight: 700, lineHeight: 1, fontFamily: bodyFont }}>
              <span>{resolvedCta}</span>
              <span style={{ fontSize: p ? 30 : 28 }}>→</span>
            </div>
            <div style={{ fontSize: p ? 26 : 24, fontWeight: 600, color: textColor || "#FFFFFF", fontFamily: bodyFont, lineHeight: 1.2, maxWidth: p ? 560 : 760, wordBreak: "break-word" }}>
              {resolvedWebsiteLink}
            </div>
          </div>
        ) : null}

        {subtext ? (
          <div
            style={{
              marginTop: p ? 20 : 25,
              fontSize: descriptionFontSize ?? (p ? 44 : 41),
              fontWeight: 500,
              color: `${textColor || "#FFFFFF"}CC`,
              lineHeight: 1.35,
              maxWidth: p ? 560 : 860,
              opacity: subOpacity,
              fontFamily: bodyFont,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 26 : 34, width: "100%" }}>
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#FFFFFF"} maxPerRow={p ? 3 : 4} fontFamily={bodyFont} aspectRatio={aspectRatio} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
