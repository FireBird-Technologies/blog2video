import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";

export const TerminalQuote: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  quote,
  highlightWord,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;

  const tSize = titleFontSize ?? (p ? 72 : 97);
  const dSize = descriptionFontSize ?? (p ? 34 : 59);
  const labelSize = dSize * 0.38;

  const topLineOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });
  const quoteOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const displayQuote = quote || narration;

  const renderQuote = () => {
    if (!highlightWord || !displayQuote.includes(highlightWord)) {
      return <span style={{ color: amber }}>{displayQuote}</span>;
    }
    const parts = displayQuote.split(highlightWord);
    return (
      <>
        <span style={{ color: amber }}>{parts[0]}</span>
        <span style={{ color: blue }}>{highlightWord}</span>
        <span style={{ color: amber }}>{parts.slice(1).join(highlightWord)}</span>
      </>
    );
  };

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      <BackgroundGraph accentColor={blue} textColor={amber} variant="quote" />
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
        opacity: topLineOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:NOTE</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>DESK NOTE</span>
      </div>

      {/* MODIFIED: Centered Title (Larger & Slightly Lower) */}
      <div style={{
        position: "absolute", 
        top: topH + (p ? 30 : 25), // Adjusting top position to bring it lower
        left: 0, 
        right: 0,
        textAlign: "center", 
        color: amber, 
        fontSize: tSize * 0.55, // Increasing size from 0.45 to 0.55
        opacity: titleOpacity, 
        letterSpacing: -0.5,
        fontWeight: "bold",
        textTransform: "uppercase"
      }}>
        {title}
      </div>

      {/* MODIFIED: Top rule (Adjusted to accommodate lower title) */}
      <div style={{
        position: "absolute", 
        top: topH + (p ? 100 : 90), // Adjusting Top rule to remain below title
        left: pad, 
        right: pad, 
        height: 1,
        backgroundColor: BLOOMBERG_COLORS.border,
        opacity: topLineOpacity,
      }} />

      {/* Quote content */}
      <div style={{
        position: "absolute", top: "50%", left: pad, right: pad,
        transform: "translateY(-40%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        opacity: quoteOpacity,
        gap: p ? 24 : 32,
      }}>
        <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4 }}>
          ── ANALYST NOTE ──
        </div>
        <div style={{
          fontSize: tSize * 0.65,
          lineHeight: 1.4,
          textAlign: "center",
          maxWidth: "82%",
        }}>
          {renderQuote()}
        </div>
      </div>

      {/* Bottom rule */}
      <div style={{
        position: "absolute", bottom: botH + (p ? 52 : 46), left: pad, right: pad, height: 1,
        backgroundColor: BLOOMBERG_COLORS.border,
        opacity: topLineOpacity,
      }} />

      {/* Narration / sub */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
        color: BLOOMBERG_COLORS.muted, fontSize: dSize * 0.65,
        textAlign: "center",
        opacity: subOpacity,
      }}>
        {narration !== displayQuote ? narration : title}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  DESK NOTE
        </span>
      </div>
    </AbsoluteFill>
  );
};