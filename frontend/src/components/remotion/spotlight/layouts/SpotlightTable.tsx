import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { AccentBars, KineticTicker } from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";

/**
 * SpotlightTable — data table / snapshot scene. Renders the shared tickerTable
 * contract (headers + rows, optional highlight column for +/- coloring) as a
 * bold high-contrast grid on a frosted glass panel over the black Spotlight
 * stage. Title uses Archivo Black with a red accent rule; +/- cells in the
 * highlight column color-code green (up) / red (down).
 */

const SPOTLIGHT_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const ACCENT = "#EF4444";
const WHITE = "#FFFFFF";
const POSITIVE_COLOR = "#34D399";
const NEGATIVE_COLOR = "#EF4444";
const GRID_STROKE = "rgba(255,255,255,0.12)";
const PANEL_BG = "rgba(255,255,255,0.045)";
const HEADER_BG = "rgba(239,68,68,0.14)";

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

/** Simple clamped 0→1 reveal at a given frame window (in seconds * 90). */
function reveal(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start * 90) / ((end - start) * 90)));
}

export const SpotlightTable: React.FC<SpotlightLayoutProps> = ({
  title = "The breakdown",
  narration,
  accentColor = ACCENT,
  bgColor = "#000000",
  textColor = WHITE,
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
  const { height, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const displayFont = fontFamily || SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFont = fontFamily || SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;
  const accent = accentColor || ACCENT;

  const titleSize = titleFontSize ?? (p ? 60 : 50);
  const descSize = descriptionFontSize ?? (p ? 22 : 18);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TABLE_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, SPOTLIGHT_TABLE_MAX_ROWS)
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

  const padH = p ? "4%" : "5%";

  // Title spring-slam (1.16 over-scale → 1.0).
  const titleSlam = spring({ frame: frame - 1, fps, config: { damping: 18, stiffness: 180 } });
  const titleScale = 1.16 - 0.16 * titleSlam;

  const headerA = reveal(frame, 0, 0.18);
  const titleA = reveal(frame, 0.0, 0.18);
  function rowOpacity(i: number): number {
    const start = 0.18 + i * (rowCount <= 6 ? 0.065 : rowCount <= 12 ? 0.045 : 0.03);
    const end = start + 0.22;
    return reveal(frame, start, Math.min(end, 0.98));
  }
  const footnoteA = reveal(frame, 0.8, 0.95);

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <SpotlightBackground bgColor={bgColor} accentColor={accent} />

      {/* Decorative artifacts — accent bars + a marquee echoing the table's title. */}
      <AccentBars accentColor={accent} position="top-right" count={2} startFrame={8} />
      <KineticTicker accentColor={accent} edge="bottom" label={(tickerTitle || title || "DATA").slice(0, 48)} speed={0.8} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "5%" : "4.5%"} ${padH}`, minHeight: 0, gap: 0 }}>
        <div
          style={{
            opacity: titleA,
            flexShrink: 0,
            marginBottom: Math.round(height * 0.016),
            width: tableWidthCap,
            maxWidth: "100%",
            alignSelf: fewCols ? "center" : "stretch",
            textAlign: fewCols ? "center" : "left",
            transform: `scale(${titleScale})`,
            transformOrigin: fewCols ? "center" : "left center",
          }}
        >
          <div style={{ fontFamily: displayFont, fontWeight: 900, fontSize: titleSize, letterSpacing: "-0.03em", lineHeight: 1.02, color: textColor || WHITE, textTransform: "uppercase" }}>
            {title}
          </div>
          {tickerTitle ? (
            <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: Math.round(descSize * 0.95), letterSpacing: "0.1em", color: accent, marginTop: Math.round(height * 0.008), textTransform: "uppercase" }}>
              {tickerTitle}
            </div>
          ) : (
            <div style={{ width: 84, height: 6, background: accent, marginTop: Math.round(height * 0.01), borderRadius: 2, marginLeft: fewCols ? "auto" : 0, marginRight: fewCols ? "auto" : 0 }} />
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
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid rgba(255,255,255,0.12)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.45)`,
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `2px solid ${accent}`, opacity: headerA, alignItems: "stretch" }}>
                {rawHeaders.map((hdr, ci) => (
                  <div
                    key={ci}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      boxSizing: "border-box",
                      padding: `${Math.round(cellPadV * 1.08)}px ${cellPadH}px`,
                      fontFamily: bodyFont,
                      fontWeight: 800,
                      fontSize: headerFontSize,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: textColor || WHITE,
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
                        background: ri % 2 === 1 ? "rgba(255,255,255,0.035)" : "transparent",
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
                              fontWeight: hlStyle?.bold ? 800 : ci === 0 ? 700 : 500,
                              fontSize: cellFontSize,
                              letterSpacing: "0.01em",
                              lineHeight: 1.38,
                              color: hlStyle ? hlStyle.color : textColor || WHITE,
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${Math.round(height * 0.04)}px`, fontFamily: bodyFont, fontSize: descSize, color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>
                  No data — add data by editing this scene
                </div>
              )}
            </div>
          </div>
        </div>

        {(tickerFootnote || narration) && (
          <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.01), fontFamily: bodyFont, fontWeight: 500, fontSize: Math.round(descSize * 0.84), letterSpacing: "0.02em", color: "rgba(255,255,255,0.6)", lineHeight: 1.4, whiteSpace: "normal" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
