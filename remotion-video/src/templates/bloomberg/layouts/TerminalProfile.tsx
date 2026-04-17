import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundHistogramGraph } from "./BackgroundHistogramGraph";

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

  const tSize = titleFontSize ?? (p ? 105 : 107);
  const dSize = descriptionFontSize ?? (p ? 33 : 35);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const profiles = items.length > 0 ? items : [
    "CLASSIC    Amber on black. Pure terminal baseline.",
    "BLUE-HOUR  Cool blue accent. After-hours session.",
    "RISK-RED   Red dominant. Drawdown / alert mode.",
    "MACRO-GOLD Gold palette. Macro and rates focus.",
    "DARK-CONTRAST High contrast whites. Print clarity.",
  ];

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar (Title removed) */}
      <BackgroundHistogramGraph accentColor={blue} textColor={amber} />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:PREF</span>
      </div>

      {/* Main Centered Container */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        padding: `0 ${pad}px`,
      }}>
        
        {/* Single Centered Title */}
        <div style={{
          color: amber,
          fontSize: tSize * 0.6,
          opacity: titleOpacity,
          letterSpacing: -0.5,
          fontWeight: "bold",
          textAlign: "center",
          textTransform: "uppercase",
          marginBottom: p ? 30 : 50,
        }}>
          {title}
        </div>

        {/* Profiles Grid (Cards) */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: p ? 16 : 24,
          width: "100%",
          maxWidth: 1200,
        }}>
          {profiles.map((profile, i) => {
            const rowOpacity = interpolate(frame, [i * 7 + 10, i * 7 + 25], [0, 1], { extrapolateRight: "clamp" });
            const rowSlide = interpolate(frame, [i * 7 + 10, i * 7 + 25], [20, 0], { extrapolateRight: "clamp" });
            
            const parts = profile.split(/\s{2,}/);
            const name = parts[0] || profile;
            const desc = parts.slice(1).join("  ");

            return (
              <div key={i} style={{
                backgroundColor: BLOOMBERG_COLORS.panelBg,
                border: `1px solid ${BLOOMBERG_COLORS.border}`,
                borderTop: `3px solid ${amber}`, // Highlight top of card
                padding: p ? "20px" : "24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: p ? "100%" : "30%", // 3 columns on landscape, full width on portrait
                minWidth: p ? "none" : 280,
                opacity: rowOpacity,
                transform: `translateY(${rowSlide}px)`,
              }}>
                <span style={{ 
                  color: blue, 
                  fontSize: dSize * 0.7, 
                  letterSpacing: 2, 
                  fontWeight: "bold" 
                }}>
                  {name}
                </span>
                <span style={{ 
                  color: BLOOMBERG_COLORS.muted, 
                  fontSize: dSize * 0.7, 
                  lineHeight: 1.4 
                }}>
                  {desc}
                </span>
              </div>
            );
          })}
        </div>

        {/* Increased Narration Size below Cards */}
        <div style={{
          marginTop: p ? 40 : 60,
          color: BLOOMBERG_COLORS.muted,
          fontSize: dSize * 0.85,
          textAlign: "center",
          maxWidth: "80%",
          opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
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
          MBN TERMINAL  ·  PREFERENCES
        </span>
      </div>
    </AbsoluteFill>
  );
};