import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FactCheck: React.FC<BlogLayoutProps> = ({
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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const leftLabel  = stats?.[0]?.label ?? "CLAIMED";
  const rightLabel = stats?.[1]?.label ?? "THE FACTS";

  // Animations
  const headerOp  = interpolate(frame, [0, 14],  [0, 1],   { extrapolateRight: "clamp" });
  const leftX     = interpolate(frame, [8, 32],  [-60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leftOp    = interpolate(frame, [8, 28],  [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightX    = interpolate(frame, [14, 38], [60, 0],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightOp   = interpolate(frame, [14, 34], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dividerH  = interpolate(frame, [26, 44], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const verdictOp = interpolate(frame, [42, 56], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hlSweep   = interpolate(frame, [18, 40], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const badgeHL = (color: string) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundSize:  `${hlSweep * 100}% 100%`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "0 0",
  });

  // --- Shard motion ---
  const { width, height } = { width: p ? 1080 : 1920, height: p ? 1920 : 1080 };

  const joinProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const breakProgress = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // Left shard
  const leftShardX = -width / 2 * (1 - joinProgress) - 40 * breakProgress;
  const leftShardY = -height / 5 * (1 - joinProgress) - 20 * breakProgress;
  const leftShardRot = -8 + 8 * joinProgress + 2 * breakProgress;
  const leftShardOpacity = 0.35 + 0.15 * joinProgress;
  const leftShardScale = 0.95 + 0.05 * joinProgress;

  // Right shard (stays anchored to right)
  const rightShardX = -40 * breakProgress;
  const rightShardY = height / 5 * (1 - joinProgress) + 20 * breakProgress;
  const rightShardRot = 8 - 8 * joinProgress - 2 * breakProgress;
  const rightShardOpacity = 0.35 + 0.15 * joinProgress;
  const rightShardScale = 0.95 + 0.05 * joinProgress;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      {/* Shards */}
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
          objectPosition: "center",
          opacity: leftShardOpacity,
          transform: `rotate(${leftShardRot}deg) scale(${leftShardScale})`,
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
          objectPosition: "center",
          opacity: rightShardOpacity,
          transform: `rotate(${rightShardRot}deg) scale(${rightShardScale})`,
          zIndex: 1,
        }}
      />

      {/* Gradient overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(235,225,210,0.42) 0%, rgba(245,238,225,0.38) 50%, rgba(225,215,195,0.42) 100%)",
          pointerEvents: "none",
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
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 40 : 52),
                fontWeight: 800,
                color: textColor,
                lineHeight: 1,
              }}
            >
              {title}
            </div>
          </div>
          <div style={{ height: 2, background: textColor, opacity: 0.1, width: "100%" }} />
        </div>

        {/* Two columns */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: 0,
            alignItems: "stretch",
            position: "relative",
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: 1,
              opacity: leftOp,
              transform: `translateX(${leftX}px)`,
              paddingRight: p ? 0 : 32,
              paddingBottom: p ? 20 : 0,
            }}
          >
            <div
              style={{
                display: "inline-block",
                fontFamily: B_FONT,
                fontSize: p ? 11 : 13,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: textColor,
                ...badgeHL(accentColor),
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                marginBottom: 14,
              }}
            >
              {leftLabel}
            </div>
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: descriptionFontSize ?? (p ? 24 : 30),
                fontWeight: 500,
                color: textColor,
                lineHeight: 1.45,
                fontStyle: "italic",
              }}
            >
              "{leftThought}"
            </div>
          </div>

          {/* Divider */}
          {!p && (
            <div
              style={{
                width: 1,
                flexShrink: 0,
                background: textColor,
                opacity: 0.14,
                alignSelf: "stretch",
                clipPath: `inset(0 0 ${100 - dividerH}% 0)`,
              }}
            />
          )}
          {p && (
            <div
              style={{
                height: 1,
                background: textColor,
                opacity: 0.14,
                width: `${dividerH}%`,
                marginBottom: 20,
              }}
            />
          )}

          {/* Right column */}
          <div
            style={{
              flex: 1,
              opacity: rightOp,
              transform: `translateX(${rightX}px)`,
              paddingLeft: p ? 0 : 32,
            }}
          >
            <div
              style={{
                display: "inline-block",
                fontFamily: B_FONT,
                fontSize: p ? 11 : 13,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: textColor,
                border: `1.5px solid ${textColor}`,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                marginBottom: 14,
                opacity: 0.7,
              }}
            >
              {rightLabel}
            </div>
            <div
              style={{
                fontFamily: B_FONT,
                fontSize: descriptionFontSize ?? (p ? 21 : 26),
                fontWeight: 500,
                color: textColor,
                lineHeight: 1.55,
                opacity: 0.95,
              }}
            >
              {rightThought}
            </div>
          </div>
        </div>

        {/* Verdict */}
        {narration && (
          <div
            style={{
              opacity: verdictOp,
              borderTop: `2px solid ${accentColor}`,
              paddingTop: 14,
              fontFamily: B_FONT,
              fontSize:  descriptionFontSize ?? (p ? 21 : 26),
              fontWeight: 700,
              color: textColor,
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};