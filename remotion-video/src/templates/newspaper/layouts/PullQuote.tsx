import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
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
  const p = aspectRatio === "portrait";

  const source = stats?.[0]?.label ?? "";

  const barH       = interpolate(frame, [0, 18],  [0, 100], { extrapolateRight: "clamp" });
  const quoteMarkS = interpolate(frame, [6, 22],  [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteMarkOp= interpolate(frame, [6, 20],  [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const words        = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visWords     = Math.floor(words.length * wordProgress);

  const attrOp  = interpolate(frame, [50, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sourceOp= interpolate(frame, [58, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: p ? "8% 6%" : "6% 10%" }}>
        <div style={{ display: "flex", gap: p ? 20 : 32, alignItems: "flex-start", maxWidth: 860, width: "100%" }}>
          <div style={{ width: p ? 5 : 6, flexShrink: 0, background: accentColor, alignSelf: "stretch", clipPath: `inset(0 0 ${100 - barH}% 0)`, minHeight: 60, borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: H_FONT, fontSize: p ? 80 : 110, lineHeight: 0.6, color: accentColor, opacity: quoteMarkOp, transform: `scale(${quoteMarkS})`, transformOrigin: "left top", display: "block", marginBottom: p ? 8 : 12, userSelect: "none" }}>
              &#8220;
            </div>
            <div style={{ fontFamily: H_FONT, fontSize: titleFontSize ?? (p ? 30 : 38), fontWeight: 400, lineHeight: 1.4, color: textColor, marginBottom: p ? 24 : 32, letterSpacing: "-0.01em" }}>
              {words.slice(0, visWords).join(" ")}
              {visWords < words.length && visWords > 0 && (
                <span style={{ display: "inline-block", width: 2, height: "0.9em", background: textColor, opacity: 0.4, marginLeft: 4, verticalAlign: "middle" }} />
              )}
            </div>
            {narration && (
              <div style={{ opacity: attrOp }}>
                <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 16 : 19), fontWeight: 600, color: textColor, marginBottom: 4 }}>{narration}</div>
                {source && <div style={{ fontFamily: B_FONT, fontSize: p ? 13 : 15, color: textColor, opacity: sourceOp * 0.55, letterSpacing: "0.04em" }}>{source}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
