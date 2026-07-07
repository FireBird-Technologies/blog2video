/**
 * Custom-template craft kit — CustomTable.
 *
 * Brand-themed data table (the "ticker"/ledger half of the data-viz pair, the
 * counterpart to CustomChart). Generalized from chronicle/ChronicleTable and
 * bloomberg/nightfall tables: small-caps header row, zebra rows, tabular figures,
 * +/- coloring on an optional highlight column, staggered row reveal.
 *
 * Reads a plain { headers, rows } table — the same shape the pipeline binds from
 * Firecrawl-extracted tables — so it stays editable via the standard chart_table
 * editor in SceneEditModal.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { progressAt, easeOutQuint } from "./motion";

export interface CustomTableData {
  headers?: string[];
  rows?: Array<Array<string | number>>;
}

export interface CustomTableProps {
  table?: CustomTableData;
  /** Column index to color by sign (+green / -red). */
  highlightCol?: number;
  maxRows?: number;
  maxCols?: number;
  start?: number;
}

function parseNumericCell(raw: string): number {
  const s = String(raw ?? "").trim();
  const wrapped = s.match(/^\(([0-9,.]+)\)$/);
  const signed = wrapped ? `-${wrapped[1]}` : s;
  return parseFloat(signed.replace(/[^0-9.+\-]/g, ""));
}

export const CustomTable: React.FC<CustomTableProps> = ({
  table,
  highlightCol = -1,
  maxRows = 12,
  maxCols = 6,
  start = 0,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const { palette, type, fonts } = useKit();

  const headers = (table?.headers ?? []).slice(0, maxCols).map((h) => String(h ?? ""));
  const rows = (table?.rows ?? [])
    .slice(0, maxRows)
    .map((r) => (r ?? []).slice(0, maxCols).map((c) => String(c ?? "")));
  const nCols = Math.max(headers.length, rows.reduce((m, r) => Math.max(m, r.length), 0), 1);

  const cellFs = Math.round(type.body * (nCols >= 5 ? 0.72 : nCols >= 4 ? 0.8 : 0.9));
  const headFs = Math.round(cellFs * 0.92);
  const padV = nCols >= 5 ? 9 : 12;
  const padH = nCols <= 4 ? 16 : 11;

  const POS = palette.isDark ? "#5BD08A" : "#1F8A4C";
  const NEG = palette.isDark ? "#FF7A6E" : "#C23B2E";

  const hlColor = (raw: string): string | undefined => {
    if (highlightCol < 0) return undefined;
    const n = parseNumericCell(raw);
    if (!Number.isFinite(n) || n === 0) return undefined;
    return n > 0 ? POS : NEG;
  };

  const cellBorder = (ci: number) =>
    ci < nCols - 1 ? `1px solid ${withAlpha(palette.text, 0.1)}` : "none";

  if (!rows.length && !headers.length) return null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: nCols <= 3 ? "70%" : nCols === 4 ? "86%" : "100%",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        background: palette.panel,
        border: `1px solid ${palette.border}`,
        boxShadow: "0 10px 36px rgba(0,0,0,0.22)",
      }}
    >
      {headers.length > 0 && (
        <div
          style={{
            display: "flex",
            background: palette.header,
            borderBottom: `2px solid ${withAlpha(palette.accent, 0.6)}`,
            opacity: easeOutQuint(progressAt(frame, start + 6, 16)),
          }}
        >
          {headers.map((h, ci) => (
            <div
              key={ci}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                padding: `${padV}px ${padH}px`,
                fontFamily: fonts.body,
                fontWeight: 700,
                fontSize: headFs,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: palette.muted,
                borderRight: cellBorder(ci),
                textAlign: ci > 0 ? "right" : "left",
                lineHeight: 1.2,
              }}
            >
              {h}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, ri) => {
          const op = easeOutQuint(progressAt(frame, start + 14 + ri * 4, 16));
          return (
            <div
              key={ri}
              style={{
                display: "flex",
                background: ri % 2 === 1 ? withAlpha(palette.text, 0.04) : "transparent",
                borderBottom: ri < rows.length - 1 ? `1px solid ${withAlpha(palette.text, 0.08)}` : "none",
                opacity: op,
                transform: `translateY(${(1 - op) * 8}px)`,
              }}
            >
              {Array.from({ length: nCols }).map((_, ci) => {
                const raw = row[ci] ?? "";
                const color = ci === highlightCol ? hlColor(raw) : undefined;
                return (
                  <div
                    key={ci}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      padding: `${padV}px ${padH}px`,
                      fontFamily: fonts.body,
                      fontWeight: color ? 700 : ci === 0 ? 600 : 400,
                      fontSize: cellFs,
                      lineHeight: 1.35,
                      color: color ?? palette.text,
                      borderRight: cellBorder(ci),
                      textAlign: ci > 0 ? "right" : "left",
                      fontVariantNumeric: "tabular-nums",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {raw}
                  </div>
                );
              })}
            </div>
          );
        })}
        {!rows.length && (
          <div
            style={{
              padding: Math.round(height * 0.04),
              textAlign: "center",
              fontFamily: fonts.body,
              fontStyle: "italic",
              color: palette.muted,
              fontSize: type.caption,
            }}
          >
            No entries — add data by editing this scene
          </div>
        )}
      </div>
    </div>
  );
};
