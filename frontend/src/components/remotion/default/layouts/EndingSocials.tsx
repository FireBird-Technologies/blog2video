import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  textColor,
  fontFamily,
  aspectRatio,
  descriptionFontSize,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  const dividerOpacity = Math.min(1, (subOpacity ?? 0) * 1.2);

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const bodyFont = fontFamily ?? "'Inter, system-ui, sans-serif";

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", overflow: "hidden" }}>
      {/* Accent stripe */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: accentColor }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "6% 8%" : "7% 12%",
          textAlign: "center",
          gap: p ? 18 : 24,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${(1 - titleOpacity) * 10}px)`,
          }}
        >
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 88 : 79),
              fontWeight: 800,
              color: textColor || "#0A0A0A",
              fontFamily: bodyFont,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>

          <div
            style={{
              width: p ? 220 : 320,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${accentColor}55`,
              margin: p ? "10px auto 0" : "12px auto 0",
              opacity: dividerOpacity,
            }}
          />
        </div>

        {/* CTA button and link moved here, between title and narration text */}
        {showWebsiteCta ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: p ? 10 : 12, // Slightly increased gap
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: p ? "18px 36px" : "16px 32px", // Increased padding
                backgroundColor: accentColor || "#7C3AED",
                color: "#FFFFFF",
                fontSize: p ? 28 : 26, // Increased font size
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: bodyFont,
              }}
            >
              <span>{resolvedCta}</span>
              <span style={{ fontSize: p ? 30 : 28 }}>→</span> {/* Increased arrow font size */}
            </div>
            <div
              style={{
                fontSize: p ? 26 : 24, // Increased font size
                fontWeight: 600,
                color: textColor || "#404040",
                fontFamily: bodyFont,
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
              opacity: subOpacity,
              transform: `translateY(${(1 - subOpacity) * 6}px)`,
              maxWidth: p ? 520 : 760,
              fontSize: descriptionFontSize ?? (p ? 44 : 36),
              lineHeight: 1.25,
              fontWeight: 500,
              color: textColor || "#404040",
              fontFamily: bodyFont,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 10 : 18, width: "100%" }}>
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#111"} maxPerRow={p ? 3 : 4} fontFamily={bodyFont} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
