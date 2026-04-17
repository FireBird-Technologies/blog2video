import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

const CANDLE_DATA = [
  { h: 60, o: 20, c: 50, up: true },
  { h: 55, o: 35, c: 48, up: true },
  { h: 70, o: 40, c: 30, up: false },
  { h: 65, o: 25, c: 55, up: true },
  { h: 80, o: 45, c: 70, up: true },
  { h: 72, o: 50, c: 40, up: false },
  { h: 75, o: 30, c: 65, up: true },
  { h: 68, o: 42, c: 60, up: true },
  { h: 78, o: 55, c: 45, up: false },
  { h: 85, o: 40, c: 75, up: true },
];

export const TerminalChart: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 60 : 77);
  const dSize = descriptionFontSize ?? (p ? 28 : 36);
  const statSize = dSize * 0.85;
  const labelSize = dSize * 0.4;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const stats = items.length > 0 ? items : ["MA20:  184.40", "MA50:  179.20", "RSI:    62.4", "MACD:  +1.82"];

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: p ? 56 : 48,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`, gap: 24,
        opacity: fadeIn,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:GRPH</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Portrait: stacked chart then stats; Landscape: chart left, stats right */}
      {p ? (
        <>
          {/* Title */}
          <div style={{
            position: "absolute", top: 72, left: 40, right: 40,
            color: amber, fontSize: tSize * 0.55, opacity: titleOp, letterSpacing: -0.5,
          }}>{title}</div>

          {/* Chart area top half */}
          <div style={{
            position: "absolute", top: 130, left: 40, right: 40, height: "38%",
            backgroundColor: BLOOMBERG_COLORS.panelBg, border: `1px solid ${BLOOMBERG_COLORS.border}`,
            display: "flex", flexDirection: "column", opacity: fadeIn,
          }}>
            <div style={{ padding: "8px 16px", borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`, color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
              CHART  ·  1D  ·  CANDLE
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", padding: "16px 16px 32px", gap: 10, justifyContent: "center" }}>
              {CANDLE_DATA.map((c, i) => {
                const barOpacity = interpolate(frame, [i * 3, i * 3 + 10], [0, 1], { extrapolateRight: "clamp" });
                const color = c.up ? amber : BLOOMBERG_COLORS.neg;
                const bodyH = Math.abs(c.c - c.o);
                const bodyTop = Math.max(c.o, c.c);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: barOpacity }}>
                    <div style={{ width: 2, height: c.h - bodyTop, backgroundColor: color }} />
                    <div style={{ width: 14, height: Math.max(bodyH, 4), backgroundColor: color }} />
                    <div style={{ width: 2, height: Math.min(c.o, c.c), backgroundColor: color }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            position: "absolute", top: "56%", left: 40, right: 40, bottom: 54,
            display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start", opacity: fadeIn,
          }}>
            {stats.map((stat, i) => (
              <div key={i} style={{
                flex: "0 0 calc(50% - 4px)",
                backgroundColor: BLOOMBERG_COLORS.panelBg, border: `1px solid ${BLOOMBERG_COLORS.border}`,
                padding: "10px 14px",
                color: stat.includes("-") ? BLOOMBERG_COLORS.neg : amber, fontSize: statSize,
                opacity: interpolate(frame, [i * 5, i * 5 + 15], [0, 1], { extrapolateRight: "clamp" }),
              }}>{stat}</div>
            ))}
            <div style={{ flex: "0 0 100%", color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65, marginTop: 8 }}>{narration}</div>
          </div>
        </>
      ) : (
        <>
          {/* Landscape: chart left 68%, stats right 30% */}
          <div style={{
            position: "absolute", top: 68, left: 48, right: "32%", bottom: 46,
            border: `1px solid ${BLOOMBERG_COLORS.border}`, backgroundColor: BLOOMBERG_COLORS.panelBg,
            display: "flex", flexDirection: "column", opacity: fadeIn,
          }}>
            <div style={{ padding: "6px 16px 6px", borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>CHART  ·  1D  ·  CANDLE</span>
              <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", padding: "24px 24px 48px", gap: 16, justifyContent: "center" }}>
              {CANDLE_DATA.map((c, i) => {
                const barOpacity = interpolate(frame, [i * 3, i * 3 + 10], [0, 1], { extrapolateRight: "clamp" });
                const color = c.up ? amber : BLOOMBERG_COLORS.neg;
                const bodyH = Math.abs(c.c - c.o);
                const bodyTop = Math.max(c.o, c.c);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: barOpacity }}>
                    <div style={{ width: 2, height: c.h - bodyTop, backgroundColor: color }} />
                    <div style={{ width: 18, height: Math.max(bodyH, 4), backgroundColor: color }} />
                    <div style={{ width: 2, height: Math.min(c.o, c.c), backgroundColor: color }} />
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "8px 16px", borderTop: `1px solid ${BLOOMBERG_COLORS.border}`, color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.6 }}>{narration}</div>
          </div>
          {/* Right stats */}
          <div style={{
            position: "absolute", top: 68, right: 0, width: "30%", bottom: 46,
            borderLeft: `1px solid ${BLOOMBERG_COLORS.border}`, backgroundColor: BLOOMBERG_COLORS.panelBg,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "8px 16px", borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`, color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>INDICATORS</div>
            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {stats.map((stat, i) => (
                <div key={i} style={{
                  color: stat.includes("-") ? BLOOMBERG_COLORS.neg : amber, fontSize: statSize,
                  borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`, paddingBottom: 12,
                  opacity: interpolate(frame, [i * 5, i * 5 + 15], [0, 1], { extrapolateRight: "clamp" }),
                }}>{stat}</div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: p ? 44 : 36,
        backgroundColor: BLOOMBERG_COLORS.headerBg, borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>MBN TERMINAL  ·  CHART ANALYSIS</span>
      </div>
    </AbsoluteFill>
  );
};
