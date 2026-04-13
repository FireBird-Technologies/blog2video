import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette, rgbaFromHex } from "./blackswanAccent";

// Righteous — same family as DropletIntro
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

function deriveItems(narration: string, count = 4): string[] {
  const parts = narration.split(/[.;•\n]/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, count);
}

export const ReactorCode: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    codeLanguage,
    codeLines,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const inferredLines =
    codeLines && codeLines.length > 0
      ? codeLines
      : deriveItems(narration, 5).map((s, i) =>
          i === 0 ? `// ${s}` : `const step${i} = "${s}";`
        );

  const displayLines = inferredLines.slice(0, 20);

  // Line-by-line reveal
  const linesRevealed = Math.min(
    Math.floor(interpolate(frame, [8, 8 + displayLines.length * 4], [0, displayLines.length], { extrapolateRight: "clamp" })),
    displayLines.length
  );

  const titleOp    = interpolate(frame, [0, 20],  [0, 1], { extrapolateRight: "clamp" });
  const titleY     = interpolate(frame, [0, 20],  [12, 0], { extrapolateRight: "clamp" });
  const terminalOp = interpolate(frame, [6, 24],  [0, 1], { extrapolateRight: "clamp" });

  // Font sizes — driven by sliders, same pattern as DropletIntro
  const titleSize = titleFontSize ?? (p ? 81 : 76);
  const codeSize  = descriptionFontSize ?? (p ? 33 : 32);
  const lineNumSize = codeSize * 0.75;

  const getLineColor = (line: string): string => {
    if (!line || !line.trim()) return "transparent";
    if (line.startsWith("//") || line.startsWith("#")) return rgbaFromHex(pal.mid, 0.45);
    if (/^(import|export|const|let|var|function|return|async|await|class)/.test(line.trim())) return pal.mid;
    if (/["']/.test(line)) return pal.core;
    return pal.core;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      {/* ── Title — top (landscape) / center-shifted (portrait) ─────────── */}
      <div
        style={{
          position: "absolute",
          top: p ? "30%" : 0, // Adjusted for portrait to bring title upwards
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: p ? 0 : "12%", // Adjusted for landscape to bring title downwards
          paddingLeft: "6%",
          paddingRight: "6%",
          gap: p ? 14 : 16,
          zIndex: 2,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleSize,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            lineHeight: 1.1,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {title}
        </h1>

        {/* Accent line */}
        <div
          style={{
            height: 2,
            width: p ? 160 : 200,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
            flexShrink: 0,
          }}
        />
      </div>

      {/* ── Terminal panel ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: p ? "48%" : "20%", // Adjusted for portrait to bring code block upwards
          bottom: p ? "10%" : "5%", // Adjusted for portrait to control vertical extent
          left: 0,
          right: 0,
          display: "flex",
          alignItems: p ? "flex-start" : "center", // Align content to top for portrait
          justifyContent: "center",
          // paddingTop and paddingBottom removed as 'top' and 'bottom' properties now define the container's vertical bounds.
          paddingLeft: p ? "4%" : "6%",
          paddingRight: p ? "4%" : "6%",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: p ? 680 : 1100,
            border: `1px solid ${accentColor}18`,
            borderRadius: 4,
            position: "relative",
            zIndex: 1,
            opacity: terminalOp,
            display: "flex", // Make it a flex container
            flexDirection: "column", // Stack children vertically
            height: p ? "100%" : "auto", // Fill available vertical space in portrait
            minHeight: p ? "200px" : "auto", // Minimum height for portrait
          }}
        >
          {/* Terminal header bar */}
          <div
            style={{
              padding: p ? "10px 16px" : "12px 20px",
              borderBottom: `1px solid ${accentColor}10`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0, // Prevent header from shrinking
            }}
          >
            {/* Prompt */}
            <span
              style={{
                fontSize: codeSize,
                color: accentColor,
                fontFamily: fontFamily ?? mono,
              }}
            >
              &gt;_
            </span>

            {/* Language label */}
            <span
              style={{
                fontSize: codeSize * 0.7,
                color: `${accentColor}55`,
                letterSpacing: 3,
                fontFamily: fontFamily ?? mono,
                textTransform: "uppercase",
              }}
            >
              {codeLanguage ?? "javascript"}
            </span>

            <div style={{ flex: 1 }} />

            {/* Traffic lights */}
            <div style={{ display: "flex", gap: 6 }}>
              {["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => (
                <div
                  key={c}
                  style={{ width: p ? 8 : 9, height: p ? 8 : 9, borderRadius: "50%", background: c, opacity: 0.3 }}
                />
              ))}
            </div>
          </div>

          {/* Code body */}
          <div
            style={{
              padding: p ? "18px 16px" : "24px 24px",
              display: "flex",
              gap: p ? 14 : 18,
              flex: 1, // Allow code body to grow and fill remaining vertical space
              overflowY: p ? "auto" : "hidden", // Allow vertical scrolling in portrait if content overflows
            }}
          >
            {/* Line numbers */}
            <div
              style={{
                fontSize: lineNumSize,
                color: rgbaFromHex(pal.deep, 0.22),
                userSelect: "none",
                textAlign: "right",
                lineHeight: "2em",
                minWidth: p ? 20 : 24,
                fontFamily: fontFamily ?? mono,
              }}
            >
              {displayLines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code lines */}
            <div
              style={{
                fontSize: codeSize,
                flex: 1,
                lineHeight: "2em",
                fontFamily: fontFamily ?? mono,
                overflow: "hidden", // Keep horizontal overflow hidden for individual lines
              }}
            >
              {displayLines.map((line, i) => {
                const isRevealed = i < linesRevealed;
                return (
                  <div
                    key={`${line}-${i}`}
                    style={{
                      color: isRevealed ? getLineColor(line) : "transparent",
                      opacity: isRevealed ? 1 : 0,
                      minHeight: "2em",
                      whiteSpace: "pre",
                    }}
                  >
                    {line || "\u00A0"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
