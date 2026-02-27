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
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const source = stats?.[0]?.label ?? "";

  // --- Continuous Motion Logic ---
  // Instead of stopping at 50, we create a continuous timeline
  const motionProgress = interpolate(frame, [0, 50, durationInFrames], [0, 1, 1.2], {
    extrapolateRight: "clamp",
  });

  // 3D Camera Exit: Starts flat, then tilts and zooms out at the end
  const EXIT_START = durationInFrames - 30;
  const camZ = interpolate(frame, [EXIT_START, durationInFrames], [0, -200], { extrapolateLeft: "clamp" });
  const camRotX = interpolate(frame, [EXIT_START, durationInFrames], [0, 15], { extrapolateLeft: "clamp" });
  const camOpacity = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // Shard Math (Continuous)
  const leftShardX = interpolate(motionProgress, [0, 1, 1.2], [-960, 0, -150]);
  const leftShardRot = interpolate(motionProgress, [0, 1, 1.2], [-15, 0, -8]);
  
  const rightShardX = interpolate(motionProgress, [0, 1, 1.2], [960, 0, 150]);
  const rightShardRot = interpolate(motionProgress, [0, 1, 1.2], [15, 0, 8]);

  // UI Animations
  const barH = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });
  const quoteMarkS = interpolate(frame, [6, 22], [0.4, 1], { extrapolateRight: "clamp" });
  const quoteMarkOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateRight: "clamp" });
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
      {/* 3D Camera Wrapper */}
      <div style={{
        width: "100%",
        height: "100%",
        opacity: camOpacity,
        transform: `translateZ(${camZ}px) rotateX(${camRotX}deg)`,
        transformStyle: "preserve-3d"
      }}>
        <NewsBackground bgColor={bgColor} />

        {/* Continuous Left Shard */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "50%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
            transform: `translateX(${leftShardX}px) rotate(${leftShardRot}deg)`,
            zIndex: 1,
          }}
        />

        {/* Continuous Right Shard */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
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
          padding: p ? "8% 6%" : "6% 10%",
          zIndex: 3,
          transform: "translateZ(50px)" // Slight float
        }}>
          <div style={{ display: "flex", gap: p ? 20 : 32, alignItems: "flex-start", maxWidth: 860, width: "100%" }}>
            <div style={{
              width: p ? 5 : 6,
              flexShrink: 0,
              background: accentColor,
              alignSelf: "stretch",
              clipPath: `inset(0 0 ${100 - barH}% 0)`,
              minHeight: 60,
              borderRadius: 2,
            }} />

            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: H_FONT,
                fontSize: p ? 80 : 110,
                lineHeight: 0.6,
                color: accentColor,
                opacity: quoteMarkOp,
                transform: `scale(${quoteMarkS})`,
                transformOrigin: "left top",
                marginBottom: p ? 8 : 12,
              }}>
                &#8220;
              </div>

              <div style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 44 : 54),
                fontWeight: 500,
                lineHeight: 1.4,
                color: textColor,
                marginBottom: p ? 24 : 32,
              }}>
                {words.slice(0, visWords).join(" ")}
                {visWords < words.length && visWords > 0 && (
                  <span style={{ display: "inline-block", width: 2, height: "0.9em", background: textColor, opacity: 0.4, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>

              <div style={{ opacity: attrOp }}>
                <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 30 : 36), fontWeight: 700, color: textColor, marginBottom: 4 }}>
                  {narration}
                </div>
                {source && (
                  <div style={{ fontFamily: B_FONT, fontSize: p ? 14 : 16, fontWeight: 600, color: textColor, opacity: sourceOp * 0.6 }}>
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