import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const BentoSteps: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  steps,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = steps && steps.length > 0
    ? steps
    : narration.split(/[.;]/).filter(s => s.trim()).slice(0, 5).map(s => ({
        label: s.trim().split(" ").slice(0, 4).join(" "),
        description: s.trim(),
      }));

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
        gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)`,
        gap: 12,
        width: "90%",
        alignItems: "start",
      }}>
        {items.slice(0, 5).map((step, i) => {
          const delay = 6 + i * 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          // Staircase offset
          const yOffset = i % 2 === 1 ? 40 : 0;

          return (
            <div key={i} style={{ position: "relative", marginTop: yOffset }}>
              {/* Connecting line to next step */}
              {i < items.length - 1 && (
                <div style={{
                  position: "absolute",
                  right: -6,
                  top: "50%",
                  width: 12,
                  height: 2,
                  backgroundColor: interpolate(frame, [delay + 10, delay + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) > 0.5
                    ? (accentColor || "#F97316") : "transparent",
                  zIndex: 1,
                }} />
              )}

              <div style={{
                backgroundColor: i === 0 ? (accentColor || "#F97316") : "#FFFFFF",
                borderRadius: 20,
                padding: "28px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                transform: `scale(${0.92 + 0.08 * s})`,
                opacity,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}>
                {/* Step number */}
                <span style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: i === 0 ? "#FFFFFF" : (accentColor || "#F97316"),
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  marginBottom: 12,
                }}>
                  {i + 1}
                </span>

                {/* Label */}
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: i === 0 ? "#FFFFFF" : (textColor || "#171717"),
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  marginBottom: 6,
                }}>
                  {step.label}
                </span>

                {/* Description */}
                {step.description && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: i === 0 ? "rgba(255,255,255,0.8)" : "rgba(23,23,23,0.5)",
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    lineHeight: 1.4,
                  }}>
                    {step.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
