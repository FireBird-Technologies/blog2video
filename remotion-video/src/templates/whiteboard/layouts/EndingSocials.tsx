import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<WhiteboardLayoutProps> = ({
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
  descriptionFontSize
}) => {
  const frame = useCurrentFrame();
  const { fps } = { fps: 30 }; // Assuming 30fps, adjust if needed
  const p = aspectRatio === "portrait";

  // Animations
  const fade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 40], [0, 1], { extrapolateRight: "clamp" });

  // Pop-in effect for the stickman
  const stickmanPop = spring({ frame: frame - 20, fps, config: { damping: 12 } });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const markerFont = (fontFamily ?? "").trim() || "'Patrick Hand', system-ui, sans-serif";

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
          transform: "translateX(3%)", // Move container slightly to the right
        }}
      >
        {/* Title Section */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 88 : 69),
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

        {/* STICKMAN CTA SECTION */}
        {showWebsiteCta ? (
          <div // Wrapper for board, stickman AND ground
            style={{
              marginTop: p ? 30 : 40,
              display: "flex",
              flexDirection: "column", // Stack elements vertically
              alignItems: "center",     // Center horizontally
              transform: `scale(${stickmanPop})`,
              opacity: stickmanPop,
            }}
          >
            {/* The website link, moved above the board and stickman */}
            <div style={{
              fontSize: p ? 20 : 22,
              fontWeight: 600,
              color: textColor || "#111111",
              fontFamily: markerFont,
              marginBottom: p ? 15 : 20,
              textAlign: "center"
            }}>
              {resolvedWebsiteLink}
            </div>

            <div // Container for just the board and stickman, aligned to their bottoms
              style={{
                display: "flex",
                alignItems: "flex-end", // Aligns the board and stickman bases
              }}
            >
              {/* The CTA Board */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                 <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    border: `4px solid ${textColor || "#111"}`,
                    borderRadius: 12,
                    padding: p ? "15px 25px" : "12px 30px",
                    backgroundColor: "#FFFFFF",
                    color: textColor || "#111",
                    fontSize: p ? 24 : 28,
                    fontWeight: 800,
                    fontFamily: markerFont,
                    boxShadow: `8px 8px 0px ${accentColor}44`,
                    position: "relative",
                    top: p ? -60 : -80 // MODIFIED: Move the board up
                  }}>
                    <span style={{ fontSize: p ? 28 : 32 }}>←</span>
                    <span>{resolvedCta}</span>

                    {/* Board Post/Handle - REMOVED */}
                  </div>
              </div>

              {/* The Stickman (Standing at the Right) */}
              <svg
                width={p ? 100 : 120}
                height={p ? 140 : 160}
                viewBox="0 0 100 150"
                style={{ marginLeft: -10, zIndex: -1 }}
              >
                <g fill="none" stroke={textColor || "#111"} strokeWidth="4" strokeLinecap="round">
                  {/* Head */}
                  <circle cx="50" cy="30" r="15" />
                  {/* Body */}
                  <line x1="50" y1="45" x2="50" y2="90" />
                  {/* Arm holding board (stickman's right arm, reaching up and left) */}
                  <line x1="50" y1="60" x2="10" y2="50" /> {/* MODIFIED */}
                  {/* Other arm (stickman's left arm, relaxed downward) */}
                  <line x1="50" y1="60" x2="75" y2="75" />
                  {/* Legs */}
                  <line x1="50" y1="90" x2="30" y2="140" />
                  <line x1="50" y1="90" x2="70" y2="140" />
                </g>
              </svg>
            </div>

            {/* Ground below the stickman and board */}
            <div
              style={{
                width: p ? 300 : 400, // Ground width
                height: 10,
                backgroundColor: textColor || "#111",
                borderRadius: 5,
                marginTop: -5, // Adjust to make it visually connect with stickman's feet
                boxShadow: `0 4px 0 ${accentColor}44`,
              }}
            />
          </div>
        ) : null}

        {/* Subtext Section */}
        {subtext ? (
          <div
            style={{
              marginTop: p ? 25 : 30,
              fontSize: descriptionFontSize ?? (p ? 44 : 31),
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
          <SocialIcons socials={socials} accentColor={accentColor} textColor={textColor || "#111"} maxPerRow={p ? 3 : 4} fontFamily={markerFont} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
