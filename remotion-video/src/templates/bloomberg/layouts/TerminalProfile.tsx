import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalProfile: React.FC<BloombergLayoutProps> = ({
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
  const dSize = descriptionFontSize ?? (p ? 26 : 30);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const profiles = items.length > 0 ? items : [
    "CLASSIC       Amber on black. Pure terminal baseline.",
    "BLUE-HOUR     Cool blue accent. After-hours session.",
    "RISK-RED      Red dominant. Drawdown / alert mode.",
    "MACRO-GOLD    Gold palette. Macro and rates focus.",
    "DARK-CONTRAST High contrast whites. Print clarity.",
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
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:PREF</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + (p ? 14 : 10), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
      }}>
        {title}
      </div>

      {/* Section header */}
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
          DISPLAY PROFILE MATRIX
        </span>
      </div>

      {/* Profile rows */}
      <div style={{
        position: "absolute",
        top: topH + (p ? 120 : 106),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 8,
      }}>
        {profiles.map((profile, i) => {
          const rowOpacity = interpolate(frame, [i * 7 + 8, i * 7 + 24], [0, 1], { extrapolateRight: "clamp" });
          const parts = profile.split(/\s{2,}/);
          const name = parts[0] || profile;
          const desc = parts.slice(1).join("  ");
          return (
            <div key={i} style={{
              backgroundColor: i % 2 === 0 ? BLOOMBERG_COLORS.panelBg : BLOOMBERG_COLORS.bg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderLeft: `3px solid ${i === 0 ? amber : BLOOMBERG_COLORS.border}`,
              padding: p ? "16px 20px" : "14px 20px",
              display: "flex", gap: p ? 20 : 32,
              opacity: rowOpacity,
            }}>
              <span style={{ color: amber, fontSize: dSize * 0.85, minWidth: p ? 160 : 200, letterSpacing: 1 }}>
                {name}
              </span>
              <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.75 }}>
                {desc}
              </span>
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
          MBN TERMINAL  ·  PREFERENCES
        </span>
      </div>
    </AbsoluteFill>
  );
};
