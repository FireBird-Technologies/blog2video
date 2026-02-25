import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Img,
} from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const NewsHeadline: React.FC<
  BlogLayoutProps & {
    imageUrl?: string;
    autoHighlight?: boolean; // ✅ NEW: auto highlight toggle
  }
> = ({
  title = "Breaking News Headline Goes Here",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  category,
  imageUrl,
  autoHighlight = true, // ✅ default: true
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const cat = category ?? stats?.[0]?.label ?? "News";
  const author = stats?.[0]?.value ?? "";
  const date = stats?.[1]?.value ?? "";

  // Animations
  const catOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(frame, [6, 30], [38, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headOp = interpolate(frame, [6, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narOp = interpolate(frame, [40, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bylineOp = interpolate(frame, [50, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const highlightProgress = interpolate(frame, [22, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imageAppear = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  // Automatically select important words for highlight
  const getHighlightedWords = () => {
    if (!autoHighlight) return [];
    const words = title.split(" ");
    const uniqueWords = Array.from(new Set(words));
    // Pick 2-3 longest words as highlights
    return uniqueWords
      .filter((w) => w.length > 5)
      .slice(0, 3);
  };

  const highlightedWords = getHighlightedWords();

  const renderHeadline = () => {
    const words = title.split(" ");
    return words.map((word, i) => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, "");
      const isHighlighted = highlightedWords.some(hw => clean === hw.toLowerCase());
      return (
        <span
          key={i}
          style={
            isHighlighted
              ? {
                  backgroundImage: `linear-gradient(${accentColor}, ${accentColor})`,
                  backgroundSize: `${highlightProgress * 100}% 55%`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "0 75%",
                  paddingLeft: 4,
                  paddingRight: 4,
                }
              : undefined
          }
        >
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      );
    });
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      {/* Vintage newspaper texture — in-component so it loads in preview */}
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
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Newspaper grain overlay — zIndex 1 so it stays behind content (zIndex 2) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          opacity: 0.4,
          pointerEvents: "none",
          mixBlendMode: "multiply",
          zIndex: 1,
        }}
      />

      {/* Single Tilted Image Card */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            top: p ? 60 : 80,
            right: p ? 20 : 80,
            width: p ? 280 : 440,
            height: p ? 220 : 320,
            background: "#ffffff",
            padding: 10,
            borderRadius: 6,
            boxShadow: "0 20px 45px rgba(0,0,0,0.3)",
            transform: `rotate(-9deg) scale(${imageAppear})`,
            opacity: 0.99 + 0.1 * imageAppear,
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: "grayscale(20%) contrast(110%)",
            }}
          />
        </div>
      )}

      {/* Main Content — zIndex 2 so text sits above grain/overlays and renders sharp */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "8% 7%" : "7% 10%",
          zIndex: 2,
        }}
      >
        {/* Category */}
        <div style={{ marginBottom: p ? 22 : 30, opacity: catOp }}>
          <div
            style={{
              display: "inline-block",
              fontSize: p ? 20 : 24,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: textColor,
              borderBottom: `3px solid ${textColor}`,
              paddingBottom: 6,
            }}
          >
            {cat}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: H_FONT,
            fontSize: titleFontSize ?? (p ? 62 : 86),
            fontWeight: 800,
            lineHeight: 1.05,
            color: textColor,
            opacity: headOp,
            transform: `translateY(${headY}px)`,
            marginBottom: p ? 28 : 36,
            maxWidth: p ? "100%" : "60%",
          }}
        >
          {renderHeadline()}
        </div>

        {/* Narration */}
        {narration && (
          <div
            style={{
              fontSize: descriptionFontSize ?? (p ? 26 : 32),
              fontWeight: 600,
              color: textColor,
              opacity: narOp,
              lineHeight: 1.6,
              marginBottom: p ? 20 : 26,
              maxWidth: "70%",
            }}
          >
            {narration}
          </div>
        )}

        {/* Byline */}
        {(author || date) && (
          <div
            style={{
              fontSize: p ? 17 : 19,
              fontWeight: 600,
              color: textColor,
              opacity: bylineOp,
              display: "flex",
              gap: 10,
            }}
          >
            {author && <span style={{ fontWeight: 700 }}>By {author}</span>}
            {author && date && <span style={{ opacity: 0.4 }}>·</span>}
            {date && <span>{date}</span>}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};