import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

const CELL_STYLE: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 20,
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

export const BentoFeatures: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  features,
  highlightIndex = 0,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = features && features.length > 0
    ? features
    : narration.split(/[.;]/).filter(s => s.trim()).slice(0, 6).map((s, i) => ({
        icon: ["⚡", "🔒", "📊", "🔌", "🚀", "✨"][i % 6],
        label: s.trim().split(" ").slice(0, 3).join(" "),
        description: s.trim(),
      }));

  const cols = items.length <= 4 ? 2 : 3;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAFA", padding: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
        width: "85%",
        maxHeight: "80%",
      }}>
        {items.map((item, i) => {
          const delay = i * 4;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isAccent = i === highlightIndex;

          return (
            <div
              key={i}
              style={{
                ...CELL_STYLE,
                backgroundColor: isAccent ? (accentColor || "#F97316") : "#FFFFFF",
                transform: `scale(${0.92 + 0.08 * s})`,
                opacity,
                padding: "28px 24px",
              }}
            >
              <span style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</span>
              <span style={{
                fontSize: 18,
                fontWeight: 700,
                color: isAccent ? "#FFFFFF" : (textColor || "#171717"),
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                marginBottom: 6,
              }}>
                {item.label}
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 400,
                color: isAccent ? "rgba(255,255,255,0.85)" : "rgba(23,23,23,0.6)",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                lineHeight: 1.4,
              }}>
                {item.description}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
