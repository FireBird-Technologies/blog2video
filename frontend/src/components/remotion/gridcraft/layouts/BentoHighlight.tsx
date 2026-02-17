import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const BentoHighlight: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  mainPoint,
  supportingFacts,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainText = mainPoint || narration;
  const facts = supportingFacts && supportingFacts.length >= 2
    ? supportingFacts
    : [narration.split(".")[0]?.trim() || "Detail 1", narration.split(".")[1]?.trim() || "Detail 2"];

  const mainScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const mainOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAFA", padding: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: 12,
        width: "85%",
      }}>
        {/* Large top cell */}
        <div style={{
          gridColumn: "1 / -1",
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "40px 44px",
          transform: `scale(${0.92 + 0.08 * mainScale})`,
          opacity: mainOpacity,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          borderLeft: `4px solid ${accentColor || "#F97316"}`,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 600,
            color: accentColor || "#F97316",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            margin: "0 0 12px 0",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>
            {title}
          </h2>
          <p style={{
            fontSize: 28,
            fontWeight: 500,
            color: textColor || "#171717",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.4,
            margin: 0,
          }}>
            {mainText}
          </p>
        </div>

        {/* Supporting fact cells */}
        {facts.slice(0, 2).map((fact, i) => {
          const delay = 8 + i * 6;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          return (
            <div
              key={i}
              style={{
                backgroundColor: i === 0 ? (accentColor || "#F97316") : "#FFFFFF",
                borderRadius: 20,
                padding: "28px 32px",
                display: "flex",
                alignItems: "center",
                transform: `scale(${0.92 + 0.08 * s})`,
                opacity,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <p style={{
                fontSize: 18,
                fontWeight: 500,
                color: i === 0 ? "#FFFFFF" : (textColor || "#171717"),
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                lineHeight: 1.5,
                margin: 0,
              }}>
                {fact}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
