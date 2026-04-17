import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

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

  const rows = items.length > 0 ? items : [
    "POSITION | QTY | ENTRY  | CURRENT | P&L",
    "AAPL     | 100 | 172.40 |  189.40 | +$1,700",
    "NVDA     |  50 | 620.00 |  847.20 | +$11,360",
    "TSLA     |  80 | 185.00 |  172.30 | -$1,016",
  ];

  const [header, ...dataRows] = rows;

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

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
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:PORT</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 14 : 10), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* Table */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 74 : 62),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column",
        opacity: fadeIn,
      }}>
        {header && (
          <div style={{
            backgroundColor: BLOOMBERG_COLORS.headerBg,
            border: `1px solid ${amber}`,
            borderBottom: `2px solid ${amber}`,
            padding: p ? "14px 20px" : "12px 20px",
            color: blue,
            fontSize: dSize * 0.8,
            letterSpacing: 2,
          }}>
            {header}
          </div>
        )}

        {dataRows.map((row, i) => {
          const rowOpacity = interpolate(frame, [i * 6 + 10, i * 6 + 22], [0, 1], { extrapolateRight: "clamp" });
          const isNeg = row.includes("-$") || row.includes("-0") || row.includes("-1") || row.includes("-2") || row.includes("-3");
          const rowBg = i % 2 === 0 ? BLOOMBERG_COLORS.panelBg : BLOOMBERG_COLORS.bg;
          return (
            <div key={i} style={{
              backgroundColor: rowBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderTop: "none",
              padding: p ? "14px 20px" : "12px 20px",
              color: isNeg ? BLOOMBERG_COLORS.neg : amber,
              fontSize: dSize * 0.8,
              opacity: rowOpacity,
            }}>
              {row}
            </div>
          );
        })}
      </div>

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
        color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
        opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {narration}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  DATA TABLE
        </span>
      </div>
    </AbsoluteFill>
  );
};
