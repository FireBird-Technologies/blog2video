import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { FlybyPlane } from "../components/FlybyPlane";

const DEFAULT_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const DEFAULT_INK = "#1D1D1F";
const INK_DIM = "rgba(0,0,0,0.45)";
const POSITIVE_COLOR = "#16A34A";
const NEGATIVE_COLOR = "#DC2626";
const GRID_STROKE = "rgba(0,0,0,0.07)";
const DEFAULT_BG = "#F0F0F0";

const DEFAULT_FONT_FAMILY = "'Roboto Slab', serif";

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

export const DefaultTable: React.FC<SceneLayoutProps> = ({
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
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const { height, width, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;
  const bodyFont = fontFamily || DEFAULT_FONT_FAMILY;
  const ink = textColor || DEFAULT_INK;
  const accent = accentColor || "#6366F1";

  const titleSize = titleFontSize ?? (p ? 58 : 44);
  const descSize = descriptionFontSize ?? (p ? 26 : 19);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TABLE_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, DEFAULT_TABLE_MAX_ROWS)
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
    const baseFs = p ? 26 : 22;
    const scale = [1, 0.96, 0.91][tier];
    return Math.round(baseFs * scale);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.9);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;

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

  const bg = bgColor || DEFAULT_BG;
  const headerBg = `${accent}18`;
  const altRowBg = `${accent}0A`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeOut, background: bg }}>
      <GeometricBackground accentColor={accent} frame={frame} sceneIndex={sceneIndex} />
      <FlybyPlane accentColor={accent} startFrame={35} yZone={0.10} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "7%" : "5.5%"} ${p ? "6%" : "7%"}`, minHeight: 0, gap: 0 }}>
        <div style={{ opacity: titleA, flexShrink: 0, marginBottom: Math.round(height * 0.014), textAlign: "center" }}>
          <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: titleSize, lineHeight: 1.08, color: ink }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: bodyFont, fontWeight: 400, fontSize: Math.round(descSize * 0.95), letterSpacing: "0.08em", textTransform: "uppercase", color: INK_DIM, marginTop: Math.round(height * 0.006) }}>
              {tickerTitle}
            </div>
          )}
          <div style={{ width: 60, height: 3, background: accent, margin: `${Math.round(height * 0.01)}px auto 0`, opacity: 0.85, borderRadius: 2 }} />
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
              borderRadius: 8,
              overflow: "hidden",
              background: "rgba(255,255,255,0.80)",
              border: `1px solid rgba(0,0,0,0.08)`,
              borderTop: `3px solid ${accent}`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)`,
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: headerBg, borderBottom: `1.5px solid rgba(0,0,0,0.10)`, opacity: headerA, alignItems: "stretch" }}>
                {rawHeaders.map((hdr, ci) => (
                  <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.08)}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.06em", textTransform: "uppercase", color: ink, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word", lineHeight: 1.2, textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                    {hdr}
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
              {rawRows.length > 0
                ? rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowHeight}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", background: ri % 2 === 1 ? altRowBg : "transparent", borderBottom: ri < rawRows.length - 1 ? `1px solid ${GRID_STROKE}` : "none", opacity: rowOpacity(ri) }}>
                      {Array.from({ length: nCols }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const isHL = ci === hlColIndex;
                        const hlStyle = isHL ? highlightCellColor(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, letterSpacing: "0.01em", lineHeight: 1.38, color: hlStyle ? hlStyle.color : ink, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
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
          <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.01), fontFamily: bodyFont, fontStyle: "italic", fontWeight: 400, fontSize: Math.round(descSize * 0.88), letterSpacing: "0.02em", color: INK_DIM, lineHeight: 1.4, whiteSpace: "normal", textAlign: "center" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>

      {/* Bottom accent stripe */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: accent }} />
    </AbsoluteFill>
  );
};
