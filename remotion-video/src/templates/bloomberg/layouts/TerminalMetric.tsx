import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalMetric: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 72 : 97);
  const dSize = descriptionFontSize ?? (p ? 30 : 37);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const tiles = metrics.length > 0 ? metrics : [
    { value: "4.31", label: "10Y YIELD", suffix: "%" },
    { value: "18.4", label: "VIX", suffix: "" },
    { value: "104.2", label: "DXY", suffix: "" },
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
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:ECON</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 16 : 12), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.48, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* Metric tiles centred */}
      <div style={{
        position: "absolute", top: "50%", left: pad, right: pad,
        transform: "translateY(-40%)",
        display: "flex", justifyContent: "center", gap: p ? 20 : 32,
        flexWrap: "wrap",
      }}>
        {tiles.map((tile, i) => {
          const tileOpacity = interpolate(frame, [i * 10 + 8, i * 10 + 28], [0, 1], { extrapolateRight: "clamp" });
          const tileSlide = interpolate(frame, [i * 10 + 8, i * 10 + 28], [40, 0], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              backgroundColor: BLOOMBERG_COLORS.panelBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderTop: `2px solid ${amber}`,
              padding: p ? "24px 36px" : "32px 48px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              minWidth: p ? 180 : 220,
              opacity: tileOpacity,
              transform: `translateY(${tileSlide}px)`,
            }}>
              <div style={{ color: amber, fontSize: tSize * 0.85, lineHeight: 1 }}>
                {tile.value}
                <span style={{ fontSize: tSize * 0.4, color: BLOOMBERG_COLORS.muted }}>
                  {tile.suffix}
                </span>
              </div>
              <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.6, letterSpacing: 3 }}>
                {tile.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
        color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
        textAlign: "center",
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
          MBN TERMINAL  ·  KEY METRICS
        </span>
      </div>
    </AbsoluteFill>
  );
};
