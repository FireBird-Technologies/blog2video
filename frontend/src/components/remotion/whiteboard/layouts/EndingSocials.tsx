import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<WhiteboardLayoutProps> = ({
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

  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 40], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "https://yourwebsite.com").trim() || "https://yourwebsite.com";
  const showWebsiteCta = showWebsiteButton !== false;
  const markerFont = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <WhiteboardBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "12% 8%" : "8% 10%",
          textAlign: "center",
          opacity: fade,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 86 : 96),
            fontWeight: 700,
            color: textColor || "#111111",
            fontFamily: markerFont,
            textShadow: `0 2px 0 ${accentColor}22`,
            opacity: titleOpacity,
            lineHeight: 1.02,
          }}
        >
          {title}
        </div>

        <div
          style={{
            height: 6,
            width: p ? 240 : 320,
            borderRadius: 999,
            backgroundColor: `${accentColor}55`,
            marginTop: p ? 14 : 18,
            opacity: Math.min(1, titleOpacity * 1.2),
          }}
        />

        {showWebsiteCta ? (
          <div style={{ marginTop: p ? 16 : 22, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 6 : 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: p ? "12px 18px" : "10px 22px", backgroundColor: accentColor || "#7C3AED", color: "#FFFFFF", fontSize: p ? 18 : 20, fontWeight: 700, lineHeight: 1, fontFamily: markerFont }}>
              <span>Get Started with</span>
              <span style={{ fontSize: p ? 20 : 22 }}>→</span>
            </div>
            <div style={{ fontSize: p ? 18 : 18, fontWeight: 600, color: textColor || "#111111", fontFamily: markerFont, lineHeight: 1.2, maxWidth: p ? 560 : 760, wordBreak: "break-word" }}>
              {resolvedWebsiteLink}
            </div>
          </div>
        ) : null}

        {subtext ? (
          <div
            style={{
              marginTop: p ? 16 : 22, // Adjusted margin to separate from button/link
              fontSize: descriptionFontSize ?? (p ? 36 : 34),
              fontWeight: 500,
              color: `${textColor || "#111111"}CC`,
              lineHeight: 1.25,
              fontFamily: markerFont,
              opacity: subOpacity,
              maxWidth: p ? 560 : 820,
            }}
          >
            {subtext}
          </div>
        ) : null}

        <div style={{ marginTop: p ? 28 : 34, width: "100%" }}>
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#111"} maxPerRow={p ? 3 : 4} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
