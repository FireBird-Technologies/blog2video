import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const DEFAULT_ITEMS = [
  { value: "Sep 30", label: "Fiscal year deadline passes without a budget" },
  { value: "Oct 15", label: "House passes short-term CR — Senate delays vote" },
  { value: "Jan 19", label: "Senate reaches bipartisan deal on 45-day extension" },
  { value: "Jan 31", label: "Midnight deadline missed — partial shutdown begins" },
  { value: "Feb 3",  label: "Emergency session called to negotiate reopening" },
];

export const NewsTimeline: React.FC<BlogLayoutProps> = ({
  title = "How We Got Here",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats = DEFAULT_ITEMS,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const items = stats.slice(0, 5);

  const titleOp = interpolate(frame, [0, 16],  [0, 1],   { extrapolateRight: "clamp" });
  const ruleW   = interpolate(frame, [4, 20],  [0, 100], { extrapolateRight: "clamp" });
  const spineH  = interpolate(frame, [12, 12 + items.length * 14 + 10], [0, 100], { extrapolateRight: "clamp" });

  const ITEM_START = 18;
  const ITEM_STEP  = 14;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "6% 6%" : "5% 9%", gap: p ? 18 : 24 }}>
        <div style={{ opacity: titleOp }}>
          <div style={{ fontFamily: H_FONT, fontSize: titleFontSize ?? (p ? 36 : 48), fontWeight: 700, color: textColor, lineHeight: 1.1, marginBottom: 10 }}>{title}</div>
          <div style={{ height: 2, background: textColor, opacity: 0.1, width: `${ruleW}%` }} />
        </div>
        <div style={{ flex: 1, display: "flex", position: "relative" }}>
          <div style={{ width: 2, flexShrink: 0, background: `${textColor}20`, alignSelf: "stretch", marginRight: p ? 18 : 28, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${spineH}%`, background: accentColor }} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: p ? 14 : 18 }}>
            {items.map((item, i) => {
              const start = ITEM_START + i * ITEM_STEP;
              const dotS   = interpolate(frame, [start, start + 6],  [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const dateOp = interpolate(frame, [start, start + 10], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const textX  = interpolate(frame, [start + 2, start + 14], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const textOp = interpolate(frame, [start + 2, start + 12], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const isLatest = i === items.length - 1;

              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: p ? 14 : 20, position: "relative" }}>
                  <div style={{ position: "absolute", left: -(p ? 18 : 28) - 1 - 6, top: p ? 4 : 5, width: 12, height: 12, borderRadius: "50%", background: isLatest ? accentColor : bgColor, border: `2.5px solid ${isLatest ? accentColor : textColor}`, opacity: isLatest ? dotS : dotS * 0.65, transform: `scale(${dotS})`, boxShadow: isLatest ? `0 0 0 3px ${accentColor}44` : "none" }} />
                  <div style={{ fontFamily: B_FONT, fontSize: p ? 12 : 14, fontWeight: 700, color: isLatest ? accentColor : textColor, opacity: dateOp * (isLatest ? 1 : 0.55), whiteSpace: "nowrap", minWidth: p ? 52 : 62, letterSpacing: "0.04em", marginTop: p ? 2 : 3, filter: isLatest ? `drop-shadow(0 0 4px ${accentColor})` : "none" }}>{item.value}</div>
                  <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 15 : 18), color: textColor, opacity: textOp * (isLatest ? 1 : 0.82), transform: `translateX(${textX}px)`, lineHeight: 1.4, fontWeight: isLatest ? 600 : 400, borderLeft: isLatest ? `3px solid ${accentColor}` : "3px solid transparent", paddingLeft: isLatest ? 10 : 0 }}>{item.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        {narration && (
          <div style={{ fontFamily: B_FONT, fontSize: p ? 13 : 15, color: textColor, opacity: interpolate(frame, [70, 85], [0, 0.5], { extrapolateRight: "clamp" }), lineHeight: 1.4 }}>{narration}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
