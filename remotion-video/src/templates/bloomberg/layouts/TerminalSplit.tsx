import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";

export const TerminalSplit: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  leftLabel = "BEFORE",
  rightLabel = "AFTER",
  leftDescription = "Previous baseline state with elevated risk and negative momentum.",
  rightDescription = "Recovery phase with improving breadth and positive risk appetite.",
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const tSize = titleFontSize ?? (p ? 102 : 107);
  const dSize = descriptionFontSize ?? (p ? 45 : 41);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const leftOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const rightOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  // Vertical spacing adjustments for "shortened" boxes
  const titleHeight = 80;
  const panelTopOffset = topH + titleHeight + 50; // Increased padding from 20 to 50

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      <BackgroundGraph accentColor={blue} textColor={amber} variant="split" />
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:COMP</span>
      </div>

      {/* NEW: Centered Title Section */}
      <div style={{
        position: "absolute",
        top: topH + 20,
        left: 0,
        right: 0,
        textAlign: "center",
        color: amber,
        fontSize: tSize * 0.6,
        fontWeight: "bold",
        opacity: headerOpacity,
        textTransform: "uppercase"
      }}>
        {title}
      </div>

      {p ? (
        /* Portrait: stacked panels */
        <>
          {/* Left panel (Shortened) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: pad, right: pad, height: "25%",
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "20px 28px", opacity: leftOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 8 }}>PANEL A</div>
            <div style={{ color: BLOOMBERG_COLORS.neg, fontSize: tSize * 0.45, lineHeight: 1.1, marginBottom: 10 }}>{leftLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.75, lineHeight: 1.4 }}>{leftDescription}</div>
          </div>

          {/* Right panel (Shortened) */}
          <div style={{
            position: "absolute", top: "58%", left: pad, right: pad, height: "25%",
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "20px 28px", opacity: rightOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 8 }}>PANEL B</div>
            <div style={{ color: blue, fontSize: tSize * 0.45, lineHeight: 1.1, marginBottom: 10 }}>{rightLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.75, lineHeight: 1.4 }}>{rightDescription}</div>
          </div>
        </>
      ) : (
        /* Landscape: side-by-side panels */
        <>
          {/* Left panel (Shortened height via bottom constraint) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: pad, right: "51%", bottom: botH + 120,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 36px", opacity: leftOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 12 }}>PANEL A</div>
            <div style={{ color: BLOOMBERG_COLORS.neg, fontSize: tSize * 0.5, lineHeight: 1.1, marginBottom: 14 }}>{leftLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.8, lineHeight: 1.5 }}>{leftDescription}</div>
          </div>

          {/* Divider */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: "50%", transform: "translateX(-50%)",
            width: 2, bottom: botH + 120, backgroundColor: amber, opacity: 0.3,
          }} />

          {/* Right panel (Shortened height) */}
          <div style={{
            position: "absolute", top: panelTopOffset, left: "51%", right: pad, bottom: botH + 120,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 36px", opacity: rightOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 12 }}>PANEL B</div>
            <div style={{ color: blue, fontSize: tSize * 0.5, lineHeight: 1.1, marginBottom: 14 }}>{rightLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.8, lineHeight: 1.5 }}>{rightDescription}</div>
          </div>
        </>
      )}

      {/* Narration footer - moved up slightly to account for smaller boxes */}
      <div style={{
        position: "absolute", bottom: botH + 20, left: pad, right: pad,
        textAlign: "center",
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
          MBN TERMINAL  ·  COMPARISON
        </span>
      </div>
    </AbsoluteFill>
  );
};
