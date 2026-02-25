import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const DataSnapshot: React.FC<BlogLayoutProps> = ({
  title = "By the Numbers",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats = [
    { value: "800K", label: "Federal workers affected" },
    { value: "47%",  label: "Agencies impacted" },
    { value: "32",   label: "Days until next deadline" },
    { value: "$6B",  label: "Daily economic cost" },
  ],
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const items = stats.slice(0, 4);

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW   = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      <img
        src={staticFile("vintage-news.avif")}
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

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "7% 6%" : "6% 9%", gap: p ? 24 : 32, zIndex: 2 }}>
        <div style={{ opacity: titleOp }}>
          <div style={{ fontFamily: H_FONT, fontSize: titleFontSize ?? (p ? 42 : 54), fontWeight: 800, color: textColor, lineHeight: 1.1, marginBottom: 10 }}>{title}</div>
          <div style={{ height: 2, background: textColor, opacity: 0.12, width: `${ruleW}%` }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: p ? 16 : 22, alignContent: "flex-start" }}>
          {items.map((item, i) => {
            const delay = 12 + i * 10;
            const cardOp = interpolate(frame, [delay, delay + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const cardY  = interpolate(frame, [delay, delay + 18], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const ulW    = interpolate(frame, [delay + 8, delay + 22], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const numMatch  = item.value.match(/^(\d+(?:\.\d+)?)(.*)/);
            const baseNum   = numMatch ? parseFloat(numMatch[1]) : null;
            const suffix    = numMatch ? numMatch[2] : "";
            const prefix    = item.value.startsWith("$") ? "$" : "";
            const rawNumStr = numMatch ? numMatch[1] : item.value;
            const numP       = interpolate(frame, [delay + 2, delay + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const animatedN  = baseNum !== null ? Math.round(baseNum * numP) : null;
            const displayVal = animatedN !== null ? (prefix + (rawNumStr.includes(".") ? (baseNum! * numP).toFixed(1) : animatedN) + suffix) : item.value;
            const cardW = p ? "calc(50% - 8px)" : items.length <= 2 ? "calc(50% - 11px)" : "calc(25% - 17px)";

            return (
              <div
                key={i}
                style={{
                  width: cardW,
                  opacity: cardOp,
                  transform: `translateY(${cardY}px)`,
                  backgroundColor: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 8,
                  padding: p ? "16px 18px" : "20px 22px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontFamily: H_FONT, fontSize: p ? 46 : 58, fontWeight: 800, color: textColor, lineHeight: 1, marginBottom: 10 }}>{displayVal}</div>
                <div style={{ height: 4, background: accentColor, borderRadius: 2, width: `${ulW}%`, marginBottom: 10 }} />
                <div style={{ fontFamily: B_FONT, fontSize: p ? 15 : 17, fontWeight: 500, color: textColor, opacity: 0.75, lineHeight: 1.3 }}>{item.label}</div>
              </div>
            );
          })}
        </div>
        {narration && (
          <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 15 : 17), fontWeight: 500, color: textColor, opacity: interpolate(frame, [60, 76], [0, 0.6], { extrapolateRight: "clamp" }), lineHeight: 1.4 }}>
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
