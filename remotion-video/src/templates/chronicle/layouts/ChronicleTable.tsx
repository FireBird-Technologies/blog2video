import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { OrnamentalCorner } from "../components/OrnamentalBorder";
import { QuillText } from "../components/QuillInk";

/**
 * ChronicleTable — data table / ledger page scene. Renders the shared
 * tickerTable contract (headers + rows, optional highlight column for +/-
 * coloring) as a ruled parchment ledger: inked column rules, small-caps
 * header row, gain/loss entries colored in green / wax-red ink.
 */

const CHRONICLE_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const INK = "#2A1810";
const INK_DIM = "rgba(42,24,16,0.62)";
const POSITIVE_COLOR = "#2F5D3A";
const NEGATIVE_COLOR = "#8B2E1D";
const GRID_STROKE = "rgba(42,24,16,0.22)";
const PANEL_BG = "rgba(248,239,214,0.55)";
const HEADER_BG = "rgba(184,134,11,0.14)";

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

/** Clamped 0→1 reveal between two frame marks. */
function reveal(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
}

export const ChronicleTable: React.FC<ChronicleLayoutProps> = ({
  title = "The ledger of record",
  narration,
  accentColor = "#B8860B",
  textColor = INK,
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
  const bodyFont = fontFamily || CHRONICLE_BODY_FONT;
  const ink = textColor || INK;
  const accent = accentColor || "#B8860B";

  const titleSize = titleFontSize ?? (p ? 50 : 44);
  const descSize = descriptionFontSize ?? (p ? 22 : 19);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TABLE_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, CHRONICLE_TABLE_MAX_ROWS)
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
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeOut }}>
      <OrnamentalCorner position="top-left" size={p ? 90 : 110} color={accent} startFrame={0} variant="celtic" />
      <OrnamentalCorner position="top-right" size={p ? 90 : 110} color={accent} startFrame={4} variant="celtic" />
      <OrnamentalCorner position="bottom-left" size={p ? 90 : 110} color={accent} startFrame={8} variant="celtic" />
      <OrnamentalCorner position="bottom-right" size={p ? 90 : 110} color={accent} startFrame={12} variant="celtic" />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "7%" : "5.5%"} ${p ? "6%" : "7%"}`, minHeight: 0, gap: 0 }}>
        <div
          style={{
            opacity: titleA,
            flexShrink: 0,
            marginBottom: Math.round(height * 0.014),
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: CHRONICLE_HEADING_FONT,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.08,
              color: ink,
              textShadow: "1px 1px 0 rgba(184,134,11,0.15)",
            }}
          >
            <QuillText text={title} startFrame={4} durationFrames={22} mode="char" showCursor={false} />
          </div>
          {tickerTitle && (
            <div
              style={{
                fontFamily: CHRONICLE_SMALLCAPS_FONT,
                fontWeight: 400,
                fontSize: Math.round(descSize * 0.95),
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: INK_DIM,
                marginTop: Math.round(height * 0.006),
              }}
            >
              {tickerTitle}
            </div>
          )}
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
              borderRadius: 4,
              overflow: "hidden",
              background: PANEL_BG,
              border: `1.5px solid rgba(42,24,16,0.35)`,
              boxShadow: "inset 0 0 40px rgba(184,134,11,0.08), 2px 3px 0 rgba(42,24,16,0.12)",
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `1.5px solid rgba(42,24,16,0.35)`, opacity: headerA, alignItems: "stretch" }}>
                {rawHeaders.map((hdr, ci) => (
                  <div
                    key={ci}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      boxSizing: "border-box",
                      padding: `${Math.round(cellPadV * 1.08)}px ${cellPadH}px`,
                      fontFamily: CHRONICLE_SMALLCAPS_FONT,
                      fontWeight: 700,
                      fontSize: headerFontSize,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: ink,
                      borderRight: cellBorder(ci),
                      whiteSpace: "normal",
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                      lineHeight: 1.2,
                      textAlign: ci > 0 ? "right" : "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: ci > 0 ? "flex-end" : "flex-start",
                    }}
                  >
                    {hdr}
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
              {rawRows.length > 0
                ? rawRows.map((row, ri) => (
                    <div
                      key={ri}
                      style={{
                        flex: fewRows ? `0 0 ${naturalRowHeight}px` : "1 1 0",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "stretch",
                        background: ri % 2 === 1 ? "rgba(184,134,11,0.06)" : "transparent",
                        borderBottom: ri < rawRows.length - 1 ? `1px solid ${GRID_STROKE}` : "none",
                        opacity: rowOpacity(ri),
                      }}
                    >
                      {Array.from({ length: nCols }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const isHL = ci === hlColIndex;
                        const hlStyle = isHL ? highlightCellColor(cellRaw) : undefined;
                        return (
                          <div
                            key={ci}
                            style={{
                              flex: "1 1 0",
                              minWidth: 0,
                              boxSizing: "border-box",
                              padding: `${cellPadV}px ${cellPadH}px`,
                              fontFamily: bodyFont,
                              fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400,
                              fontSize: cellFontSize,
                              letterSpacing: "0.01em",
                              lineHeight: 1.38,
                              color: hlStyle ? hlStyle.color : ink,
                              borderRight: cellBorder(ci),
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              textAlign: ci > 0 ? "right" : "left",
                              fontVariantNumeric: "tabular-nums",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: ci > 0 ? "flex-end" : "flex-start",
                            }}
                          >
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
    </AbsoluteFill>
  );
};
