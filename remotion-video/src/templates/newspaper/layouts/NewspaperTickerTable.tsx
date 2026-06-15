import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#1E7A4C";
const NEGATIVE_COLOR = "#B83B3B";
const GRID_LINE = "rgba(17,17,17,0.12)";

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

export const NewspaperTickerTable: React.FC<BlogLayoutProps> = ({
  title = "By the Numbers",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
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

  const titleSize = titleFontSize ?? (p ? 64 : 51);
  const descSize = descriptionFontSize ?? (p ? 33 : 27);

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
  const headerFontSize = Math.round(cellFontSize * 0.88);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.6 + cellPadV * 2);

  const tableWidthCap = colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  // Animations
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 22], [0, 100], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], { extrapolateRight: "clamp" });

  function rowOp(i: number) {
    const delay = 20 + i * 8;
    return interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const cellBorder = (ci: number) => ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000" }}>
      <NewsBackground bgColor={bgColor} />
      <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2, pointerEvents: "none" }} />
      <img src={staticFile("vintage-news.avif")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, filter: "grayscale(75%) contrast(1.08)", zIndex: 1 }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "8% 7%" : "5% 7%", gap: 0, zIndex: 10 }}>
        {/* Title block — pinned left */}
        <div style={{ opacity: titleOp, flexShrink: 0, marginBottom: Math.round(height * 0.022), alignSelf: "flex-start", textAlign: "left", width: "100%", maxWidth: "100%", marginLeft: p ? "-1%" : "-2%" }}>
          <div style={{ height: 5, width: 52, background: accentColor, marginBottom: 10 }} />
          <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 800, fontSize: titleSize, lineHeight: 1.05, letterSpacing: "-0.01em", color: textColor }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 4, color: textColor, opacity: 0.65, marginTop: 6, letterSpacing: "0.04em" }}>
              {tickerTitle}
            </div>
          )}
          <div style={{ height: 2, background: textColor, opacity: 0.15, width: `${ruleW}%`, marginTop: 10 }} />
        </div>

        {/* Table — styled as a sheet of paper pasted onto the article */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: (!p && fewRows) ? "flex-start" : (fewRows ? "center" : "flex-start") }}>
          <div style={{ position: "relative", alignSelf: fewCols ? "center" : "stretch", width: tableWidthCap, maxWidth: "100%", flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, marginTop: (!p && fewRows) ? Math.round(height * 0.02) : 0, transform: "rotate(-1.2deg)", transformOrigin: "center top" }}>
            {/* The paper sheet */}
            <div style={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#FBF8F0", border: `1px solid ${textColor}1A`, boxShadow: "0 14px 36px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)" }}>
            {!hasData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8%", fontFamily: fontFamily ?? H_FONT, fontSize: descSize, color: textColor, opacity: 0.5, fontStyle: "italic" }}>
                No data — add a table by editing this scene
              </div>
            ) : (
              <>
                {rawHeaders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, background: textColor, borderBottom: `1px solid ${GRID_LINE}`, opacity: headerOp }}>
                    {rawHeaders.map((hdr, ci) => (
                      <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: fontFamily ?? B_FONT, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.08em", textTransform: "uppercase", color: bgColor, borderRight: ci < colCount - 1 ? `1px solid rgba(255,255,255,0.15)` : "none", textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                        {hdr}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                  {rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", borderBottom: ri < rowCount - 1 ? `1px solid ${GRID_LINE}` : "none", opacity: rowOp(ri), background: ri % 2 === 1 ? "rgba(17,17,17,0.025)" : "transparent" }}>
                      {Array.from({ length: colCount }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: fontFamily ?? B_FONT, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, letterSpacing: "0.01em", lineHeight: 1.4, color: hlStyle ? hlStyle.color : textColor, borderRight: cellBorder(ci), textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
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
        </div>

        {/* Footnote */}
        {(tickerFootnote || narration) && (
          <div style={{ flexShrink: 0, marginTop: Math.round(height * 0.014), marginLeft: p ? "-1%" : "-2%", textAlign: "left", fontFamily: fontFamily ?? B_FONT, fontStyle: "italic", fontSize: Math.round(descSize * 0.82), color: textColor, opacity: footnoteOp * 0.65, lineHeight: 1.4 }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
