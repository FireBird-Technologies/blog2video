import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const NewsHeadline: React.FC<BlogLayoutProps> = ({
  title = "Partial government shutdown begins as funding lapses",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  leftThought = "",
  category,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const cat    = category ?? stats?.[0]?.label ?? "News";
  const author = stats?.[0]?.value ?? "";
  const date   = stats?.[1]?.value ?? "";

  const hlWords = leftThought
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  const catOp   = interpolate(frame, [0, 14],  [0, 1], { extrapolateRight: "clamp" });
  const ruleTagW= interpolate(frame, [4, 18],  [0, 100], { extrapolateRight: "clamp" });
  const headY   = interpolate(frame, [6, 30],  [38, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headOp  = interpolate(frame, [6, 28],  [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hlP     = interpolate(frame, [22, 46], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hrW     = interpolate(frame, [32, 50], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narOp   = interpolate(frame, [40, 58], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bylineOp= interpolate(frame, [50, 68], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const renderHeadline = () => {
    const words = title.split(" ");
    return words.map((word, i) => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, "");
      const hit   = hlWords.some((hw) => clean.startsWith(hw) || hw.startsWith(clean));
      return (
        <span
          key={i}
          style={
            hit
              ? {
                  backgroundImage: `linear-gradient(${accentColor}, ${accentColor})`,
                  backgroundSize: `${hlP * 100}% 44%`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "0 72%",
                  paddingLeft: 2,
                  paddingRight: 2,
                }
              : undefined
          }
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      );
    });
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "8% 7%" : "7% 10%",
        }}
      >
        <div style={{ marginBottom: p ? 14 : 20, opacity: catOp }}>
          <div
            style={{
              display: "inline-block",
              fontFamily: B_FONT,
              fontSize: p ? 14 : 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: textColor,
              paddingBottom: 6,
              borderBottom: `2.5px solid ${textColor}`,
            }}
          >
            {cat}
          </div>
          <div style={{ height: 1, background: `${textColor}22`, width: `${ruleTagW}%`, marginTop: 4 }} />
        </div>
        <div
          style={{
            fontFamily: H_FONT,
            fontSize: titleFontSize ?? (p ? 48 : 64),
            fontWeight: 700,
            lineHeight: 1.08,
            color: textColor,
            opacity: headOp,
            transform: `translateY(${headY}px)`,
            marginBottom: p ? 22 : 28,
          }}
        >
          {renderHeadline()}
        </div>
        <div
          style={{
            height: 1,
            background: textColor,
            opacity: 0.12,
            width: `${hrW}%`,
            marginBottom: p ? 18 : 24,
          }}
        />
        {narration && (
          <div
            style={{
              fontFamily: B_FONT,
              fontSize: descriptionFontSize ?? (p ? 19 : 23),
              color: textColor,
              opacity: narOp * 0.82,
              lineHeight: 1.55,
              marginBottom: p ? 18 : 22,
              maxWidth: "80%",
            }}
          >
            {narration}
          </div>
        )}
        {(author || date) && (
          <div
            style={{
              fontFamily: B_FONT,
              fontSize: p ? 14 : 16,
              color: textColor,
              opacity: bylineOp * 0.65,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            {author && <span style={{ color: "#2563EB", fontWeight: 600 }}>By {author}</span>}
            {author && date && <span style={{ opacity: 0.4 }}>·</span>}
            {date && <span>{date}</span>}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
