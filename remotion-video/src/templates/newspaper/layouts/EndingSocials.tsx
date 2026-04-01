import React from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BlogLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

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
  const { fps, durationInFrames, width } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const H_FONT =
    fontFamily ?? "'Source Serif 4', Georgia, 'Times New Roman', serif";
  const B_FONT =
    fontFamily ??
    "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const resolvedCta = (ctaButtonText ?? "").trim() || "Read More";

  const textCol = textColor ?? "#000000";
  const newsprintBg = bgColor ?? "#F4F1EA";
  const highlightCol = accentColor ?? "#FFE34D";

  // --- Animation Timings ---
  const EXIT_TRANSITION_START = durationInFrames - 30; // Shorter exit than original
  const CONTENT_FADE_START = durationInFrames - 15;

  // --- 1. NEW: Background Animation Logic ---

  // A. Ken Burns effect on the vintage news image shards
  const bgZoom = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.15], // Slow zoom in throughout the entire scene
    { extrapolateRight: "clamp" }
  );

  // B. Scrolling Ticker Logic
  const tickerText = `${title.toUpperCase()} • ${resolvedWebsiteLink.toUpperCase()} • THANK YOU FOR WATCHING • `;
  const repeatCount = 5;
  const fullTickerString = tickerText.repeat(repeatCount);
  const tickerFontSize = p ? 24 : 18;
  
  // Estimate width (chars * approx width factor). Precision isn't vital, just needs to scroll past.
  const estimatedTextWidth = fullTickerString.length * (tickerFontSize * 0.6);
  
  const tickerX = interpolate(
    frame,
    [0, durationInFrames],
    [0, -estimatedTextWidth / repeatCount], // Scroll the length of one repetition
    { extrapolateLeft: "clamp" }
  );

  // --- 2. Existing Content & Exit Logic ---
  const shardWidthFactor = p ? 0.8 : 0.5;

  // Modified Exit motion (incorporating the bgZoom into the total scale)
  const exitScale = interpolate(
    frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [1, 0.9], // Slightly shrink on exit instead of major scale up
    { extrapolateLeft: "clamp" }
  );
  
  const finalScale = bgZoom * exitScale; // Combine Ken Burns and Exit shrink

  const contentBlur = interpolate(
    frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [0, 5],
    { extrapolateLeft: "clamp" }
  );
  const contentOpacity = interpolate(
    frame,
    [CONTENT_FADE_START, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );

  const leftShardExitX = interpolate(
    frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [0, -width * shardWidthFactor],
    { extrapolateLeft: "clamp" }
  );
  const rightShardExitX = interpolate(
    frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [0, width * shardWidthFactor],
    { extrapolateLeft: "clamp" }
  );

  // Typewriter Logic
  const titleCharsVisible = Math.floor(
    interpolate(frame, [10, 10 + title.length], [0, title.length], {
      extrapolateRight: "clamp",
    })
  );
  const subtextStart = 15 + title.length;
  const subtextCharsVisible = Math.floor(
    interpolate(
      frame,
      [subtextStart, subtextStart + subtext.length],
      [0, subtext.length],
      { extrapolateRight: "clamp" }
    )
  );

  // Footer Entrance
  const footerStartFrame = fps * 1.5; // Slightly faster entrance
  const footerFade = interpolate(
    frame,
    [footerStartFrame, footerStartFrame + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: newsprintBg,
        overflow: "hidden",
        perspective: "1200px",
      }}
    >
      {/* --- NEW: SCROLLING TICKER BACKGROUND LAYER --- */}
      <div
        style={{
          position: "absolute",
          bottom: p ? "1%" : "0.5%", // Position near very bottom
          width: "100%",
          opacity: 0.1, // Very subtle
          whiteSpace: "nowrap",
          fontFamily: B_FONT,
          fontSize: tickerFontSize,
          fontWeight: 700,
          color: textCol,
          zIndex: 0,
          transform: `translateX(${tickerX}px)`,
        }}
      >
        {fullTickerString}
      </div>

      {/* 1. BACKGROUND SHARDS (Updated with Ken Burns and Exit) */}
      <img
        src={staticFile("vintage-news.avif")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${shardWidthFactor * 100}%`,
          height: "100%",
          objectFit: "cover",
          opacity: 0.25,
          mixBlendMode: "multiply",
          // Apply combined animation
          transform: `translateX(${leftShardExitX}px) scale(${finalScale})`,
          transformOrigin: "left center", // Zoom from left
          zIndex: 1,
        }}
      />
      <img
        src={staticFile("vintage-news.avif")}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: `${shardWidthFactor * 100}%`,
          height: "100%",
          objectFit: "cover",
          opacity: 0.25,
          mixBlendMode: "multiply",
          // Apply combined animation
          transform: `translateX(${rightShardExitX}px) scale(${finalScale})`,
          transformOrigin: "right center", // Zoom from right
          zIndex: 1,
        }}
      />

      {/* 2. MAIN CONTENT WRAPPER */}
      <div
        style={{
          width: "100%",
          height: "100%",
          opacity: contentOpacity,
          filter: `blur(${contentBlur}px)`,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* TOP CONTENT (Headline & Article) */}
        <div style={{ padding: p ? "12% 8%" : "8% 15%" }}>
          <div
            style={{
              textAlign: "center",
              borderBottom: `2px solid ${textCol}`,
              paddingBottom: 15,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 70 : 60),
                fontWeight: 900,
                textTransform: "uppercase",
                lineHeight: 1.1,
                color: textCol,
              }}
            >
              {title.substring(0, titleCharsVisible)}
            </div>
          </div>

          {subtext && (
            <div
              style={{
                textAlign: "justify",
                fontSize: descriptionFontSize ?? (p ? 26 : 21),
                lineHeight: 1.6,
                fontFamily: B_FONT,
                color: textCol,
                paddingBottom: p ? "300px" : "200px",
              }}
            >
              <span
                style={{
                  float: "left",
                  fontSize: "3.5em",
                  lineHeight: "0.8em",
                  paddingRight: 8,
                  fontFamily: H_FONT,
                  fontWeight: 900,
                }}
              >
                {subtext.charAt(0)}
              </span>
              {subtext.substring(1, subtextCharsVisible)}
              {subtextCharsVisible >= subtext.length - 1 && (
                <span style={{ display: "inline-block", marginLeft: 5 }}>
                  {" "}
                  &#9632;
                </span>
              )}
            </div>
          )}
        </div>

        {/* FOOTER SECTION */}
        <div
          style={{
            position: "absolute",
            bottom: p ? "8%" : "6%",
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: footerFade,
            transform: `translateY(${interpolate(
              footerFade,
              [0, 1],
              [20, 0]
            )}px)`,
          }}
        >
          <div
            style={{
              width: "60px",
              height: "3px",
              backgroundColor: textCol,
              margin: "0 auto 30px",
            }}
          />

          {showWebsiteButton && (
            <div style={{ marginBottom: 35 }}>
              <span
                style={{
                  display: "inline-block",
                  backgroundColor: `${highlightCol}CC`,
                  color: "#000",
                  padding: "4px 12px",
                  fontSize: p ? 38 : 34,
                  fontWeight: 800,
                  fontFamily: H_FONT,
                  transform: "rotate(-1deg)",
                  boxShadow: `2px 2px 0px rgba(0,0,0,0.1)`,
                }}
              >
                {resolvedCta}
              </span>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 20,
                  fontWeight: 700,
                  color: textCol,
                  textDecoration: "underline",
                }}
              >
                {resolvedWebsiteLink}
              </div>
            </div>
          )}

          <div
            style={{
              borderTop: `1px solid rgba(0,0,0,0.1)`,
              paddingTop: 20,
              margin: "0 10%",
            }}
          >
            <SocialIcons
              socials={socials}
              accentColor={textCol}
              textColor={textCol}
              maxPerRow={p ? 4 : 8}
              fontFamily={B_FONT}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};