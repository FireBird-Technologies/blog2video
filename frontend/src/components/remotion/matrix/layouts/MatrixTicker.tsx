import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import { buildHudStatus, DecodeSweep, GlitchSlice, TerminalHUD } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";

/**
 * MatrixTicker — data table / market snapshot scene. Renders the shared
 * tickerTable contract (headers + rows, optional highlight column for +/-
 * coloring) as an intercepted terminal readout: green monospace grid on a
 * digital-rain void with scanlines.
 */

const MATRIX_TICKER_MAX_ROWS = 20;
const TICKER_MAX_COLS = 6;

const NEON = "#00FF41";
const NEON_DIM = "#00B82E";
const POSITIVE_COLOR = "#39FF6A";
const NEGATIVE_COLOR = "#FF4D4D";
const GRID_STROKE = "rgba(0,255,65,0.22)";
const PANEL_BG = "rgba(0,16,4,0.82)";
const HEADER_BG = "rgba(0,255,65,0.12)";

const MONO = MATRIX_DEFAULT_FONT_FAMILY;

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

/** Simple clamped 0→1 reveal at a given frame window. */
function reveal(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start * 90) / ((end - start) * 90)));
}

export const MatrixTicker: React.FC<MatrixLayoutProps> = ({
  title = "Intercepted feed",
  narration,
  accentColor = NEON,
  bgColor = "#000000",
  textColor = NEON,
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
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const font = fontFamily || MONO;

  const titleSize = titleFontSize ?? (p ? 44 : 36);
  const descSize = descriptionFontSize ?? (p ? 22 : 18);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TICKER_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, MATRIX_TICKER_MAX_ROWS)
    .map((row) => (row ?? []).slice(0, TICKER_MAX_COLS));

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

  const padH = p ? "3.5%" : "4%";

  const headerA = reveal(frame, 0, 0.18);
  const titleA = reveal(frame, 0.05, 0.25);
  function rowOpacity(i: number): number {
    const start = 0.18 + i * (rowCount <= 6 ? 0.065 : rowCount <= 12 ? 0.045 : 0.03);
    const end = start + 0.22;
    return reveal(frame, start, Math.min(end, 0.98));
  }
  const footnoteA = reveal(frame, 0.8, 0.95);

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  const chromeTitle = `> ${title}`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <MatrixBackground bgColor={bgColor} fontFamily={font} />
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,65,0.05) 0px, rgba(0,255,65,0.05) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Decorative artifacts — quiet HUD, decode pass, rare glitch; the table stays the hero. */}
      <TerminalHUD accentColor={accentColor} statusText={buildHudStatus("INTERCEPTED", tickerTitle || title)} startFrame={4} seed={45} />
      <DecodeSweep accentColor={accentColor} startFrame={3} seed={71} />
      <GlitchSlice accentColor={accentColor} every={90} seed={73} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "5%" : "4%"} ${padH}`, minHeight: 0, gap: 0 }}>
        <div
          style={{
            opacity: titleA,
            flexShrink: 0,
            marginBottom: Math.round(height * 0.012),
            width: tableWidthCap,
            maxWidth: "100%",
            alignSelf: fewCols ? "center" : "stretch",
            textAlign: fewCols ? "center" : "left",
          }}
        >
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: titleSize, letterSpacing: "0.01em", lineHeight: 1.1, color: accentColor, textShadow: `0 0 14px ${accentColor}99, 0 0 30px ${accentColor}44` }}>
            {chromeTitle}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: font, fontWeight: 500, fontSize: Math.round(descSize * 0.9), letterSpacing: "0.08em", color: NEON_DIM, marginTop: Math.round(height * 0.006), textTransform: "uppercase" }}>
              {`[ ${tickerTitle} ]`}
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
              borderRadius: 8,
              overflow: "hidden",
              background: PANEL_BG,
              border: `1px solid ${accentColor}55`,
              boxShadow: `0 0 26px rgba(0,255,65,0.18), inset 0 0 36px rgba(0,255,65,0.04)`,
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `1px solid ${GRID_STROKE}`, opacity: headerA, alignItems: "stretch" }}>
                {rawHeaders.map((hdr, ci) => (
                  <div
                    key={ci}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      boxSizing: "border-box",
                      padding: `${Math.round(cellPadV * 1.08)}px ${cellPadH}px`,
                      fontFamily: font,
                      fontWeight: 700,
                      fontSize: headerFontSize,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: accentColor,
                      textShadow: `0 0 8px ${accentColor}88`,
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
                        background: ri % 2 === 1 ? "rgba(0,255,65,0.04)" : "transparent",
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
                              fontFamily: font,
                              fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 500,
                              fontSize: cellFontSize,
                              letterSpacing: "0.01em",
                              lineHeight: 1.38,
                              color: hlStyle ? hlStyle.color : textColor,
                              textShadow: hlStyle ? `0 0 10px ${hlStyle.color}88` : `0 0 6px ${accentColor}33`,
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${Math.round(height * 0.04)}px`, fontFamily: font, fontSize: descSize, color: NEON_DIM, fontStyle: "italic" }}>
                  {"> NO_DATA :: add data by editing this scene"}
                </div>
              )}
            </div>
          </div>
        </div>

        {(tickerFootnote || narration) && (
          <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.008), fontFamily: font, fontWeight: 400, fontSize: Math.round(descSize * 0.84), letterSpacing: "0.02em", color: NEON_DIM, lineHeight: 1.4, whiteSpace: "normal" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
