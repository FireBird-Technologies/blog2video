import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const BentoCompare: React.FC<GridcraftLayoutProps> = ({
  title,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  verdict,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftX = interpolate(frame, [0, 18], [-60, 0], { extrapolateRight: "clamp" });
  const leftOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const rightX = interpolate(frame, [4, 22], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightOpacity = interpolate(frame, [4, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const verdictScale = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 14, stiffness: 120 } });
  const verdictOpacity = interpolate(frame, [16, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor || "#FAFAFA",
      padding: "5%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr auto",
        gap: 12,
        width: "85%",
        maxHeight: "80%",
      }}>
        {/* Left side */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          transform: `translateX(${leftX}px)`,
          opacity: leftOpacity,
        }}>
          <h3 style={{
            fontSize: 22,
            fontWeight: 700,
            color: textColor || "#171717",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            margin: "0 0 16px 0",
          }}>
            {leftLabel || "Option A"}
          </h3>
          <p style={{
            fontSize: 16,
            fontWeight: 400,
            color: "rgba(23,23,23,0.7)",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.6,
            margin: 0,
          }}>
            {leftDescription || "Description for option A."}
          </p>
        </div>

        {/* Right side */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          transform: `translateX(${rightX}px)`,
          opacity: rightOpacity,
        }}>
          <h3 style={{
            fontSize: 22,
            fontWeight: 700,
            color: textColor || "#171717",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            margin: "0 0 16px 0",
          }}>
            {rightLabel || "Option B"}
          </h3>
          <p style={{
            fontSize: 16,
            fontWeight: 400,
            color: "rgba(23,23,23,0.7)",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.6,
            margin: 0,
          }}>
            {rightDescription || "Description for option B."}
          </p>
        </div>

        {/* Verdict cell */}
        <div style={{
          gridColumn: "1 / -1",
          backgroundColor: accentColor || "#F97316",
          borderRadius: 20,
          padding: "28px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(249,115,22,0.2)",
          transform: `scale(${0.92 + 0.08 * verdictScale})`,
          opacity: verdictOpacity,
        }}>
          <p style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#FFFFFF",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            margin: 0,
            textAlign: "center",
          }}>
            {verdict || title}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
