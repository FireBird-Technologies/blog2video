import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalBoot: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 99 : 101);
  const dSize = descriptionFontSize ?? (p ? 34 : 39);
  const logSize = dSize * 0.75;
  const labelSize = dSize * 0.4;

  const panelOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const bootLines = items.length > 0 ? items : [
    "[SYS] Initializing terminal session...",
    "[OK]  Market data feed connected.",
    "[OK]  Loading session parameters...",
    "[OK]  Authentication successful.",
    `MBN>  ${title || "Bloomberg Terminal"}_`,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: p ? 56 : 48,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `1px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`, gap: 24,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN TERMINAL</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>BOOT SEQUENCE</span>
      </div>

      {/* Boot panel */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: p ? "86%" : "60%",
        opacity: panelOpacity,
      }}>
        {/* Title */}
        <div style={{
          color: amber, fontSize: tSize * 0.55,
          letterSpacing: 2, marginBottom: 20,
          textAlign: "center",
        }}>
          {title}
        </div>

        {/* Panel header */}
        <div style={{
          backgroundColor: BLOOMBERG_COLORS.headerBg,
          border: `1px solid ${BLOOMBERG_COLORS.border}`,
          borderBottom: `2px solid ${amber}`,
          padding: `${p ? 14 : 12}px ${p ? 28 : 24}px`,
          marginBottom: 2,
        }}>
          <span style={{ color: amber, fontSize: labelSize, letterSpacing: 4 }}>
            ── SYSTEM BOOT ──────────────────────────────────────────
          </span>
        </div>

        {/* Boot log */}
        <div style={{
          backgroundColor: BLOOMBERG_COLORS.panelBg,
          border: `1px solid ${BLOOMBERG_COLORS.border}`,
          borderTop: "none",
          padding: `${p ? 28 : 24}px ${p ? 28 : 24}px ${p ? 36 : 32}px`,
        }}>
          {bootLines.map((line, i) => {
            const lineOpacity = interpolate(frame, [i * 8, i * 8 + 12], [0, 1], { extrapolateRight: "clamp" });
            const isPrompt = line.startsWith("MBN>");
            return (
              <div key={i} style={{
                opacity: lineOpacity,
                color: isPrompt ? amber : BLOOMBERG_COLORS.muted,
                fontSize: logSize,
                lineHeight: 1.9,
                letterSpacing: 0.5,
              }}>
                {line}
              </div>
            );
          })}
        </div>

        {/* Narration */}
        <div style={{
          color: BLOOMBERG_COLORS.muted,
          fontSize: dSize * 0.65,
          marginTop: 20,
          letterSpacing: 1,
          textAlign: "center",
          opacity: interpolate(frame, [bootLines.length * 8 + 10, bootLines.length * 8 + 25], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {narration}
        </div>
      </div>

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
