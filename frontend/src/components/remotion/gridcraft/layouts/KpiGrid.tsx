import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

const TrendArrow: React.FC<{ trend?: string; isAccent: boolean }> = ({ trend, isAccent }) => {
  if (!trend || trend === "neutral") {
    return <span style={{ fontSize: 14, color: isAccent ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}>●</span>;
  }
  if (trend === "up") {
    return <span style={{ fontSize: 16, color: isAccent ? "#FFFFFF" : "#22C55E" }}>▲</span>;
  }
  return <span style={{ fontSize: 16, color: isAccent ? "rgba(255,255,255,0.9)" : "#EF4444" }}>▼</span>;
};

export const KpiGrid: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  dataPoints,
  highlightIndex = 0,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = dataPoints && dataPoints.length > 0
    ? dataPoints
    : [
        { label: "Metric 1", value: "0", trend: "neutral" as const },
        { label: "Metric 2", value: "0", trend: "neutral" as const },
        { label: "Metric 3", value: "0", trend: "neutral" as const },
      ];

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor || "#FAFAFA",
      padding: "5%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Title */}
      <h2 style={{
        fontSize: 28,
        fontWeight: 600,
        color: textColor || "#171717",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        marginBottom: 32,
        opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {title}
      </h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
        gap: 12,
        width: "85%",
      }}>
        {items.slice(0, 3).map((item, i) => {
          const delay = 6 + i * 6;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isAccent = i === highlightIndex;

          // Counter roll-up animation
          const numericValue = parseFloat(item.value.replace(/[^0-9.-]/g, "")) || 0;
          const suffix = item.value.replace(/[0-9.-]/g, "");
          const counterProgress = interpolate(frame, [delay + 5, delay + 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const displayValue = Math.round(numericValue * counterProgress);
          const displayStr = numericValue === 0 ? item.value : `${displayValue}${suffix}`;

          return (
            <div
              key={i}
              style={{
                backgroundColor: isAccent ? (accentColor || "#F97316") : "#FFFFFF",
                borderRadius: 20,
                padding: "40px 32px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${0.92 + 0.08 * s})`,
                opacity,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                aspectRatio: "1",
              }}
            >
              <span style={{
                fontSize: 52,
                fontWeight: 700,
                color: isAccent ? "#FFFFFF" : (textColor || "#171717"),
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                fontVariantNumeric: "tabular-nums",
                marginBottom: 8,
              }}>
                {displayStr}
              </span>
              <TrendArrow trend={item.trend} isAccent={isAccent} />
              <span style={{
                fontSize: 14,
                fontWeight: 400,
                color: isAccent ? "rgba(255,255,255,0.8)" : "rgba(23,23,23,0.5)",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                marginTop: 8,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
