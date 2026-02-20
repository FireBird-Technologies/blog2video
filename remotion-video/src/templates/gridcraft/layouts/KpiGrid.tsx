import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const KpiGrid: React.FC<GridcraftLayoutProps> = ({
  dataPoints,
  highlightIndex = 0,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = dataPoints && dataPoints.length > 0 ? dataPoints : [
      { label: "Growth", value: "10x", trend: "up" },
      { label: "Users", value: "1M+", trend: "up" },
      { label: "Latency", value: "15ms", trend: "down" }
  ];

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
            ...glass(false),
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
          gap: 20,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          alignItems: "center",
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
                      color: isAccent ? COLORS.WHITE : textColor,
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
    </div>
  );
};
