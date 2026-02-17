import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const BentoCode: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  codeLines,
  codeLanguage,
  description,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = codeLines && codeLines.length > 0 ? codeLines : ["// No code provided"];

  const codeScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const codeOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const badgeScale = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14, stiffness: 120 } });
  const badgeOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const descScale = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 14, stiffness: 120 } });
  const descOpacity = interpolate(frame, [10, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Typewriter effect for code
  const totalChars = lines.join("\n").length;
  const visibleChars = Math.round(interpolate(frame, [8, 8 + totalChars * 0.8], [0, totalChars], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  let charCount = 0;
  const visibleLines = lines.map((line) => {
    const lineStart = charCount;
    charCount += line.length + 1;
    if (lineStart >= visibleChars) return "";
    if (charCount <= visibleChars) return line;
    return line.substring(0, visibleChars - lineStart);
  });

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
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 12,
        width: "85%",
        height: "70%",
      }}>
        {/* Code cell — dark bg, spans 2 rows */}
        <div style={{
          gridRow: "1 / 3",
          backgroundColor: "#1E1E2E",
          borderRadius: 20,
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `scale(${0.92 + 0.08 * codeScale})`,
          opacity: codeOpacity,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}>
          {/* Window dots */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#27C93F" }} />
          </div>
          <pre style={{
            margin: 0,
            fontSize: 15,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
            color: "#E2E8F0",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {visibleLines.join("\n")}
          </pre>
        </div>

        {/* Badge cell */}
        <div style={{
          backgroundColor: accentColor || "#F97316",
          borderRadius: 20,
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.92 + 0.08 * badgeScale})`,
          opacity: badgeOpacity,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}>
            {codeLanguage || "code"}
          </span>
        </div>

        {/* Description cell */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: "24px",
          display: "flex",
          alignItems: "center",
          transform: `scale(${0.92 + 0.08 * descScale})`,
          opacity: descOpacity,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <p style={{
            fontSize: 15,
            fontWeight: 400,
            color: textColor || "#171717",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            lineHeight: 1.5,
            margin: 0,
          }}>
            {description || narration}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
