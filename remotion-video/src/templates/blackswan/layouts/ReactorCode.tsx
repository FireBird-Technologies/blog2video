import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

function deriveItems(narration: string, count = 4): string[] {
  const parts = narration.split(/[.;•\n]/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, count);
}

export const ReactorCode: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
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

  const inferredLines =
    codeLines && codeLines.length > 0
      ? codeLines
      : deriveItems(narration, 5).map((s, i) =>
          i === 0 ? `// ${s}` : `const step${i} = "${s}";`
        );

  const displayLines = inferredLines.slice(0, 10);

  // Line-by-line reveal — matches HTML: opacity:0;animation:ignite .14s delay forwards
  const linesRevealed = Math.min(
    Math.floor(interpolate(frame, [8, 8 + displayLines.length * 4], [0, displayLines.length], { extrapolateRight: "clamp" })),
    displayLines.length
  );

  const terminalOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Syntax colour helper — mirrors HTML: 'arc' → cyan, 'beam' → blue
  const getLineColor = (line: string): string => {
    if (!line || !line.trim()) return "transparent";
    if (line.startsWith("//") || line.startsWith("#")) return "#00AAFF55";
    if (/^(import|export|const|let|var|function|return|async|await|class)/.test(line.trim())) return "#00AAFF";
    if (/["']/.test(line)) return "#00E5FF";
    return "#00E5FF";
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Bottom-right water — matches HTML cx:860 */}
      <NeonWater
        uid="rc8"
        cx={p ? 500 : 860}
        yPct={p ? 88 : 84}
        rxBase={110}
        ryBase={16}
        maxRx={200}
        nRings={3}
        delay={0.3}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "6% 4%" : "0",
        }}
      >
        {/* Terminal panel — matches HTML: width:720px;border:1px solid #00E5FF14 */}
        <div
          style={{
            width: p ? "100%" : 720,
            border: "1px solid #00E5FF14",
            position: "relative",
            zIndex: 1,
            opacity: terminalOp,
          }}
        >
          {/* Terminal header bar */}
          <div
            style={{
              padding: p ? "8px 14px" : "10px 18px",
              borderBottom: "1px solid #00E5FF0e",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Prompt */}
            <span
              style={{
                fontSize: p ? 11 : 12,
                color: accentColor,
                fontFamily: fontFamily ?? mono,
              }}
            >
              &gt;_
            </span>

            {/* Language label */}
            <span
              style={{
                fontSize: p ? 8 : 9,
                color: "#00E5FF44",
                letterSpacing: 3,
                fontFamily: fontFamily ?? mono,
                textTransform: "uppercase",
              }}
            >
              {codeLanguage ?? "javascript"}
            </span>

            {/* Title if provided */}
            {title && (
              <span
                style={{
                  fontSize: titleFontSize ? titleFontSize * 0.14 : (p ? 10 : 11),
                  color: "#00AAFF",
                  fontFamily: fontFamily ?? display,
                  fontWeight: 700,
                  letterSpacing: 1,
                  marginLeft: 4,
                }}
              >
                {title}
              </span>
            )}

            <div style={{ flex: 1 }} />

            {/* Traffic lights — matches HTML exactly */}
            <div style={{ display: "flex", gap: 5 }}>
              {["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => (
                <div
                  key={c}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: 0.22 }}
                />
              ))}
            </div>
          </div>

          {/* Code body — matches HTML: padding:22px 20px;display:flex;gap:16px */}
          <div
            style={{
              padding: p ? "16px 12px" : "22px 20px",
              display: "flex",
              gap: p ? 12 : 16,
            }}
          >
            {/* Line numbers — matches HTML: font-size:11px;color:#0040FF22 */}
            <div
              style={{
                fontSize: p ? 9 : 11,
                color: "#0040FF22",
                userSelect: "none",
                textAlign: "right",
                lineHeight: "2em",
                minWidth: p ? 12 : 16,
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
                fontSize: descriptionFontSize ?? (p ? 11 : 13),
                flex: 1,
                lineHeight: "2em",
                fontFamily: fontFamily ?? mono,
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