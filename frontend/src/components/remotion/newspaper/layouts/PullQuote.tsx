import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const PullQuote: React.FC<BlogLayoutProps> = ({
  title = "This is not a political game. Real people will feel real consequences starting tomorrow.",
  narration = "— Senate Majority Leader",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const source = stats?.[0]?.label ?? "";

  // --- Continuous Motion Logic ---
  const motionProgress = interpolate(frame, [0, 50, durationInFrames], [0, 1, 1.2], {
    extrapolateRight: "clamp",
  });

  // --- Exit Transition Logic ---
  const EXIT_TRANSITION_START = durationInFrames - 50; // Shards and text start their exit movement/scale
  const CONTENT_FADE_START = durationInFrames - 15; // All content fades out

  // Opacity for all content (except the main AbsoluteFill background)
  const contentOpacity = interpolate(frame, 
    [CONTENT_FADE_START, durationInFrames], 
    [1, 0], 
    { extrapolateLeft: "clamp" }
  );

  // --- Shard Logic: Optimized for Portrait Aspect Ratio ---
  const shardWidthFactor = p ? 0.8 : 0.5; 

  // Intro animation for shards
  const leftShardX_intro = interpolate(motionProgress, [0, 1, 1.2], [-width, 0, 0], { extrapolateRight: "clamp" });
  const leftShardRot_intro = interpolate(motionProgress, [0, 1, 1.2], [-15, 0, 0], { extrapolateRight: "clamp" });
  
  const rightShardX_intro = interpolate(motionProgress, [0, 1, 1.2], [width, 0, 0], { extrapolateRight: "clamp" });
  const rightShardRot_intro = interpolate(motionProgress, [0, 1, 1.2], [15, 0, 0], { extrapolateRight: "clamp" });

  // Exit animation for shards: Scale and extra translation/rotation to cover screen
  const shardScale = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [1, 4], // Scale up significantly to ensure full coverage
    { extrapolateLeft: "clamp" }
  );

  const leftShardExitTranslateX = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, -width * 0.7], // Push left shard further left
    { extrapolateLeft: "clamp" }
  );

  const rightShardExitTranslateX = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, width * 0.7], // Push right shard further right
    { extrapolateLeft: "clamp" }
  );

  const leftShardExitRotate = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, -30], 
    { extrapolateLeft: "clamp" }
  );

  const rightShardExitRotate = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, 30], 
    { extrapolateLeft: "clamp" }
  );

  // Combine intro and exit transforms for shards
  const finalLeftShardTransform = `
    translateX(${leftShardX_intro + leftShardExitTranslateX}px) 
    rotate(${leftShardRot_intro + leftShardExitRotate}deg) 
    scale(${shardScale})
  `;

  const finalRightShardTransform = `
    translateX(${rightShardX_intro + rightShardExitTranslateX}px) 
    rotate(${rightShardRot_intro + rightShardExitRotate}deg) 
    scale(${shardScale})
  `;

  // UI Animations
  const barH = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });
  const quoteMarkS = interpolate(frame, [6, 22], [0.6, 1.2], { extrapolateRight: "clamp" });
  const quoteMarkOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const visWords = Math.floor(words.length * wordProgress);

  const attrOp = interpolate(frame, [50, 64], [0, 1], { extrapolateRight: "clamp" });
  const sourceOp = interpolate(frame, [58, 72], [0, 1], { extrapolateRight: "clamp" });

  // --- New: Content exit scale for text zoom ---
  const contentExitScale = interpolate(frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [1, 4], // Scale up at the same rate as shards
    { extrapolateLeft: "clamp" }
  );

  // --- New: Content blur for text exit ---
  const contentBlur = interpolate(frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [0, 10], // From 0px blur to 10px blur
    { extrapolateLeft: "clamp" }
  );

  return (
    <AbsoluteFill style={{ 
      overflow: "hidden", 
      fontFamily: fontFamily ?? B_FONT, 
      backgroundColor: bgColor,
      perspective: "1200px" 
    }}>
      <div style={{
        width: "100%",
        height: "100%",
        opacity: contentOpacity,
        transformStyle: "preserve-3d"
      }}>
        <NewsBackground bgColor={bgColor} />

        <div style={{
            position: "absolute",
            inset: 0,
            backgroundColor: bgColor,
            opacity: 0.45,
            zIndex: 2,
        }} />

        {/* Shards: Width adjusted for aspect ratio, applying combined transform */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${shardWidthFactor * 100}%`,
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
            transform: finalLeftShardTransform,
            zIndex: 1,
          }}
        />

        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: `${shardWidthFactor * 100}%`,
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
            transform: finalRightShardTransform,
            zIndex: 1,
          }}
        />

        {/* Main Content */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 10%" : "6% 10%",
          zIndex: 3,
          transform: `translateZ(80px) scale(${contentExitScale})`, // Added contentExitScale for text zoom
          filter: `blur(${contentBlur}px)`, // Added blur filter
        }}>
          <div style={{ 
            display: "flex", 
            flexDirection: "row", 
            gap: p ? 24 : 32,
            alignItems: "flex-start",
            maxWidth: p ? width * 0.9 : 1000,
            width: "100%" 
          }}>
            {/* Accent Bar */}
            <div style={{
              width: p ? 10 : 8,
              flexShrink: 0,
              background: accentColor,
              alignSelf: "stretch",
              clipPath: `inset(0 0 ${100 - barH}% 0)`,
              minHeight: p ? 120 : 80,
              borderRadius: 4,
            }} />

            <div style={{ flex: 1 }}>
              {/* Quote Mark */}
              <div style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: p ? 140 : 120, 
                lineHeight: 0.5,
                color: accentColor,
                opacity: quoteMarkOp,
                transform: `scale(${quoteMarkS})`,
                transformOrigin: "left top",
                marginBottom: p ? 20 : 15,
              }}>
                &#8220;
              </div>

              {/* Main Quote Text */}
              <div style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: titleFontSize ?? (p ? 90 : 71), 
                fontWeight: 600,
                lineHeight: 1.25,
                color: textColor,
                marginBottom: 40,
                letterSpacing: p ? "-0.02em" : "normal",
              }}>
                {words.slice(0, visWords).join(" ")}
                {visWords < words.length && visWords > 0 && (
                  <span style={{ 
                    display: "inline-block", 
                    width: p ? 4 : 3, 
                    height: "0.8em", 
                    background: textColor, 
                    opacity: 0.5, 
                    marginLeft: 6, 
                    verticalAlign: "middle" 
                  }} />
                )}
              </div>

              {/* Attribution */}
              <div style={{ opacity: attrOp }}>
                <div style={{ 
                    fontFamily: fontFamily ?? B_FONT, 
                    fontSize: descriptionFontSize ?? (p ? 27 : 23),
                    fontWeight: 800, 
                    color: textColor, 
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                }}>
                  {narration}
                </div>
                {source && (
                  <div style={{ 
                    fontFamily: fontFamily ?? B_FONT, 
                    fontSize: 18,
                    fontWeight: 600, 
                    color: textColor, 
                    opacity: sourceOp * 0.7 
                  }}>
                    {source}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
