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

  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const livePulse = 0.4 + 0.6 * Math.abs(Math.sin(frame / 7));
  // Typewriter reveal for narration
  const narrChars = narration ? narration.length : 0;
  const typedLen = Math.floor(interpolate(frame, [24, 24 + Math.max(20, narrChars / 2)], [0, narrChars], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));
  const typedText = narration ? narration.slice(0, typedLen) : "";
  const typing = typedLen < narrChars;

  const topH = p ? 60 : 52;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;

  // Fake clock/session
  const mm = String(9 + Math.floor(frame / 120) % 7).padStart(2, "0");
  const ss = String(Math.floor(frame / 2) % 60).padStart(2, "0");

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,179,64,0.025) 0px, rgba(255,179,64,0.025) 1px, transparent 1px, transparent 3px)",
        pointerEvents: "none",
      }} />

      <CornerBrackets color={amber} pad={pad / 2.4} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
        opacity: eyebrowOp,
      }}>
        <DocGlyph color={amber} size={p ? 30 : 26} />
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:NARR</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>NARRATIVE · DESK NOTE</span>
        <div style={{ flex: 1 }} />
        <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: 5,
          backgroundColor: amber, opacity: livePulse,
          boxShadow: `0 0 ${8 * livePulse}px ${amber}`,
        }} />
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>LIVE</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>{mm}:{ss} EST</span>
      </div>

      {/* Waveform strip pinned to top, below top bar */}
      <div style={{
        position: "absolute", top: topH, left: 0, right: 0,
        height: p ? 64 : 56,
        padding: `8px ${pad}px`,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`,
        opacity: eyebrowOp,
      }}>
        <Waveform color={amber} width={"100%" as any} height={p ? 48 : 40} frame={frame} seed={7} />
      </div>

      {/* Content */}
      {p ? (
        /* Portrait: stacked */
        <div style={{
          position: "absolute",
          top: topH + 64 + 20, left: pad, right: pad, bottom: botH + 12,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: eyebrowOp }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: 4,
              backgroundColor: amber, opacity: livePulse,
            }} />
            <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 4 }}>
              MBN:NARR  ·  DESK NOTE
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: BLOOMBERG_COLORS.border }} />
            <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 2 }}>
              REF #{String(1000 + (frame % 999)).padStart(4, "0")}
            </span>
          </div>
          <div style={{ color: amber, fontSize: tSize, lineHeight: 1.15, opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
            {title}
          </div>
          <div style={{
            height: 2, width: "40%",
            background: `linear-gradient(90deg, ${amber}, ${amber}00)`,
            opacity: titleOp,
          }} />
          <NarrativePanel
            amber={amber}
            eyebrowSize={eyebrowSize}
            dSize={dSize}
            padding="28px 32px"
            opacity={bodyOp}
            translateY={bodySlide}
            typedText={typedText}
            typing={typing}
            cursorOn={cursorOn}
            frame={frame}
            livePulse={livePulse}
          />
        </div>
      ) : (
        /* Landscape: full-width stacked — waveform bars above title */
        <div style={{
          position: "absolute", top: topH + 56 + 16, left: pad, right: pad, bottom: botH + 10,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 22,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: eyebrowOp }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: 4,
              backgroundColor: amber, opacity: livePulse,
            }} />
            <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 4 }}>
              MBN:NARR  ·  DESK NOTE
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: BLOOMBERG_COLORS.border }} />
            <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 2 }}>
              REF #{String(1000 + (frame % 999)).padStart(4, "0")}
            </span>
          </div>

          <div style={{ color: amber, fontSize: tSize, lineHeight: 1.1, opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
            {title}
          </div>
          <div style={{
            height: 1, width: "35%",
            background: `linear-gradient(90deg, ${amber}, ${amber}00)`,
            opacity: titleOp,
          }} />
          <NarrativePanel
            amber={amber}
            eyebrowSize={eyebrowSize}
            dSize={dSize}
            padding="22px 26px"
            opacity={bodyOp}
            translateY={bodySlide}
            typedText={typedText}
            typing={typing}
            cursorOn={cursorOn}
            frame={frame}
            livePulse={livePulse}
          />
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  NARRATIVE SESSION
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          display: "inline-block", width: 8, height: 8, borderRadius: 4,
          backgroundColor: amber, opacity: livePulse,
        }} />
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          TICKS {String(frame).padStart(5, "0")}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// -------- helpers --------

const NarrativePanel: React.FC<{
  amber: string; eyebrowSize: number; dSize: number;
  padding: string; opacity: number; translateY: number;
  typedText: string; typing: boolean; cursorOn: boolean;
  frame: number; livePulse: number;
}> = ({ amber, eyebrowSize, dSize, padding, opacity, translateY, typedText, typing, cursorOn, frame, livePulse }) => (
  <div style={{
    position: "relative",
    backgroundColor: BLOOMBERG_COLORS.panelBg,
    border: `1px solid ${BLOOMBERG_COLORS.border}`,
    borderLeft: `3px solid ${amber}`,
    padding,
    opacity, transform: `translateY(${translateY}px)`,
  }}>
    {/* top inner bar */}
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
    }}>
      <span style={{
        display: "inline-block", width: 6, height: 6, borderRadius: 3,
        backgroundColor: amber, opacity: livePulse,
      }} />
      <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 3 }}>
        DESK NOTE  ·  STREAM
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: BLOOMBERG_COLORS.border }} />
      <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: eyebrowSize, letterSpacing: 2 }}>
        {String(frame).padStart(5, "0")}
      </span>
    </div>
    <div style={{ color: amber, fontSize: dSize, lineHeight: 1.6, minHeight: dSize * 1.6 * 2 }}>
      <span style={{ color: amber, marginRight: 10 }}>{">"}</span>
      {typedText}
      <span style={{
        display: "inline-block", width: dSize * 0.55, height: dSize * 0.85,
        backgroundColor: (typing || cursorOn) ? amber : "transparent",
        verticalAlign: "text-bottom", marginLeft: 4,
      }} />
    </div>
  </div>
);

const DocGlyph: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size * 0.8} height={size} viewBox="0 0 24 30" fill="none">
    <path d="M2 1 H16 L22 7 V29 H2 Z" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M16 1 V7 H22" stroke={color} strokeWidth="1.5" fill="none" />
    <line x1="6" y1="13" x2="18" y2="13" stroke={color} strokeWidth="1.5" />
    <line x1="6" y1="18" x2="18" y2="18" stroke={color} strokeWidth="1.5" />
    <line x1="6" y1="23" x2="14" y2="23" stroke={color} strokeWidth="1.5" />
  </svg>
);

const CornerBrackets: React.FC<{ color: string; pad: number }> = ({ color, pad }) => {
  const arm = 24;
  const w = 2;
  const bracket = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", width: arm, height: arm, ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: arm, height: w, backgroundColor: color }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: w, height: arm, backgroundColor: color }} />
    </div>
  );
  return (
    <>
      {bracket({ top: pad, left: pad })}
      {bracket({ top: pad, right: pad, transform: "scaleX(-1)" })}
      {bracket({ bottom: pad, left: pad, transform: "scaleY(-1)" })}
      {bracket({ bottom: pad, right: pad, transform: "scale(-1,-1)" })}
    </>
  );
};

const Waveform: React.FC<{ color: string; width: number | string; height: number; frame: number; seed: number }> = ({
  color, height, frame, seed,
}) => {
  const N = 48;
  const bars: number[] = [];
  for (let i = 0; i < N; i++) {
    const v =
      0.35 +
      0.25 * Math.abs(Math.sin((i + seed) * 0.7 + frame / 9)) +
      0.2 * Math.abs(Math.sin((i + seed) * 1.9 + frame / 5));
    bars.push(Math.min(1, v));
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height }}>
      {bars.map((b, i) => (
        <span key={i} style={{
          flex: 1, height: `${b * 100}%`,
          backgroundColor: color, opacity: 0.45 + b * 0.55,
        }} />
      ))}
    </div>
  );
};

