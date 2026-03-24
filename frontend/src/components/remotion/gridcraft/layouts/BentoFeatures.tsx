import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, Easing } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";

// Default features if none provided
const DEFAULT_FEATURES = [
  { icon: "⚡", title: "Fast", description: "Renders in milliseconds" },
  { icon: "🔒", title: "Secure", description: "Transactions are encrypted" },
  { icon: "📈", title: "Scalable", description: "Auto-scales with demand" },
];

export const BentoFeatures: React.FC<GridcraftLayoutProps> = ({
  features,
  dataPoints,
  highlightIndex = 0,
  imageUrl,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Normalize items from either features or dataPoints
  const items = (features || dataPoints || DEFAULT_FEATURES).map(f => {
      // Need to handle both Feature interface and DataPoint interface
      // Feature: { icon, label, description }
      // DataPoint: { label, value, trend, icon, title, description }
      const anyF = f as any;
      return {
          icon: anyF.icon || anyF.trend, // fallback
          label: anyF.label || anyF.title,
          description: anyF.description
      };
  });

  const p = aspectRatio === "portrait";

  // Adjust grid layout based on portrait mode
  // In portrait, cards should be stacked vertically (single column)
  const gridColumns = p ? "1fr" : (items.length === 4 ? "1fr 1fr" : "1fr 1fr 1fr");
  // In portrait, each item gets its own row with auto height
  const gridRows = p ? `repeat(${items.length}, auto)` : (items.length === 4 ? "1fr 1fr" : "1fr 1fr");

  const hasImage = !!imageUrl;
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        gap: hasImage ? (p ? 24 : 32) : 0, // Gap between image and grid, or 0 if no image
        fontFamily: resolvedFontFamily,
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "80%" : "auto",
            height: p ? 220 : 320,
            borderRadius: 12,
            overflow: "hidden",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Img
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gridTemplateRows: gridRows,
          gap: 20, // Gap between feature cards
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          minWidth: 0,
        }}
      >
      {items.slice(0, 6).map((item, i) => {
        const delay = i * 4; // Stagger for each card
        const animationProgress = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 15, stiffness: 120 },
        });

        let cardScale = 1;
        let cardOpacity = 1;
        let cardTranslateY = 0;

        if (p) { // Portrait mode animation: slide up from slightly below + fade in
            cardOpacity = interpolate(animationProgress, [0, 1], [0, 1]);
            cardTranslateY = interpolate(animationProgress, [0, 1], [40, 0], { // Slide up 40px
                extrapolateLeft: "clamp",
                easing: Easing.out(Easing.ease), // Ease-out motion
            });
        } else { // Landscape mode animation: fade in and scale up from 90%
            cardScale = interpolate(animationProgress, [0, 1], [0.9, 1]); // Scale from 90% to 100%
            cardOpacity = interpolate(animationProgress, [0, 1], [0, 1]); // Fade in
        }

        // Highlight the item based on index
        const isAccent = i === highlightIndex;

        return (
          <div
            key={i}
            style={{
              ...glass(isAccent),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: 24,
              // Apply combined transforms and opacity based on mode
              transform: `scale(${cardScale}) translateY(${cardTranslateY}px)`,
              opacity: cardOpacity,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {item.icon && <div style={{ fontSize: 36, marginBottom: 16 }}>{item.icon}</div>}
            <div style={{ fontSize: titleFontSize ?? (p ? 34 : 40), fontWeight: 700, marginBottom: 8, color: isAccent ? COLORS.WHITE : (textColor || COLORS.DARK), wordBreak: "break-word" }}>
                {item.label}
            </div>
            {item.description && (
                <div style={{
                    fontSize: descriptionFontSize ?? (p ? 24 : 27),
                    lineHeight: 1.4,
                    opacity: isAccent ? 0.9 : 0.7,
                    color: isAccent ? COLORS.WHITE : COLORS.MUTED,
                    wordBreak: "break-word",
                }}>
                    {item.description}
                </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};
