import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

const GREEN = "#4CAF50";

export const TerminalTable: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  items = [],
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const tSize = titleFontSize ?? (p ? 64 : 79);
  const dSize = descriptionFontSize ?? (p ? 26 : 28);
  const labelSize = dSize * 0.4;

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });

  const rawRows = items.length > 0 ? items : [
    "POSITION | QTY | ENTRY  | CURRENT | P&L",
    "AAPL     | 100 | 172.40 |  189.40 | +$1,700",
    "NVDA     |  50 | 620.00 |  847.20 | +$11,360",
    "TSLA     |  80 | 185.00 |  172.30 | -$1,016",
  ];

  const parsedRows = rawRows.map(row => row.split("|").map(cell => cell.trim()));
  const [headerCols, ...dataCols] = parsedRows;

  const colCount = headerCols?.length ?? 1;
  const colFlexes = headerCols?.map((_, i) => i === 0 ? 2 : 1) ?? Array(colCount).fill(1);

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;
  const rowPad = p ? "16px 20px" : "13px 20px";
  const rowFontSize = dSize * 0.78;
  const headerFontSize = dSize * 0.7;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
        opacity: fadeIn,
      }}>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 14 : 10), left: pad, right: pad,
        fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        <span style={{ backgroundColor: amber, color: "#000000", display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
      </div>

      {/* Table */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 74 : 62),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column", justifyContent: "center",
        opacity: fadeIn,
      }}>
        {/* Header row */}
        {headerCols && (
          <div style={{
            display: "flex",
            backgroundColor: BLOOMBERG_COLORS.headerBg,
            borderLeft: `3px solid ${blue}`,
            borderTop: `1px solid ${amber}`,
            borderRight: `1px solid ${amber}`,
            borderBottom: `2px solid ${amber}`,
            padding: rowPad,
          }}>
            {headerCols.map((col, ci) => (
              <div key={ci} style={{
                flex: colFlexes[ci],
                color: blue,
                fontSize: headerFontSize,
                letterSpacing: 2,
                textAlign: "center",
                textTransform: "uppercase",
              }}>
                {col}
              </div>
            ))}
          </div>
        )}

        {/* Data rows */}
        {dataCols.map((cols, i) => {
          const rowOpacity = interpolate(frame, [i * 6 + 10, i * 6 + 22], [0, 1], { extrapolateRight: "clamp" });
          const rowSlideX = interpolate(frame, [i * 6 + 10, i * 6 + 22], [24, 0], { extrapolateRight: "clamp" });
          const rowBg = i % 2 === 0 ? BLOOMBERG_COLORS.panelBg : BLOOMBERG_COLORS.bg;

          const lastCol = cols[cols.length - 1] ?? "";
          const isNeg = /^-/.test(lastCol);
          const isPos = /^\+/.test(lastCol);
          const accentBorder = isNeg ? BLOOMBERG_COLORS.neg : isPos ? GREEN : BLOOMBERG_COLORS.border;

          return (
            <div key={i} style={{
              display: "flex",
              backgroundColor: rowBg,
              borderLeft: `3px solid ${accentBorder}`,
              borderRight: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`,
              padding: rowPad,
              opacity: rowOpacity,
              transform: `translateX(${rowSlideX}px)`,
            }}>
              {cols.map((cell, ci) => {
                const isLast = ci === cols.length - 1;
                const cellColor = isLast && isNeg
                  ? BLOOMBERG_COLORS.neg
                  : isLast && isPos
                  ? GREEN
                  : amber;
                return (
                  <div key={ci} style={{
                    flex: colFlexes[ci],
                    color: cellColor,
                    fontSize: rowFontSize,
                    textAlign: "center",
                    fontWeight: isLast ? "bold" : "normal",
                  }}>
                    {cell}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
        color: amber, fontSize: dSize * 0.65,
      }}>
        {narration}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${pad}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          DATA TABLE
        </span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 1 }}>
          {dataCols.length} RECORDS
        </span>
      </div>
    </AbsoluteFill>
  );
};
