import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SocialIcons } from "../../SocialIcons";
import { glass } from "../utils/styles";
import type { GridcraftLayoutProps } from "../types";

export const EndingSocials: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  accentColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  bgColor,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const cardOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [16, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "https://yourwebsite.com").trim() || "https://yourwebsite.com";
  const showWebsiteCta = showWebsiteButton !== false;

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
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 72 : 86),
            fontWeight: 900,
            color: textColor || "#171717",
            fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif",
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

        {showWebsiteCta ? (
          <div style={{ marginTop: p ? 24 : 32, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 12 : 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: p ? "14px 28px" : "12px 24px", backgroundColor: accentColor || "#7C3AED", color: "#FFFFFF", fontSize: p ? 24 : 22, fontWeight: 700, lineHeight: 1, fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif" }}>
              <span>Get Started with</span>
              <span style={{ fontSize: p ? 26 : 24 }}>→</span>
            </div>
            <div style={{ fontSize: p ? 22 : 20, fontWeight: 600, color: textColor || "#171717", fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif", lineHeight: 1.2, maxWidth: p ? 560 : 760, wordBreak: "break-word" }}>
              {resolvedWebsiteLink}
            </div>
          </div>
        ) : null}

        {subtext ? (
          <div
            style={{
              marginTop: p ? 20 : 28,
              fontSize: descriptionFontSize ?? (p ? 30 : 34),
              fontWeight: 500,
              color: `${textColor || "#171717"}CC`,
              lineHeight: 1.35,
              maxWidth: p ? 520 : 760,
              marginLeft: "auto",
              marginRight: "auto",
              opacity: subOpacity,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 22 : 30 }}>
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#171717"} maxPerRow={p ? 3 : 4} />
        </div>
      </div>
    </div>
  );
};
