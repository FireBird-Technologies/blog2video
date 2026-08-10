import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { COLORS, glass } from "../utils/styles";

const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#1E7A4C";
const NEGATIVE_COLOR = "#B83B3B";
const GRID_LINE = "rgba(23,23,23,0.10)";

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

export const GridcraftTickerTable: React.FC<GridcraftLayoutProps> = ({
  title = "Key Figures",
  narration,
  accentColor = COLORS.ACCENT,
  bgColor = COLORS.BG,
  textColor = COLORS.DARK,
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
  const SANS = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const titleSize = titleFontSize ?? (p ? 90 : 87);
  const descSize = descriptionFontSize ?? (p ? 39 : 33);

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
    const base = p ? 24 : 20;
    return Math.round(base * [1, 0.95, 0.9][tier]);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.85);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.6 + cellPadV * 2);

  const tableWidthCap = colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const accentBarW = interpolate(frame, [0, 20], [0, 100], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], { extrapolateRight: "clamp" });

  function rowOp(i: number) {
    const delay = 20 + i * 8;
    return interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const cellBorder = (ci: number) => ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: SANS, backgroundColor: bgColor }}>
      {/* Subtle dot grid bg */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${textColor}0A 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "8% 7%" : "5% 7%", gap: 0, zIndex: 10 }}>
        {/* Title block */}
        <div style={{ opacity: titleOp, flexShrink: 0, marginBottom: Math.round(height * 0.022), alignSelf: fewCols ? "center" : "stretch", textAlign: fewCols ? "center" : "left", width: tableWidthCap, maxWidth: "100%" }}>
          <div style={{ height: 4, background: accentColor, width: `${accentBarW}%`, borderRadius: 2, marginBottom: 12 }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: titleSize, lineHeight: 1.05, letterSpacing: "-0.02em", color: textColor }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: descSize - 4, color: COLORS.MUTED, marginTop: 6, letterSpacing: "0.02em" }}>
              {tickerTitle}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          <div style={{ alignSelf: fewCols ? "center" : "stretch", width: tableWidthCap, maxWidth: "100%", flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...glass(false), borderRadius: 16 }}>
            {!hasData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8%", fontFamily: SANS, fontSize: descSize, color: COLORS.MUTED, fontStyle: "italic" }}>
                No data — add a table by editing this scene
              </div>
            ) : (
              <>
                {rawHeaders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, background: accentColor, opacity: headerOp }}>
                    {rawHeaders.map((hdr, ci) => (
                      <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: SANS, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.WHITE, borderRight: ci < colCount - 1 ? `1px solid rgba(255,255,255,0.2)` : "none", textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                        {hdr}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                  {rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", borderBottom: ri < rowCount - 1 ? `1px solid ${GRID_LINE}` : "none", opacity: rowOp(ri), background: ri % 2 === 1 ? `${textColor}05` : "transparent" }}>
                      {Array.from({ length: colCount }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: SANS, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, lineHeight: 1.4, color: hlStyle ? hlStyle.color : textColor, borderRight: cellBorder(ci), textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
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
          <div style={{ opacity: footnoteOp, flexShrink: 0, marginTop: Math.round(height * 0.014), fontFamily: SANS, fontSize: Math.round(descSize * 0.82), color: COLORS.MUTED, lineHeight: 1.4 }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
