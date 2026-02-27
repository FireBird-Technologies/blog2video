import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const EditorialBody: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [20, 0], { extrapolateRight: "clamp" });

  const ruleWidth = interpolate(frame, [10, 30], [0, 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bodyOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bodyY = interpolate(frame, [15, 30], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor || "#FAFAFA",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "60%",
        maxWidth: 800,
        textAlign: "center",
      }}>
        <h2 style={{
          fontSize: titleFontSize ?? 42,
          fontWeight: 600,
          color: textColor || "#171717",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          margin: "0 0 20px 0",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}>
          {title}
        </h2>

        {/* Accent horizontal rule */}
        <div style={{
          width: `${ruleWidth}%`,
          height: 2,
          backgroundColor: accentColor || "#F97316",
          margin: "0 auto 28px auto",
        }} />

        <p style={{
          fontSize: descriptionFontSize ?? 24,
          fontWeight: 400,
          color: textColor || "#171717",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          lineHeight: 1.7,
          opacity: bodyOpacity,
          transform: `translateY(${bodyY}px)`,
          margin: 0,
        }}>
          {narration}
        </p>
      </div>
    </AbsoluteFill>
  );
};
