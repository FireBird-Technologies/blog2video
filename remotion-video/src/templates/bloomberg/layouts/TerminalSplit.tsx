import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

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

  const tSize = titleFontSize ?? (p ? 72 : 107);
  const dSize = descriptionFontSize ?? (p ? 30 : 33);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const leftOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const rightOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

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
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:COMP</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {p ? (
        /* Portrait: stacked panels */
        <>
          {/* Title */}
          <div style={{
            position: "absolute", top: topH + 14, left: pad, right: pad,
            color: amber, fontSize: tSize * 0.5,
            opacity: headerOpacity, letterSpacing: -0.5,
          }}>
            {title}
          </div>

          {/* Left panel (top in portrait) */}
          <div style={{
            position: "absolute", top: topH + 80, left: pad, right: pad, height: "32%",
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 28px", opacity: leftOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 14 }}>PANEL A</div>
            <div style={{ color: BLOOMBERG_COLORS.neg, fontSize: tSize * 0.55, lineHeight: 1.1, marginBottom: 16 }}>{leftLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.8, lineHeight: 1.6 }}>{leftDescription}</div>
          </div>

          {/* Right panel (bottom in portrait) */}
          <div style={{
            position: "absolute", top: "57%", left: pad, right: pad, bottom: botH + 52,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "24px 28px", opacity: rightOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 14 }}>PANEL B</div>
            <div style={{ color: blue, fontSize: tSize * 0.55, lineHeight: 1.1, marginBottom: 16 }}>{rightLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.8, lineHeight: 1.6 }}>{rightDescription}</div>
          </div>

          {/* Narration */}
          <div style={{
            position: "absolute", bottom: botH + 8, left: pad, right: pad,
            color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
            opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {narration}
          </div>
        </>
      ) : (
        /* Landscape: side-by-side panels */
        <>
          {/* Left panel */}
          <div style={{
            position: "absolute", top: topH + 20, left: pad, right: "51%", bottom: botH + 46,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${BLOOMBERG_COLORS.neg}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "32px 36px", opacity: leftOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 20 }}>PANEL A</div>
            <div style={{ color: BLOOMBERG_COLORS.neg, fontSize: tSize * 0.6, lineHeight: 1.1, marginBottom: 24 }}>{leftLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.85, lineHeight: 1.6 }}>{leftDescription}</div>
          </div>

          {/* Divider */}
          <div style={{
            position: "absolute", top: topH + 20, left: "50%", transform: "translateX(-50%)",
            width: 2, bottom: botH + 46, backgroundColor: amber, opacity: 0.3,
          }} />

          {/* Right panel */}
          <div style={{
            position: "absolute", top: topH + 20, left: "51%", right: pad, bottom: botH + 46,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderTop: `2px solid ${blue}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "32px 36px", opacity: rightOpacity,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4, marginBottom: 20 }}>PANEL B</div>
            <div style={{ color: blue, fontSize: tSize * 0.6, lineHeight: 1.1, marginBottom: 24 }}>{rightLabel}</div>
            <div style={{ color: amber, fontSize: dSize * 0.85, lineHeight: 1.6 }}>{rightDescription}</div>
          </div>

          {/* Narration footer */}
          <div style={{
            position: "absolute", bottom: botH + 8, left: pad, right: pad,
            color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
            opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {narration}
          </div>
        </>
      )}

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
