import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalTicker: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 64 : 97);
  const dSize = descriptionFontSize ?? (p ? 28 : 32);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const rows = items.length > 0 ? items : [
    "AAPL  +2.14%  $189.40",
    "NVDA  +4.88%  $847.20",
    "MSFT  +1.32%  $415.60",
    "TSLA  -1.74%  $172.30",
    "AMZN  +0.96%  $189.10",
  ];

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;
  const colH = p ? 40 : 36;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:SCRN</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 14 : 10), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* Column headers */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 72 : 62),
        left: pad, right: pad, height: colH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `1px solid ${amber}`,
        display: "flex", alignItems: "center", padding: "0 20px",
        opacity: headerOpacity,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 3 }}>
          SYMBOL  ·  CHANGE  ·  PRICE
        </span>
      </div>

      {/* Ticker rows */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 120 : 106),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column",
      }}>
        {rows.map((row, i) => {
          const rowOpacity = interpolate(frame, [i * 7 + 8, i * 7 + 22], [0, 1], { extrapolateRight: "clamp" });
          const isNeg = row.includes("-");
          const rowBg = i % 2 === 0 ? BLOOMBERG_COLORS.panelBg : BLOOMBERG_COLORS.bg;
          return (
            <div key={i} style={{
              backgroundColor: rowBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderTop: "none",
              padding: p ? "16px 20px" : "14px 20px",
              color: isNeg ? BLOOMBERG_COLORS.neg : amber,
              fontSize: dSize * 0.9,
              opacity: rowOpacity,
              letterSpacing: 1,
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
        opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" }),
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
          MBN TERMINAL  ·  SCREENER
        </span>
      </div>
    </AbsoluteFill>
  );
};
