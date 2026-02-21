import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

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
  
  const gridColumns = items.length === 4 ? "1fr 1fr" : "1fr 1fr 1fr";
  const rows = items.length === 4 ? "1fr 1fr" : "1fr 1fr";

  const hasImage = !!imageUrl;
  const p = aspectRatio === "portrait";

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
        gap: hasImage ? (p ? 24 : 32) : 0,
        fontFamily: FONT_FAMILY.SANS,
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
          gridTemplateRows: rows,
          gap: 20,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
        }}
      >
      {items.slice(0, 6).map((item, i) => {
        const delay = i * 4;
        const s = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 15, stiffness: 120 },
        });
        
        const scale = interpolate(s, [0, 1], [0.85, 1]);
        const op = interpolate(s, [0, 1], [0, 1]);

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
              transform: `scale(${scale})`,
              opacity: op,
            }}
          >
            {item.icon && <div style={{ fontSize: 36, marginBottom: 16 }}>{item.icon}</div>}
            <div style={{ fontSize: titleFontSize ?? 28, fontWeight: 700, marginBottom: 8, color: isAccent ? COLORS.WHITE : (textColor || COLORS.DARK) }}>
                {item.label}
            </div>
            {item.description && (
                <div style={{ 
                    fontSize: descriptionFontSize ?? 18, 
                    lineHeight: 1.4,
                    opacity: isAccent ? 0.9 : 0.7, 
                    color: isAccent ? COLORS.WHITE : COLORS.MUTED 
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
