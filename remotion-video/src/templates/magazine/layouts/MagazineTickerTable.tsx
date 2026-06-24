import React from "react";
import { interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  KineticWords,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
  useMagFrame,
} from "../magazineStyle";

const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#1E7A4C";
const NEGATIVE_COLOR = "#B83B3B";

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

/**
 * Data table — a clean editorial ledger drawn straight on the paper with an
 * accent header band and hairline rules. Rows reveal in sequence.
 */
export const MagazineTickerTable: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, tickerTable, tickerTitle, tickerFootnote, tickerHighlightCol } = props;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const titleSize = titleFontSize ?? (p ? 50 : 44);
  const descSize = descriptionFontSize ?? (p ? 28 : 22);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, MAX_COLS);
  const rawRows = (tickerTable?.rows ?? []).slice(0, MAX_ROWS).map((r) => (r ?? []).slice(0, MAX_COLS));
  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m, r) => Math.max(m, r.length), 0), 1);
  const rowCount = rawRows.length;
  const hlCol = typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount ? tickerHighlightCol : -1;
  const hasData = rowCount > 0;

  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const cellFontSize = (() => {
    const colTier = colCount <= 3 ? 0 : colCount <= 5 ? 1 : 2;
    const tier = Math.max(densityTier, colTier);
    return Math.round((p ? 24 : 20) * [1, 0.92, 0.85][tier]);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.82);
  const cellPadV = (p ? [13, 10, 8] : [12, 9, 7])[densityTier];
  const cellPadH = colCount <= 4 ? 18 : 12;
  const GRID = `${text}1a`;

  const frame = useMagFrame();
  const titleO = useReveal(0, 14);
  const headerOp = useReveal(6, 14);
  const footnoteOp = interpolate(frame, [20 + rowCount * 6, 20 + rowCount * 6 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rowOp = (i: number) => interpolate(frame, [20 + i * 6, 20 + i * 6 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rowY = (i: number) => interpolate(frame, [20 + i * 6, 20 + i * 6 + 14], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <MagazinePage colors={colors} section="Ledger" issue={props.issueLabel ?? "Data"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} singlePage cameraMove={props.cameraMove}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ opacity: titleO, flexShrink: 0, marginBottom: 22 }}>
          <Kicker color={accent} style={{ marginBottom: 12 }}>{tickerTitle || "Figures"}</Kicker>
          <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: titleSize, lineHeight: 1.04, letterSpacing: "-0.015em", color: text, margin: 0 }}>
            <KineticWords text={title || "By the Numbers"} start={2} stagger={2} dur={14} />
          </h1>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: `1px solid ${GRID}` }}>
          {!hasData ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: descSize, color: text, opacity: 0.45 }}>
              No data — add a table by editing this scene
            </div>
          ) : (
            <>
              {rawHeaders.length > 0 && (
                <div style={{ display: "flex", flexShrink: 0, background: accent, opacity: headerOp }}>
                  {rawHeaders.map((hdr, ci) => (
                    <div
                      key={ci}
                      style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        boxSizing: "border-box",
                        padding: `${Math.round(cellPadV * 1.2)}px ${cellPadH}px`,
                        fontFamily: MAG_SANS,
                        fontWeight: 700,
                        fontSize: headerFontSize,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: bg,
                        borderRight: ci < colCount - 1 ? `1px solid ${bg}33` : "none",
                        textAlign: ci > 0 ? "right" : "left",
                      }}
                    >
                      {hdr}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {rawRows.map((row, ri) => (
                  <div
                    key={ri}
                    style={{
                      flex: rowCount <= 8 ? `0 0 auto` : "1 1 0",
                      display: "flex",
                      borderBottom: ri < rowCount - 1 ? `1px solid ${GRID}` : "none",
                      opacity: rowOp(ri),
                      transform: `translateY(${rowY(ri)}px)`,
                      background: ri % 2 === 1 ? `${text}08` : "transparent",
                    }}
                  >
                    {Array.from({ length: colCount }).map((_, ci) => {
                      const cellRaw = row[ci] ?? "";
                      const hl = ci === hlCol ? highlightCell(cellRaw) : undefined;
                      return (
                        <div
                          key={ci}
                          style={{
                            flex: "1 1 0",
                            minWidth: 0,
                            boxSizing: "border-box",
                            padding: `${cellPadV}px ${cellPadH}px`,
                            fontFamily: ci === 0 ? MAG_SERIF : MAG_SANS,
                            fontWeight: hl?.bold ? 700 : ci === 0 ? 600 : 400,
                            fontSize: cellFontSize,
                            lineHeight: 1.4,
                            color: hl ? hl.color : text,
                            borderRight: ci < colCount - 1 ? `1px solid ${GRID}` : "none",
                            textAlign: ci > 0 ? "right" : "left",
                            fontVariantNumeric: "tabular-nums",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: ci > 0 ? "flex-end" : "flex-start",
                          }}
                        >
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

        {(tickerFootnote || narration) && (
          <div style={{ flexShrink: 0, marginTop: 16, fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: Math.round(descSize * 0.78), color: text, opacity: footnoteOp * 0.6, lineHeight: 1.45 }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </MagazinePage>
  );
};
