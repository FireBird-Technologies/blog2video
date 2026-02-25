import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif'";

/**
 * PullQuote — large editorial pull-quote card with animated background shards.
 *
 * Animation (30 fps):
 *  0-18   vertical accent bar grows top→bottom
 *  6-22   large opening quote mark fades in + scales
 *  16-52  quote text reveals word-by-word
 *  48-62  attribution fades in
 *  56-70  source/publication label fades in
 *  0-50   background shards slide in and join center
 *  50-80  shards break apart and drift out
 *
 */
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
  const p = aspectRatio === "portrait";

  const source = stats?.[0]?.label ?? "";

  // Vertical accent bar
  const barH = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });

  // Quote mark animation
  const quoteMarkS = interpolate(frame, [6, 22], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteMarkOp = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Quote text — word-by-word
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visWords = Math.floor(words.length * wordProgress);

  // Attribution
  const attrOp = interpolate(frame, [50, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sourceOp = interpolate(frame, [58, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Background shards motion
  const joinProgress = interpolate(frame, [0, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const driftProgress = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Left shard
  const leftShardX = -960 * (1 - joinProgress) - 50 * driftProgress;
  const leftShardY = -200 * (1 - joinProgress) - 20 * driftProgress;
  const leftShardRot = -15 + 15 * joinProgress + 5 * driftProgress;
  const leftShardScale = 0.85 + 0.15 * joinProgress;

  // Right shard
  const rightShardX = 960 * (1 - joinProgress) + 50 * driftProgress;
  const rightShardY = -200 * (1 - joinProgress) + 20 * driftProgress;
  const rightShardRot = 15 - 15 * joinProgress - 5 * driftProgress;
  const rightShardScale = 0.85 + 0.15 * joinProgress;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      {/* Background shards */}
      <img
        src="/vintage-news.avif"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          opacity: 0.3,
          transform: `translate(${leftShardX}px, ${leftShardY}px) rotate(${leftShardRot}deg) scale(${leftShardScale})`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
      <img
        src="/vintage-news.avif"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          opacity: 0.3,
          transform: `translate(${rightShardX}px, ${rightShardY}px) rotate(${rightShardRot}deg) scale(${rightShardScale})`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Newspaper texture overlay */}
      <img
        src="/vintage-news.avif"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          opacity: 0.2,
          filter: "grayscale(75%) contrast(1.08)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 6%" : "6% 10%",
          zIndex: 3,
        }}
      >
        <div style={{ display: "flex", gap: p ? 20 : 32, alignItems: "flex-start", maxWidth: 860, width: "100%" }}>
          {/* Vertical accent bar */}
          <div
            style={{
              width: p ? 5 : 6,
              flexShrink: 0,
              background: accentColor,
              alignSelf: "stretch",
              clipPath: `inset(0 0 ${100 - barH}% 0)`,
              minHeight: 60,
              borderRadius: 2,
            }}
          />

          <div style={{ flex: 1 }}>
            {/* Opening quote mark */}
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: p ? 80 : 110,
                lineHeight: 0.6,
                color: accentColor,
                opacity: quoteMarkOp,
                transform: `scale(${quoteMarkS})`,
                transformOrigin: "left top",
                display: "block",
                marginBottom: p ? 8 : 12,
                userSelect: "none",
              }}
            >
              &#8220;
            </div>

            {/* Quote text — word by word */}
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 44 : 54),
                fontWeight: 500,
                lineHeight: 1.4,
                color: textColor,
                marginBottom: p ? 24 : 32,
                letterSpacing: "-0.01em",
              }}
            >
              {words.slice(0, visWords).join(" ")}
              {visWords < words.length && visWords > 0 && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "0.9em",
                    background: textColor,
                    opacity: 0.4,
                    marginLeft: 4,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </div>

            {/* Attribution */}
            {narration && (
              <div style={{ opacity: attrOp }}>
                <div
                  style={{
                    fontFamily: B_FONT,
                    fontSize: descriptionFontSize ?? (p ? 30 : 36),
                    fontWeight: 700,
                    color: textColor,
                    marginBottom: 4,
                  }}
                >
                  {narration}
                </div>
                {source && (
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 14 : 16,
                      fontWeight: 600,
                      color: textColor,
                      opacity: sourceOp * 0.6,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {source}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};