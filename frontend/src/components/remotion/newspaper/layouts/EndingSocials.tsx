import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BlogLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const EndingSocials: React.FC<
  BlogLayoutProps & { narration?: string }
> = ({
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

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 40], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "https://yourwebsite.com").trim() || "https://yourwebsite.com";
  const showWebsiteCta = showWebsiteButton !== false;

  const resolvedFont = fontFamily ?? B_FONT;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: resolvedFont }}>
      {/* Newspaper-ish vintage background */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.13,
          filter: "grayscale(75%) contrast(1.08)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bgColor ? bgColor : "#FAFAF8",
          opacity: 0.35,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 9%" : "8% 12%",
          textAlign: "center",
          opacity: fadeIn,
        }}
      >
        <div
          style={{
            fontFamily: fontFamily ?? H_FONT,
            fontSize: titleFontSize ?? (p ? 88 : 72),
            fontWeight: 900,
            color: textColor ?? "#111111",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>

        <div
          style={{
            width: p ? 220 : 320,
            height: 6,
            borderRadius: 999,
            backgroundColor: `${accentColor ?? "#FFE34D"}55`,
            marginTop: p ? 14 : 18,
            opacity: Math.min(1, titleOpacity * 1.2),
          }}
        />

        {showWebsiteCta ? (
          // Moved CTA section above narration
          <div style={{ marginTop: p ? 20 : 25, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 10 : 10 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                // Increased padding and font sizes for portrait mode
                padding: p ? "14px 28px" : "12px 24px",
                backgroundColor: accentColor || "#7C3AED",
                color: "#FFFFFF",
                fontSize: p ? 24 : 22, // Increased for portrait
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: fontFamily ?? B_FONT,
              }}
            >
              <span>Get Started with</span>
              <span style={{ fontSize: p ? 28 : 24 }}>→</span> {/* Increased for portrait */}
            </div>
            <div
              style={{
                fontSize: p ? 22 : 20, // Increased for portrait
                fontWeight: 600,
                color: textColor || "#111111",
                fontFamily: fontFamily ?? B_FONT,
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
              // Adjusted margin based on whether CTA is present
              marginTop: showWebsiteCta ? (p ? 18 : 22) : (p ? 20 : 25),
              fontSize: descriptionFontSize ?? (p ? 35 : 27),
              fontWeight: 500,
              color: `${textColor ?? "#111111"}CC`,
              lineHeight: 1.35,
              maxWidth: p ? 560 : 920,
              opacity: subOpacity,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 26 : 34, width: "100%" }}>
          <SocialIcons
            socials={socials}
            accentColor={accentColor ?? "#FFE34D"}
            textColor={textColor ?? "#111111"}
            maxPerRow={p ? 3 : 4}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
