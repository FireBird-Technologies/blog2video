import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const BentoHero: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const mainOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const small1Scale = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14, stiffness: 120 } });
  const small1Opacity = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const small2Scale = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 14, stiffness: 120 } });
  const small2Opacity = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Extract first word as category tag
  const words = title.split(" ");
  const categoryTag = words.length > 1 ? words[0] : "Featured";

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAFA", padding: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 12,
        width: "85%",
        height: "75%",
      }}>
        {/* Large accent cell */}
        <div style={{
          gridRow: "1 / 3",
          backgroundColor: accentColor || "#F97316",
          borderRadius: 20,
          padding: "48px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `scale(${0.92 + 0.08 * mainScale})`,
          opacity: mainOpacity,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          <h1 style={{
            color: "#FFFFFF",
            fontSize: 72,
            fontWeight: 700,
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.1,
            margin: 0,
          }}>
            {title}
          </h1>
        </div>

        {/* Small cell 1 — category tag */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.92 + 0.08 * small1Scale})`,
          opacity: small1Opacity,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <span style={{
            fontSize: 28,
            fontWeight: 600,
            color: accentColor || "#F97316",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}>
            {categoryTag}
          </span>
        </div>

        {/* Small cell 2 — subtitle */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          transform: `scale(${0.92 + 0.08 * small2Scale})`,
          opacity: small2Opacity,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <p style={{
            fontSize: 20,
            fontWeight: 400,
            color: textColor || "#171717",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.5,
            margin: 0,
          }}>
            {narration}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
