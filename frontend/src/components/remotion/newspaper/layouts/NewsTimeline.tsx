import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Img } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const NewsTimeline: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "How We Got Here",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats = [
    { value: "Sep 30", label: "Fiscal year deadline passes without a budget" },
    { value: "Oct 15", label: "House passes short-term CR — Senate delays vote" },
    { value: "Jan 19", label: "Senate reaches bipartisan deal on 45-day extension" },
    { value: "Jan 31", label: "Midnight deadline missed — partial shutdown begins" },
    { value: "Feb 3", label: "Emergency session called to negotiate reopening" },
  ],
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const items = stats.slice(0, 5);

  // Header
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });

  // Spine grows as items are revealed
  const spineH = interpolate(frame, [12, 12 + items.length * 14 + 10], [0, 100], { extrapolateRight: "clamp" });

  const ITEM_START = 18;
  const ITEM_STEP = 14;

  // Image animation
  const imageAppear = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <NewsBackground bgColor={bgColor} />

      {/* Single Image Card — tilted + slightly broken */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            bottom: p ? 180 : 220,
            right: p ? 20 : 80,
            width: p ? 280 : 440,
            height: p ? 220 : 320,
            background: "#ffffff",
            padding: 10,
            borderRadius: 6,
            boxShadow: "0 20px 45px rgba(0,0,0,0.3)",
            transform: `rotate(-9deg) scale(${imageAppear}) translate(6px, 12px)`,
            opacity: imageAppear,
            overflow: "hidden",
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "6% 6%" : "5% 10%",
          gap: p ? 22 : 32,
        }}
      >
        {/* Header */}
        <div style={{ opacity: titleOp }}>
          <div
            style={{
              fontFamily: H_FONT,
              fontSize: titleFontSize ?? (p ? 42 : 56),
              fontWeight: 700,
              color: textColor,
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            {title}
          </div>
          <div style={{ height: 3, background: textColor, opacity: 0.1, width: `${ruleW}%` }} />
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, display: "flex", position: "relative" }}>
          {/* Vertical spine */}
          <div
            style={{
              width: 2,
              flexShrink: 0,
              background: `${textColor}20`,
              alignSelf: "stretch",
              marginRight: p ? 22 : 32,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: `${spineH}%`,
                background: accentColor,
              }}
            />
          </div>

          {/* Items */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: p ? 18 : 24 }}>
            {items.map((item, i) => {
              const start = ITEM_START + i * ITEM_STEP;
              const dotS = interpolate(frame, [start, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const dateOp = interpolate(frame, [start, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const textX = interpolate(frame, [start + 2, start + 14], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const textOp = interpolate(frame, [start + 2, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

              const isLatest = i === items.length - 1;

              return (
                <div key={i} style={{ display: "flex", gap: p ? 24 : 36, position: "relative", flexWrap: "wrap" }}>
                  {/* Dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: -(p ? 22 : 32) - 1 - 6,
                      top: p ? 4 : 5,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: isLatest ? accentColor : bgColor,
                      border: `2.5px solid ${isLatest ? accentColor : textColor}`,
                      opacity: isLatest ? dotS : dotS * 0.65,
                      transform: `scale(${dotS})`,
                      boxShadow: isLatest ? `0 0 0 2px ${accentColor}33` : "none",
                    }}
                  />

                  {/* Date */}
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 16 : 20,
                      fontWeight: 700,
                      color: isLatest ? accentColor : textColor,
                      opacity: dateOp * (isLatest ? 1 : 0.7),
                      whiteSpace: "nowrap",
                      minWidth: p ? 70 : 90,
                      marginTop: p ? 2 : 3,
                      letterSpacing: "0.08em",
                      filter: isLatest ? `drop-shadow(0 0 2px ${accentColor}33)` : "none",
                    }}
                  >
                    {item.value}
                  </div>

                  {/* Event description — width 65%, wrap if exceeds */}
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: descriptionFontSize ?? (p ? 20 : 28),
                      color: textColor,
                      opacity: textOp * (isLatest ? 1 : 0.82),
                      transform: `translateX(${textX}px)`,
                      lineHeight: 1.4,
                      fontWeight: isLatest ? 600 : 400,
                      borderLeft: isLatest ? `3px solid ${accentColor}` : "3px solid transparent",
                      paddingLeft: isLatest ? 10 : 0,
                      maxWidth: "65%",      // ⬅️ limit text width
                      wordWrap: "break-word", // ⬅️ wrap long lines
                      overflowWrap: "break-word",
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Caption */}
        {narration && (
          <div
            style={{
              fontFamily: B_FONT,
              fontSize: p ? 14 : 16,
              color: textColor,
              opacity: interpolate(frame, [70, 85], [0, 0.5], { extrapolateRight: "clamp" }),
              lineHeight: 1.4,
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};