import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalNarrative: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const tSize = titleFontSize ?? (p ? 87 : 64);
  const dSize = descriptionFontSize ?? (p ? 41 : 30);
  const labelSize = dSize * 0.4;
  const eyebrowSize = dSize * 0.38;

  const eyebrowOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOp   = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const titleSlide = interpolate(frame, [8, 28], [24, 0], { extrapolateRight: "clamp" });
  const bodyOp    = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const bodySlide = interpolate(frame, [20, 40], [16, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: p ? 56 : 48,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`, gap: 24,
        opacity: eyebrowOp,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:NARR</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>NARRATIVE</span>
      </div>

      {/* Content — portrait: stacked; landscape: left panel + right accent */}
      {p ? (
        /* Portrait: full-width stacked column */
        <div style={{
          position: "absolute",
          top: 76, left: 40, right: 40, bottom: 54,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 32,
        }}>
          <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 4, opacity: eyebrowOp }}>
            MBN:NARR  ·  DESK NOTE
          </div>
          <div style={{ color: amber, fontSize: tSize, lineHeight: 1.15, opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
            {title}
          </div>
          <div style={{ height: 2, width: "40%", backgroundColor: amber, opacity: titleOp }} />
          <div style={{
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderLeft: `3px solid ${amber}`,
            padding: "28px 32px",
            opacity: bodyOp, transform: `translateY(${bodySlide}px)`,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 3, marginBottom: 14 }}>DESK NOTE</div>
            <div style={{ color: amber, fontSize: dSize, lineHeight: 1.65 }}>{narration}</div>
          </div>
        </div>
      ) : (
        /* Landscape: left text, right accent column */
        <>
          <div style={{
            position: "absolute", top: 68, left: 48, right: "36%", bottom: 46,
            display: "flex", flexDirection: "column", justifyContent: "center", gap: 28,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 4, opacity: eyebrowOp }}>
              MBN:NARR  ·  DESK NOTE
            </div>
            <div style={{ color: amber, fontSize: tSize, lineHeight: 1.1, opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
              {title}
            </div>
            <div style={{ height: 1, width: "35%", backgroundColor: amber, opacity: titleOp }} />
            <div style={{
              backgroundColor: BLOOMBERG_COLORS.panelBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderLeft: `3px solid ${amber}`,
              padding: "22px 26px",
              opacity: bodyOp, transform: `translateY(${bodySlide}px)`,
            }}>
              <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 3, marginBottom: 12 }}>DESK NOTE</div>
              <div style={{ color: amber, fontSize: dSize, lineHeight: 1.6 }}>{narration}</div>
            </div>
          </div>
          {/* Right accent */}
          <div style={{
            position: "absolute", top: 68, right: 0, width: "34%", bottom: 46,
            borderLeft: `1px solid ${BLOOMBERG_COLORS.border}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            opacity: bodyOp,
          }}>
            <div style={{ color: BLOOMBERG_COLORS.border, fontSize: tSize * 0.9, letterSpacing: -4 }}>▌</div>
            <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 4, marginTop: 16 }}>MBN TERMINAL</div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: p ? 44 : 36,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  LIVE SESSION
        </span>
      </div>
    </AbsoluteFill>
  );
};
