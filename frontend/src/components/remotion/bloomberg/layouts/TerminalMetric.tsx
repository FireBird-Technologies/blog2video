import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";

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

  const tSize = titleFontSize ?? (p ? 104 : 108);
  const dSize = descriptionFontSize ?? (p ? 41 : 36);
  const labelSize = dSize * 0.4;

  // Animation constants
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });

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
      <BackgroundGraph accentColor={blue} textColor={amber} variant="metric" />
      {/* Top bar - Title removed from here */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:ECON</span>
      </div>

      {/* Main Content Container: Centers Title + Metrics + Narration */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        padding: `0 ${pad}px`,
        gap: p ? 30 : 40, // Space between title, tiles, and narration
      }}>
        
        {/* Title: Only shown here, above metrics */}
        <div style={{
          color: amber, 
          fontSize: tSize * 0.6, 
          opacity: titleOpacity, 
          letterSpacing: -0.5,
          fontWeight: "bold",
          textAlign: "center",
          textTransform: "uppercase"
        }}>
          {title}
        </div>

        {/* Metric tiles */}
        <div style={{
          display: "flex", 
          justifyContent: "center", 
          gap: p ? 20 : 32,
          flexWrap: "wrap",
        }}>
          {tiles.map((tile, i) => {
            const tileOpacity = interpolate(frame, [i * 10 + 12, i * 10 + 28], [0, 1], { extrapolateRight: "clamp" });
            const tileSlide = interpolate(frame, [i * 10 + 12, i * 10 + 28], [20, 0], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                backgroundColor: BLOOMBERG_COLORS.panelBg,
                border: `1px solid ${BLOOMBERG_COLORS.border}`,
                borderTop: `2px solid ${amber}`,
                padding: p ? "20px 30px" : "32px 48px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                minWidth: p ? 160 : 220,
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

        {/* Narration: Shown below the metrics */}
        <div style={{
          color: BLOOMBERG_COLORS.muted, 
          fontSize: dSize * 0.7,
          textAlign: "center",
          maxWidth: "80%",
          lineHeight: 1.4,
          opacity: narrationOpacity,
        }}>
          {narration}
        </div>
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