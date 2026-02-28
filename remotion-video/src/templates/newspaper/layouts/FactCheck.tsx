import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FactCheck: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "Fact Check",
  narration,
  leftThought  = "The shutdown will only last a few hours.",
  rightThought = "Past shutdowns have averaged 16 days. Essential services may be suspended indefinitely.",
  accentColor  = "#FFE34D",
  bgColor      = "#FAFAF8",
  textColor    = "#111111",
  aspectRatio  = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const leftLabel  = stats?.[0]?.label ?? "CLAIMED";
  const rightLabel = stats?.[1]?.label ?? "THE FACTS";

  // Existing Animations
  const headerOp   = interpolate(frame, [0, 14],  [0, 1],   { extrapolateRight: "clamp" });
  const leftX      = interpolate(frame, [8, 32],  [-60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leftOp     = interpolate(frame, [8, 28],  [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightX     = interpolate(frame, [14, 38], [60, 0],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightOp    = interpolate(frame, [14, 34], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dividerH   = interpolate(frame, [26, 44], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const verdictOp  = interpolate(frame, [42, 56], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hlSweep    = interpolate(frame, [18, 40], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Image Specific Animations
  const imageOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [30, 50], [0.8, 1], { extrapolateRight: "clamp" });
  const imageRotation = interpolate(frame, [30, 50], [-5, 3], { extrapolateRight: "clamp" });

  const badgeHL = (color: string) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundSize:  `${hlSweep * 100}% 100%`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "0 0",
  });

  const { width, height } = { width: p ? 1080 : 1920, height: p ? 1920 : 1080 };
  const joinProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const breakProgress = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // Shard motion
  const leftShardX = -width / 2 * (1 - joinProgress) - 40 * breakProgress;
  const leftShardY = -height / 5 * (1 - joinProgress) - 20 * breakProgress;
  const leftShardRot = -8 + 8 * joinProgress + 2 * breakProgress;
  
  const rightShardX = -40 * breakProgress;
  const rightShardY = height / 5 * (1 - joinProgress) + 20 * breakProgress;
  const rightShardRot = 8 - 8 * joinProgress - 2 * breakProgress;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      {/* Background Shards */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: leftShardY,
          left: leftShardX,
          width: width / 2,
          height,
          objectFit: "cover",
          opacity: 0.4,
          transform: `rotate(${leftShardRot}deg)`,
          zIndex: 1,
        }}
      />
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: rightShardY,
          right: rightShardX,
          width: width / 2,
          height,
          objectFit: "cover",
          opacity: 0.4,
          transform: `rotate(${rightShardRot}deg)`,
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "7% 6%" : "5% 8%",
          gap: p ? 20 : 28,
          zIndex: 2,
        }}
      >
        {/* Header */}
        <div style={{ opacity: headerOp }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <svg width={p ? 28 : 34} height={p ? 28 : 34} viewBox="0 0 34 34" fill="none">
              <circle cx="14" cy="14" r="10" stroke={textColor} strokeWidth="3" />
              <line x1="22" y1="22" x2="31" y2="31" stroke={textColor} strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{
              fontFamily: H_FONT,
              fontSize: titleFontSize ?? (p ? 40 : 52),
              fontWeight: 800,
              color: textColor,
              lineHeight: 1,
            }}>
              {title}
            </div>
          </div>
          <div style={{ height: 2, background: textColor, opacity: 0.1, width: "100%" }} />
        </div>

        {/* Two columns + Image Area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: p ? "column" : "row",
          position: "relative",
        }}>
          {/* Main Content (Columns) */}
          <div style={{ flex: 2, display: "flex", flexDirection: p ? "column" : "row" }}>
            <div style={{ flex: 1, opacity: leftOp, transform: `translateX(${leftX}px)`, paddingRight: p ? 0 : 32, paddingBottom: p ? 20 : 0 }}>
              <div style={{ display: "inline-block", fontFamily: B_FONT, fontSize: p ? 11 : 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: textColor, ...badgeHL(accentColor), padding: "3px 6px", marginBottom: 14 }}>
                {leftLabel}
              </div>
              <div style={{ fontFamily: H_FONT, fontSize: descriptionFontSize ?? (p ? 22 : 28), fontWeight: 500, color: textColor, lineHeight: 1.45, fontStyle: "italic" }}>
                "{leftThought}"
              </div>
            </div>

            <div style={{ width: p ? "100%" : 1, height: p ? 1 : "auto", background: textColor, opacity: 0.14, margin: p ? "10px 0" : "0", alignSelf: "stretch", clipPath: !p ? `inset(0 0 ${100 - dividerH}% 0)` : "none" }} />

            <div style={{ flex: 1, opacity: rightOp, transform: `translateX(${rightX}px)`, paddingLeft: p ? 0 : 32 }}>
              <div style={{ display: "inline-block", fontFamily: B_FONT, fontSize: p ? 11 : 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: textColor, border: `1.5px solid ${textColor}`, padding: "3px 6px", marginBottom: 14, opacity: 0.7 }}>
                {rightLabel}
              </div>
              <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 20 : 24), fontWeight: 500, color: textColor, lineHeight: 1.55, opacity: 0.95 }}>
                {rightThought}
              </div>
            </div>
          </div>

          {/* VINTAGE IMAGE CUTOUT - Positions itself at the bottom-right of the columns */}
          {imageUrl && (
            <div style={{
              position: p ? "relative" : "absolute",
              bottom: p ? 0 : "-5%",
              right: p ? "auto" : 0,
              width: p ? "60%" : "35%",
              alignSelf: p ? "center" : "flex-end",
              marginTop: p ? 20 : 0,
              zIndex: 5,
              opacity: imageOpacity,
              transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
              backgroundColor: "#fdf8e6",
              padding: "8px",
              boxShadow: "5px 15px 30px rgba(0,0,0,0.2)",
              border: "1px dashed #aaa",
            }}>
              <div style={{ position: "relative", overflow: "hidden" }}>
                <Img
                  src={imageUrl}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    filter: "grayscale(100%) contrast(1.2) brightness(0.95)",
                    mixBlendMode: "multiply",
                  }}
                />
                {/* HALFTONE DOT OVERLAY */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.12,
                  mixBlendMode: "multiply",
                  backgroundImage: `radial-gradient(circle at center, black 1px, transparent 1.2px)`,
                  backgroundSize: "3px 3px",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Verdict */}
        {narration && (
          <div style={{ opacity: verdictOp, borderTop: `2px solid ${accentColor}`, paddingTop: 14, fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 21 : 26), fontWeight: 700, color: textColor }}>
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};