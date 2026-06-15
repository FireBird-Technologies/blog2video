import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NightfallLayoutProps } from "../types";

const NIGHTFALL_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const NIGHTFALL_INK = "#E8E8F0";
const INK_DIM = "rgba(232,232,240,0.50)";
const POSITIVE_COLOR = "#00E5FF";
const NEGATIVE_COLOR = "#FF4D6A";
const GRID_STROKE = "rgba(232,232,240,0.10)";
const PANEL_BG = "rgba(0,229,255,0.04)";
const HEADER_BG = "rgba(0,229,255,0.08)";
const NIGHTFALL_BG = "#0A0A14";

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
  const { height, width, durationInFrames } = useVideoConfig();
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
  const fewCols = colCount <= 4;

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
  const headerA = reveal(frame, 10, 26);
  function rowOpacity(i: number): number {
    const start = 16 + i * (rowCount <= 6 ? 6 : rowCount <= 12 ? 4 : 3);
    return reveal(frame, start, start + 20);
  }
  const footnoteA = reveal(frame, 60, 80);
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  const bg = bgColor || NIGHTFALL_BG;

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeOut, background: bg }}>
      <AbsoluteFill style={{ background: "linear-gradient(135deg, rgba(0,229,255,0.07) 0%, rgba(123,47,190,0.09) 100%)", pointerEvents: "none" }} />
      {/* Ambient corner glow */}
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "40%", height: "40%", borderRadius: "50%", background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "35%", height: "35%", borderRadius: "50%", background: "radial-gradient(circle, rgba(123,47,190,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "7%" : "5.5%"} ${p ? "6%" : "7%"}`, minHeight: 0, gap: 0 }}>
        <div style={{ opacity: titleA, flexShrink: 0, marginBottom: Math.round(height * 0.016), textAlign: "center" }}>
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

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          <div
            style={{
              alignSelf: fewCols ? "center" : "stretch",
              width: tableWidthCap,
              maxWidth: "100%",
              flex: fewRows ? "0 1 auto" : "1 1 0",
              minHeight: 0,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 10,
              overflow: "hidden",
              background: PANEL_BG,
              border: `1.5px solid rgba(0,229,255,0.28)`,
              borderTop: `3px solid ${accent}`,
              boxShadow: `0 0 40px rgba(0,229,255,0.12), 0 0 12px rgba(0,229,255,0.07), 0 4px 32px rgba(0,0,0,0.65)`,
              backdropFilter: "blur(12px)",
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `1.5px solid rgba(0,229,255,0.20)`, opacity: headerA, alignItems: "stretch" }}>
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
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowHeight}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", background: ri % 2 === 1 ? "rgba(0,229,255,0.05)" : "transparent", borderBottom: ri < rawRows.length - 1 ? `1px solid ${GRID_STROKE}` : "none", opacity: rowOpacity(ri) }}>
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
          <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.012), fontFamily: bodyFont, fontStyle: "italic", fontWeight: 400, fontSize: Math.round(descSize * 0.85), letterSpacing: "0.02em", color: INK_DIM, lineHeight: 1.4, whiteSpace: "normal", textAlign: "center" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>

      {/* Bottom neon stripe */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: accent, boxShadow: `0 0 12px ${accent}, 0 0 4px ${accent}` }} />
    </AbsoluteFill>
  );
};
