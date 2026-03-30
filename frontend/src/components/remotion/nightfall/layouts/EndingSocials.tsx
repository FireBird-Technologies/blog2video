import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
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

  const cardOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [18, 38], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "https://yourwebsite.com").trim() || "https://yourwebsite.com";
  const showWebsiteCta = showWebsiteButton !== false;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 50 : 100,
        }}
      >
        <div
          style={{
            ...glassCardStyle(accentColor, 0.08),
            width: p ? "96%" : "78%",
            maxWidth: 1060,
            padding: p ? 56 : 64,
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardOpacity) * 10}px)`,
            textAlign: "center",
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 88 : 72),
              fontWeight: 800,
              color: textColor || "#E2E8F0",
              fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
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
              width: p ? 220 : 300,
              margin: p ? "16px auto 0" : "18px auto 0",
              borderRadius: 999,
              backgroundColor: `${accentColor}55`,
              opacity: Math.min(1, titleOpacity * 1.2),
            }}
          />

          {showWebsiteCta ? (
            <div style={{ marginTop: p ? 24 : 30, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 12 : 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  padding: p ? "16px 32px" : "12px 24px",
                  backgroundColor: accentColor || "#7C3AED",
                  color: "#FFFFFF",
                  fontSize: p ? 24 : 22,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: fontFamily ?? "'Inter, system-ui, sans-serif",
                }}
              >
                <span>Get Started with</span>
                <span style={{ fontSize: p ? 26 : 24 }}>→</span>
              </div>
              <div
                style={{
                  fontSize: p ? 22 : 20,
                  fontWeight: 600,
                  color: textColor || "#E2E8F0",
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
                marginTop: p ? 24 : 30,
                fontSize: descriptionFontSize ?? (p ? 36 : 36),
                fontWeight: 500,
                color: `${textColor}CC`,
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

          <div style={{ marginTop: p ? 24 : 30 }}>
            <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#E2E8F0"} maxPerRow={p ? 3 : 4} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
