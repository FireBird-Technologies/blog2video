import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const source = stats?.[0]?.label ?? "";

  // --- Continuous Motion Logic (Unchanged) ---
  const motionProgress = interpolate(frame, [0, 50, durationInFrames], [0, 1, 1.2], {
    extrapolateRight: "clamp",
  });

  const EXIT_START = durationInFrames - 30;
  const camZ = interpolate(frame, [EXIT_START, durationInFrames], [0, -200], { extrapolateLeft: "clamp" });
  const camRotX = interpolate(frame, [EXIT_START, durationInFrames], [0, 15], { extrapolateLeft: "clamp" });
  const camOpacity = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // --- Shard Logic: Optimized for Portrait Aspect Ratio ---
  // In portrait, we increase the width of the shards to ensure full coverage
  const shardWidthFactor = p ? 0.8 : 0.5; 
  // Modified: Shards now stick at position 0 and rotation 0 after colliding (motionProgress = 1)
  const leftShardX = interpolate(motionProgress, [0, 1, 1.2], [-width, 0, 0]);
  const leftShardRot = interpolate(motionProgress, [0, 1, 1.2], [-15, 0, 0]);
  
  const rightShardX = interpolate(motionProgress, [0, 1, 1.2], [width, 0, 0]);
  const rightShardRot = interpolate(motionProgress, [0, 1, 1.2], [15, 0, 0]);

  // UI Animations
  const barH = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });
  const quoteMarkS = interpolate(frame, [6, 22], [0.6, 1.2], { extrapolateRight: "clamp" });
  const quoteMarkOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const visWords = Math.floor(words.length * wordProgress);

  const attrOp = interpolate(frame, [50, 64], [0, 1], { extrapolateRight: "clamp" });
  const sourceOp = interpolate(frame, [58, 72], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ 
      overflow: "hidden", 
      fontFamily: B_FONT, 
      backgroundColor: "#000",
      perspective: "1200px" 
    }}>
      <div style={{
        width: "100%",
        height: "100%",
        opacity: camOpacity,
        transform: `translateZ(${camZ}px) rotateX(${camRotX}deg)`,
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

        {/* Shards: Width adjusted for aspect ratio */}
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
            transform: `translateX(${leftShardX}px) rotate(${leftShardRot}deg)`,
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
            transform: `translateX(${rightShardX}px) rotate(${rightShardRot}deg)`,
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
          transform: "translateZ(80px)" 
        }}>
          <div style={{ 
            display: "flex", 
            flexDirection: "row", // Keep horizontal to maintain quote-bar relationship
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
                fontFamily: H_FONT,
                fontSize: p ? 140 : 120, // Huge quote marks for portrait impact
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
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 58 : 64), // Adjusted for readability on mobile
                fontWeight: 600,
                lineHeight: 1.25,
                color: textColor,
                marginBottom: p ? 40 : 40,
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
                    fontFamily: B_FONT, 
                    fontSize: descriptionFontSize ?? (p ? 32 : 36), 
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
                    fontFamily: B_FONT, 
                    fontSize: p ? 18 : 18, 
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
