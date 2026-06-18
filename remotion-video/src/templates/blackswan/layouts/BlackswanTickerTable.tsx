import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { StarField, neonTitleTubeStyle } from "./scenePrimitives";
import { rgbaFromHex } from "./blackswanAccent";

const DISPLAY_FONT = "'Righteous', cursive";

const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#4ADE80";
const NEGATIVE_COLOR = "#F87171";

function parseNumericCell(raw: string): number {
  const s = raw.trim();
  const wrapped = s.match(/^\(([0-9,.]+)\)$/);
  const signed = wrapped ? `-${wrapped[1]}` : s;
  return parseFloat(signed.replace(/[^0-9.\-+]/g, ""));
}

function highlightCell(raw: string): { color: string; bold: boolean } | undefined {
  const n = parseNumericCell(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n > 0) return { color: POSITIVE_COLOR, bold: Math.abs(n) >= 10 };
  if (n < 0) return { color: NEGATIVE_COLOR, bold: Math.abs(n) >= 10 };
  return undefined;
}

export const BlackswanTickerTable: React.FC<BlackswanLayoutProps> = ({
  title = "Key Figures",
  narration,
  accentColor = "#00E5FF",
  bgColor = "#050A10",
  textColor = "#FFFFFF",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  tickerTable,
  tickerTitle,
  tickerFootnote,
  tickerHighlightCol,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const font = fontFamily ?? DISPLAY_FONT;

  const titleSize = titleFontSize ?? (p ? 80 : 65);
  const descSize = descriptionFontSize ?? (p ? 38 : 31);

  const GRID_LINE = rgbaFromHex(accentColor, 0.12);
  const PANEL_BG = rgbaFromHex(accentColor, 0.05);
  const PANEL_BORDER = rgbaFromHex(accentColor, 0.28);
  const HEADER_BG = rgbaFromHex(accentColor, 0.18);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, MAX_COLS);
  const rawRows = (tickerTable?.rows ?? []).slice(0, MAX_ROWS).map((r) => (r ?? []).slice(0, MAX_COLS));
  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m, r) => Math.max(m, r.length), 0), 1);
  const rowCount = rawRows.length;
  const hlCol = typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount ? tickerHighlightCol : -1;
  const hasData = rowCount > 0;

  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const fewRows = rowCount <= 6;
  const fewCols = colCount <= 4;

  const cellFontSize = (() => {
    const colTier = colCount <= 3 ? 0 : colCount <= 5 ? 1 : 2;
    const tier = Math.max(densityTier, colTier);
    const base = p ? 32 : 28;
    return Math.round(base * [1, 0.95, 0.9][tier]);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.88);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.6 + cellPadV * 2);

  const tableWidthCap = colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], { extrapolateRight: "clamp" });

  function rowOp(i: number) {
    const delay = 20 + i * 8;
    return interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const cellBorder = (ci: number) => ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: font, background: bgColor }}>
      <StarField accentColor={accentColor} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "8% 7%" : "5% 7%", gap: 0, zIndex: 10 }}>
        {/* Title block */}
        <div style={{ opacity: titleOp, flexShrink: 0, marginBottom: Math.round(height * 0.022), alignSelf: fewCols ? "center" : "stretch", textAlign: fewCols ? "center" : "left", width: tableWidthCap, maxWidth: "100%" }}>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: titleSize, lineHeight: 1.05, ...neonTitleTubeStyle(accentColor, { bgColor }) }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: font, fontSize: descSize - 4, color: accentColor, opacity: 0.75, marginTop: 6, letterSpacing: "0.06em" }}>
              {tickerTitle}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          <div style={{ alignSelf: fewCols ? "center" : "stretch", width: tableWidthCap, maxWidth: "100%", flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, boxShadow: `0 0 32px ${rgbaFromHex(accentColor, 0.08)}` }}>
            {!hasData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8%", fontFamily: font, fontSize: descSize, color: accentColor, opacity: 0.4, fontStyle: "italic" }}>
                No data — add a table by editing this scene
              </div>
            ) : (
              <>
                {rawHeaders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, background: HEADER_BG, borderBottom: `1px solid ${PANEL_BORDER}`, opacity: headerOp }}>
                    {rawHeaders.map((hdr, ci) => (
                      <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: font, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.1em", textTransform: "uppercase", color: accentColor, borderRight: ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none", textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                        {hdr}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                  {rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", borderBottom: ri < rowCount - 1 ? `1px solid ${GRID_LINE}` : "none", opacity: rowOp(ri), background: ri % 2 === 1 ? rgbaFromHex(accentColor, 0.03) : "transparent" }}>
                      {Array.from({ length: colCount }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: font, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, lineHeight: 1.4, color: hlStyle ? hlStyle.color : textColor, borderRight: cellBorder(ci), textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                            <span style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{cellRaw}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footnote */}
        {(tickerFootnote || narration) && (
          <div style={{ opacity: footnoteOp * 0.55, flexShrink: 0, marginTop: Math.round(height * 0.014), fontFamily: font, fontSize: Math.round(descSize * 0.82), color: accentColor, lineHeight: 1.4, letterSpacing: "0.03em" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
