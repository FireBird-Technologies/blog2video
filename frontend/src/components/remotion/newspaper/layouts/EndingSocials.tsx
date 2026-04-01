import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BlogLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { useVideoConfig } from "remotion";

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

  const { durationInFrames } = useVideoConfig();
  const totalDuration = durationInFrames;

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 40], [0, 1], { extrapolateRight: "clamp" });

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const rawFont = (fontFamily ?? "").trim();
  const titleFace = rawFont || H_FONT;
  const bodyFace = rawFont || B_FONT;

  const resolvedFont = bodyFace;

  // 1. Background image zoom-in animation: Keep on zooming in
  // Made it a little faster by increasing the target scale.
  const bgScale = interpolate(frame, [0, totalDuration], [1, 1.25], {
    extrapolateRight: "clamp",
  });

  // 2. End scene zoom-in and focus on the "Explore More on" Button
  // Make the focus fast and at the very end by starting the zoom 1.5 seconds before the end
  const zoomStartFrame = totalDuration - 45; // Start zoom-in 1.5 seconds before end (45 frames)
  const zoomEndFrame = totalDuration; // End zoom-in at the very end of the scene

  const contentScale = interpolate(frame, [zoomStartFrame, zoomEndFrame], [1, p ? 1.7 : 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Calculate target translateY to center on "Explore more on"
  // The "Explore more on" span is slightly above the vertical center due to the title and line above it.
  // We need to move the content UP (negative Y) to bring the "Explore more on" button into the center of the view.
  const contentTranslateY = interpolate(
    frame,
    [zoomStartFrame, zoomEndFrame],
    [0, p ? -120 : -80], // Adjusted values for portrait/landscape for better centering
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // 3. Text blur effect during end-scene zoom
  // When the texts zoom in, they should get blurred as they zoom.
  const textBlur = interpolate(frame, [zoomStartFrame, zoomEndFrame], [0, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          transform: `scale(${bgScale})`, // Apply background zoom
          willChange: "transform",
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
          // Apply end-scene zoom and translation to the entire content
          transform: `scale(${contentScale}) translateY(${contentTranslateY}px)`,
          transformOrigin: "center center",
          willChange: "transform", // Optimize animation performance
        }}
      >
        <div
          style={{
            fontFamily: titleFace,
            fontSize: titleFontSize ?? (p ? 88 : 72),
            fontWeight: 900,
            color: textColor ?? "#111111",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            opacity: titleOpacity,
            filter: `blur(${textBlur}px)`, // Apply blur effect
            willChange: "filter, opacity",
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
          <div style={{ marginTop: p ? 20 : 25, display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 10 : 10 }}>
            {/* Modified to be a highlighted text, "Explore more on", and increased its size */}
            <span
              style={{
                display: "inline-block",
                backgroundColor: `${accentColor ?? "#FFE34D"}77`, // Translucent accent color for highlight
                color: textColor ?? "#111111", // Dark text for contrast with light highlight
                padding: "8px 18px", // Increased padding for larger text
                borderRadius: 0, // Remove borderRadius for custom clip-path
                fontSize: p ? 40 : 38, // Increased font size
                fontWeight: 700,
                lineHeight: 1.2,
                fontFamily: bodyFace,
                // 3. Broken highlight for CTA pill:
                // This clip-path creates a slightly jagged/indented effect on the left and right sides,
                // simulating a "marker marked" or "broken" highlight.
                clipPath: "polygon(0% 0%, 100% 0%, 100% 20%, 98% 50%, 100% 80%, 100% 100%, 0% 100%, 0% 80%, 2% 50%, 0% 20%)",
                willChange: "clip-path, filter",
                filter: `blur(${textBlur}px)`, // Apply blur effect
              }}
            >
              {resolvedCta}
            </span>
            <div
              style={{
                fontSize: p ? 22 : 20,
                fontWeight: 600,
                color: textColor || "#111111",
                fontFamily: bodyFace,
                lineHeight: 1.2,
                maxWidth: p ? 560 : 760,
                wordBreak: "break-word",
                willChange: "filter",
                filter: `blur(${textBlur}px)`, // Apply blur effect
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
              fontFamily: bodyFace,
              filter: `blur(${textBlur}px)`, // Apply blur effect
              willChange: "filter, opacity",
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
            fontFamily={bodyFace}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
