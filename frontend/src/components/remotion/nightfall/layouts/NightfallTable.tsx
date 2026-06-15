import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

const NIGHTFALL_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const NIGHTFALL_INK = "#E8E8F0";
const INK_DIM = "rgba(232,232,240,0.50)";
const POSITIVE_COLOR = "#00E5FF";
const NEGATIVE_COLOR = "#FF4D6A";
const GRID_STROKE = "rgba(232,232,240,0.10)";
const HEADER_BG = "rgba(255,255,255,0.05)";

const NIGHTFALL_FONT_FAMILY = "'Playfair Display', Georgia, serif";

function parseNumericCell(raw: string): number {
  const s = raw.trim();
  const wrapped = s.match(/^\(([0-9,.]+)\)$/);
  const signed = wrapped ? `-${wrapped[1]}` : s;
  const cleaned = signed.replace(/[^0-9.+\-]/g, "");
  return parseFloat(cleaned);
}

function highlightCellColor(raw: string): { color: string; bold: boolean } | undefined {
  const n = parseNumericCell(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n > 0) return { color: POSITIVE_COLOR, bold: Math.abs(n) >= 10 };
  if (n < 0) return { color: NEGATIVE_COLOR, bold: Math.abs(n) >= 10 };
  return undefined;
}

function reveal(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
}

export const NightfallTable: React.FC<NightfallLayoutProps> = ({
  title = "The data in view",
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  tickerTable,
  tickerTitle,
  tickerFootnote,
  tickerHighlightCol,
}) => {
  const frame = useCurrentFrame();
  const { height, width, durationInFrames, fps } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;
  const bodyFont = fontFamily || NIGHTFALL_FONT_FAMILY;
  const ink = textColor || NIGHTFALL_INK;
  const accent = accentColor || "#00E5FF";

  const titleSize = titleFontSize ?? (p ? 58 : 50);
  const descSize = descriptionFontSize ?? (p ? 26 : 22);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TABLE_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, NIGHTFALL_TABLE_MAX_ROWS)
    .map((row) => (row ?? []).slice(0, TABLE_MAX_COLS));

  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m, row) => Math.max(m, row.length), 0));
  const rowCount = rawRows.length;

  const hlColIndex =
    typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount
      ? tickerHighlightCol
      : -1;

  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const fewRows = rowCount <= 6;

  const cellFontSize = (() => {
    const colTier = colCount <= 3 ? 0 : colCount <= 5 ? 1 : 2;
    const tier = Math.max(densityTier, colTier);
    const baseFs = p ? 30 : 26;
    const scale = [1, 0.94, 0.88][tier];
    return Math.round(baseFs * scale);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.88);
  const cellPadV = (p ? [16, 13, 10] : [14, 11, 9])[densityTier];
  const cellPadH = colCount <= 4 ? 18 : 12;

  const naturalRowHeight = Math.round(cellFontSize * 1.6 + cellPadV * 2);
  const tableWidthCap = (() => {
    if (colCount <= 2) return p ? "70%" : "55%";
    if (colCount === 3) return p ? "88%" : "70%";
    if (colCount === 4) return p ? "96%" : "85%";
    return "100%";
  })();

  const titleA = reveal(frame, 4, 22);
  const titleY = interpolate(frame, [4, 22], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headerA = reveal(frame, 10, 26);
  function rowOpacity(i: number): number {
    const start = 16 + i * (rowCount <= 6 ? 6 : rowCount <= 12 ? 4 : 3);
    return reveal(frame, start, start + 20);
  }
  const footnoteA = reveal(frame, 60, 80);
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // Card entrance spring — matches GlassNarrative's panel motion
  const cardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 75, mass: 1 } });
  const cardOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame / 60) * 3;

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeOut }}>
      <DarkBackground bgColor={bgColor} />

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: p ? 50 : 100 }}>
        {/* Ambient glow behind card */}
        <div
          style={{
            position: "absolute",
            width: p ? "95%" : "85%",
            maxWidth: 1400,
            height: p ? 800 : 700,
            background: `radial-gradient(ellipse at center, ${accent}15 0%, transparent 70%)`,
            filter: "blur(60px)",
            opacity: cardOpacity * 0.6,
          }}
        />

        {/* Main glass card */}
        <div
          style={{
            ...glassCardStyle(accent, 0.1),
            width: tableWidthCap,
            maxWidth: "95%",
            maxHeight: "100%",
            padding: p ? 44 : 56,
            transform: `translateY(${(1 - cardSpring) * 50 + floatY}px)`,
            opacity: cardOpacity,
            position: "relative",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.08)
            `,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Top accent line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
              opacity: cardOpacity,
            }}
          />

          {/* Title */}
          <div style={{ opacity: titleA, transform: `translateY(${titleY}px)`, flexShrink: 0, marginBottom: Math.round(height * 0.018), textAlign: "center" }}>
            <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: titleSize, lineHeight: 1.06, color: ink, letterSpacing: "-0.01em" }}>
              {title}
            </div>
            {tickerTitle && (
              <div style={{ fontFamily: bodyFont, fontWeight: 400, fontSize: Math.round(descSize * 0.92), letterSpacing: "0.07em", textTransform: "uppercase", color: INK_DIM, marginTop: Math.round(height * 0.007) }}>
                {tickerTitle}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: `${Math.round(height * 0.012)}px auto 0` }}>
              <div style={{ width: 48, height: 2, background: accent, opacity: 0.90, borderRadius: 1, boxShadow: `0 0 8px ${accent}` }} />
              <div style={{ width: 5, height: 5, background: accent, opacity: 0.75, transform: "rotate(45deg)", boxShadow: `0 0 4px ${accent}` }} />
              <div style={{ width: 48, height: 2, background: accent, opacity: 0.90, borderRadius: 1, boxShadow: `0 0 8px ${accent}` }} />
            </div>
          </div>

          {/* Table panel */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: fewRows ? "center" : "flex-start" }}>
            <div
              style={{
                width: "100%",
                flex: fewRows ? "0 1 auto" : "1 1 0",
                minHeight: 0,
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 10,
                overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid rgba(255,255,255,0.10)`,
                borderTop: `3px solid ${accent}`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.45)`,
              }}
            >
              {rawHeaders.length > 0 && (
                <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `1.5px solid rgba(255,255,255,0.12)`, opacity: headerA, alignItems: "stretch" }}>
                  {rawHeaders.map((hdr, ci) => (
                    <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.07em", textTransform: "uppercase", color: accent, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word", lineHeight: 1.2, textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                      {hdr}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                {rawRows.length > 0
                  ? rawRows.map((row, ri) => (
                      <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowHeight}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", background: ri % 2 === 1 ? "rgba(255,255,255,0.025)" : "transparent", borderBottom: ri < rawRows.length - 1 ? `1px solid ${GRID_STROKE}` : "none", opacity: rowOpacity(ri) }}>
                        {Array.from({ length: nCols }).map((_, ci) => {
                          const cellRaw = row[ci] ?? "";
                          const isHL = ci === hlColIndex;
                          const hlStyle = isHL ? highlightCellColor(cellRaw) : undefined;
                          const hlColor = hlStyle ? hlStyle.color : ci === 0 ? ink : "rgba(232,232,240,0.85)";
                          return (
                            <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, letterSpacing: "0.01em", lineHeight: 1.4, color: hlColor, textShadow: hlStyle ? `0 0 8px ${hlStyle.color}60` : undefined, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                              <span style={{ maxWidth: "100%" }}>{cellRaw}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  : null}
                {rawRows.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${Math.round(height * 0.04)}px`, fontFamily: bodyFont, fontSize: descSize, color: INK_DIM, fontStyle: "italic" }}>
                    No entries — add data by editing this scene
                  </div>
                )}
              </div>
            </div>
          </div>

          {(tickerFootnote || narration) && (
            <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.014), fontFamily: bodyFont, fontStyle: "italic", fontWeight: 400, fontSize: Math.round(descSize * 0.85), letterSpacing: "0.02em", color: INK_DIM, lineHeight: 1.4, whiteSpace: "normal", textAlign: "center" }}>
              {tickerFootnote || narration}
            </div>
          )}

          {/* Decorative corner accent */}
          <div
            style={{
              position: "absolute",
              bottom: p ? 24 : 32,
              right: p ? 24 : 32,
              width: 40,
              height: 40,
              borderRight: `2px solid ${accent}30`,
              borderBottom: `2px solid ${accent}30`,
              borderRadius: "0 0 4px 0",
              opacity: cardOpacity * 0.5,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
