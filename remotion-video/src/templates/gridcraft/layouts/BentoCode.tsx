import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoCode: React.FC<GridcraftLayoutProps> = ({
  title, // Language
  narration, // Description
  codeSnippet, // Legacy string
  codeLines, // Backend array
  accentColor,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const spr = (d: number) => spring({ frame: Math.max(0, frame - d), fps, config: { damping: 16 } });

  const lines = codeLines && codeLines.length > 0 
    ? codeLines 
    : (codeSnippet || "").split("\n");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 20,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: FONT_FAMILY.SANS,
      }}
    >
      {/* Code Window */}
      <div
        style={{
           gridRow: "1 / 3",
           backgroundColor: "rgba(15, 23, 42, 0.85)", // Dark slate
           backdropFilter: "blur(20px)",
           borderRadius: 24,
           border: "1px solid rgba(255,255,255,0.1)",
           padding: 32,
           fontFamily: FONT_FAMILY.MONO,
           fontSize: 14,
           lineHeight: 1.8,
           color: "#E2E8F0",
           overflow: "hidden",
           transform: `scale(${interpolate(spr(0), [0, 1], [0.95, 1])})`,
           opacity: interpolate(spr(0), [0, 1], [0, 1]),
           boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        {lines.map((line, i) => (
            <div key={i} style={{ 
                opacity: interpolate(frame, [i*2, i*2+10], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateX(${interpolate(frame, [i*2, i*2+10], [-10, 0], { extrapolateRight: "clamp" })}px)`
            }}>
                {line || " "}
            </div>
        ))}
      </div>

      {/* Language Badge */}
      <div
        style={{
            ...glass(true),
            backgroundColor: accentColor || COLORS.ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${interpolate(spr(10), [0, 1], [0.8, 1])})`,
            opacity: interpolate(spr(10), [0, 1], [0, 1]),
        }}
      >
          <div style={{ fontSize: titleFontSize ?? 28, fontWeight: 700 }}>{title || "Code"}</div>
      </div>

      {/* Description */}
      <div
        style={{
            ...glass(false),
            padding: 24,
            display: "flex", flexDirection: "column", justifyContent: "center",
             transform: `scale(${interpolate(spr(15), [0, 1], [0.9, 1])})`,
            opacity: interpolate(spr(15), [0, 1], [0, 1]),
        }}
      >
          <div style={{ fontSize: 12, color: COLORS.MUTED, textTransform: "uppercase", marginBottom: 8 }}>Details</div>
          <div style={{ fontSize: descriptionFontSize ?? 20, lineHeight: 1.4, fontWeight: 500 }}>{narration}</div>
      </div>
    </div>
  );
};
