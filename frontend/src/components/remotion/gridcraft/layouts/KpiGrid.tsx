import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const KpiGrid: React.FC<GridcraftLayoutProps> = ({
  dataPoints,
  highlightIndex = 0,
  accentColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = dataPoints && dataPoints.length > 0 ? dataPoints : [
      { label: "Growth", value: "10x", trend: "up" },
      { label: "Users", value: "1M+", trend: "up" },
      { label: "Latency", value: "15ms", trend: "down" }
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
        gap: 20,
        width: "90%",
        height: "80%", // Reduced height to center in canvas
        margin: "auto",
        alignItems: "center",
        fontFamily: FONT_FAMILY.SANS,
      }}
    >
      {items.slice(0, 3).map((item, i) => {
          const delay = i * 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });
          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const opacity = interpolate(s, [0, 1], [0, 1]);
          
          const isAccent = i === highlightIndex;

          const trendIcon = item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "●";
          const trendColor = item.trend === "up" ? "#22C55E" : item.trend === "down" ? "#EF4444" : COLORS.MUTED;

          return (
              <div
                key={i}
                style={{
                  ...glass(isAccent),
                  backgroundColor: isAccent ? (accentColor || COLORS.ACCENT) : undefined,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                  transform: `scale(${scale})`,
                  opacity,
                  aspectRatio: "1/1",
                }}
              >
                  <div style={{ 
                      fontSize: 64, 
                      fontWeight: 700, 
                      lineHeight: 1, 
                      color: isAccent ? COLORS.WHITE : (textColor || COLORS.DARK),
                      marginBottom: 12
                    }}>
                      {item.value || "0"}
                  </div>
                  
                  <div style={{ fontSize: 24, color: isAccent ? "rgba(255,255,255,0.8)" : trendColor }}>
                      {trendIcon}
                  </div>

                  <div style={{ 
                      marginTop: 12, 
                      fontSize: 14, 
                      textTransform: "uppercase", 
                      letterSpacing: "0.1em",
                      opacity: isAccent ? 0.9 : 0.6,
                      color: isAccent ? COLORS.WHITE : COLORS.MUTED
                   }}>
                      {item.label}
                  </div>
              </div>
          )
      })}
    </div>
  );
};
