import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalList: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 72 : 108);
  const dSize = descriptionFontSize ?? (p ? 32 : 36);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });

  const listItems = items.length > 0 ? items : [
    "Monitor FOMC minutes for rate guidance",
    "Watch 10Y yield for breakout confirmation",
    "Track VIX below 20 for risk-on continuation",
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
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:LIST</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 16 : 12), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5,
        opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* List */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 82 : 70),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column", justifyContent: "center", gap: p ? 18 : 20,
      }}>
        {listItems.map((item, i) => {
          const itemOpacity = interpolate(frame, [i * 8 + 10, i * 8 + 25], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 20,
              opacity: itemOpacity,
            }}>
              <span style={{ color: blue, fontSize: dSize, lineHeight: 1.5, flexShrink: 0 }}>
                &gt;
              </span>
              <div style={{
                color: amber, fontSize: dSize * 0.85, lineHeight: 1.5,
                borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`, paddingBottom: 12, flex: 1,
              }}>
                {item}
              </div>
            </div>
          );
        })}
      </div>

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
        color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
        opacity: interpolate(frame, [listItems.length * 8 + 15, listItems.length * 8 + 28], [0, 1], { extrapolateRight: "clamp" }),
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
          MBN TERMINAL  ·  WATCH LIST
        </span>
      </div>
    </AbsoluteFill>
  );
};
