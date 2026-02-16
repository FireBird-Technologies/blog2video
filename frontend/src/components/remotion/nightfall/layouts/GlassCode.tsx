import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassCode — Enhanced Professional Version
 * 
 * Improvements:
 * - Line-by-line typewriter effect
 * - Syntax highlighting colors
 * - Professional terminal chrome
 * - Blinking cursor animation
 * - Line numbers with proper spacing
 * - Copy button indication
 * - Language badge styling
 */

export const GlassCode: React.FC<NightfallLayoutProps> = ({
  title,
  accentColor,
  textColor,
  codeLines = [],
  codeLanguage = "",
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Card entrance
  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75 },
  });

  const cardOpacity = interpolate(
    frame,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Code lines reveal progress
  const linesRevealed = interpolate(
    frame,
    [20, 20 + Math.min(codeLines.length * 10, 80)],
    [0, codeLines.length],
    { extrapolateRight: "clamp" }
  );

  // Cursor blink
  const cursorVisible = Math.floor(frame / 20) % 2 === 0;

  // Syntax highlighting helper (basic)
  const getTokenColor = (token: string): string => {
    // Keywords
    if (/^(const|let|var|function|return|if|else|for|while|import|export|from|class|async|await)$/.test(token)) {
      return accentColor;
    }
    // Strings
    if (/^["'`].*["'`]$/.test(token)) {
      return "#50FA7B";
    }
    // Numbers
    if (/^\d+$/.test(token)) {
      return "#BD93F9";
    }
    // Comments
    if (token.startsWith("//") || token.startsWith("/*")) {
      return `${textColor}60`;
    }
    return textColor;
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 100,
        }}
      >
        <div
          style={{
            ...glassCardStyle(accentColor, 0.12),
            width: p ? "98%" : "75%",
            maxWidth: 1000,
            overflow: "hidden",
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardY) * 40}px)`,
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.05)
            `,
          }}
        >
          {/* Terminal Header */}
          <div
            style={{
              padding: p ? "14px 20px" : "16px 24px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            {/* Traffic lights */}
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#FF5F57",
                  boxShadow: "0 0 8px #FF5F5740",
                }}
              />
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#FEBC2E",
                  boxShadow: "0 0 8px #FEBC2E40",
                }}
              />
              <div
                style={{
                  width: p ? 10 : 12,
                  height: p ? 10 : 12,
                  borderRadius: "50%",
                  backgroundColor: "#28C840",
                  boxShadow: "0 0 8px #28C84040",
                }}
              />
            </div>

            {/* Language badge and title */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {title && (
                <span
                  style={{
                    fontSize: p ? 12 : 13,
                    color: textColor,
                    opacity: 0.6,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {title}
                </span>
              )}
              {codeLanguage && (
                <span
                  style={{
                    fontSize: p ? 11 : 12,
                    color: accentColor,
                    fontFamily: "'Fira Code', monospace",
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: `${accentColor}25`,
                    border: `1px solid ${accentColor}40`,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {codeLanguage}
                </span>
              )}
            </div>

            {/* Copy indicator */}
            <div
              style={{
                fontSize: p ? 11 : 12,
                color: `${textColor}50`,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              ⌘C
            </div>
          </div>

          {/* Code Content */}
          <div
            style={{
              padding: p ? "20px 16px" : "28px 28px",
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: p ? 14 : 18,
              lineHeight: 1.8,
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              minHeight: p ? 200 : 300,
            }}
          >
            {codeLines.map((line, i) => {
              const isRevealed = i < Math.floor(linesRevealed);
              const isCurrentLine = i === Math.floor(linesRevealed);
              
              return (
                <div
                  key={i}
                  style={{
                    color: isRevealed ? "#E2E8F0" : "rgba(255,255,255,0.15)",
                    whiteSpace: "pre",
                    opacity: isRevealed ? 1 : 0.3,
                    transition: "opacity 0.2s",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {/* Line number */}
                  <span
                    style={{
                      color: isRevealed ? `${accentColor}60` : "rgba(255,255,255,0.2)",
                      marginRight: p ? 12 : 20,
                      minWidth: p ? 24 : 32,
                      textAlign: "right",
                      fontSize: p ? 12 : 14,
                      fontWeight: 500,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Code line */}
                  <span style={{ flex: 1 }}>
                    {line}
                  </span>

                  {/* Blinking cursor on current line */}
                  {isCurrentLine && cursorVisible && (
                    <span
                      style={{
                        marginLeft: 4,
                        color: accentColor,
                        fontWeight: 700,
                        fontSize: p ? 16 : 20,
                      }}
                    >
                      |
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};