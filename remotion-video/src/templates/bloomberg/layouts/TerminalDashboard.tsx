import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalDashboard: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  metrics = [],
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const tSize = titleFontSize ?? (p ? 64 : 91);
  const dSize = descriptionFontSize ?? (p ? 28 : 38);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });

  const tiles = metrics.length > 0 ? metrics : [
    { value: "S&P 500", label: "INDEX", suffix: "+0.84%" },
    { value: "NASDAQ", label: "INDEX", suffix: "+1.12%" },
    { value: "DXY", label: "DOLLAR", suffix: "-0.22%" },
    { value: "10Y", label: "YIELD", suffix: "4.31%" },
  ];

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
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:MRKT</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 16 : 12), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* KPI grid */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 80 : 70),
        left: pad, right: pad,
        bottom: botH + (p ? 56 : 46),
        display: "flex", flexWrap: "wrap", gap: 16,
        alignContent: "center", justifyContent: "center",
      }}>
        {tiles.map((tile, i) => {
          const tileOpacity = interpolate(frame, [i * 8 + 10, i * 8 + 26], [0, 1], { extrapolateRight: "clamp" });
          const isNeg = (tile.suffix || "").startsWith("-");
          const suffixColor = isNeg ? BLOOMBERG_COLORS.neg : blue;
          const tileW = p ? "calc(50% - 8px)" : (tiles.length <= 3 ? "30%" : "46%");
          return (
            <div key={i} style={{
              width: tileW, minHeight: p ? 140 : 170,
              backgroundColor: BLOOMBERG_COLORS.panelBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderTop: `2px solid ${amber}`,
              padding: p ? "16px 20px" : "20px 24px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              opacity: tileOpacity,
            }}>
              <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 3 }}>
                {tile.label}
              </div>
              <div style={{ color: amber, fontSize: tSize * 0.65, lineHeight: 1 }}>
                {tile.value}
              </div>
              <div style={{ color: suffixColor, fontSize: dSize * 0.85, letterSpacing: 1 }}>
                {tile.suffix}
              </div>
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
          MBN TERMINAL  ·  MARKET OVERVIEW
        </span>
      </div>
    </AbsoluteFill>
  );
};
