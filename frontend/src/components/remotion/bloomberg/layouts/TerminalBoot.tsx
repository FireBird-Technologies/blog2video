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
  const logSize = dSize * 0.72;
  const labelSize = dSize * 0.4;

  const panelOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const bootLines = items.length > 0 ? items : [
    "LOADING EQUITY DATABASE",
    "LOADING FIXED INCOME",
    "LOADING FX / DERIVATIVES",
    "LOADING REAL-TIME FEEDS",
    "LOADING TECHNICAL INDICATORS",
    "CALIBRATING CHARTS",
  ];

  // Blinking cursor
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  // Pulsing top-bar status LED
  const ledPulse = 0.45 + 0.55 * Math.abs(Math.sin(frame / 8));
  // Tick-tick animation for the "connecting" dots
  const tickDots = (frame % 45) < 15 ? "." : (frame % 45) < 30 ? ".." : "...";
  // Scanline offset (slow vertical sweep)
  const scanY = (frame * 2) % 100;

  // Timestamp readout (fake, but moves slowly)
  const mm = String(14 + Math.floor(frame / 60) % 46).padStart(2, "0");
  const ss = String(Math.floor(frame / 1) % 60).padStart(2, "0");

  const topH = p ? 64 : 56;
  const botH = p ? 48 : 40;
  const pad = p ? 40 : 56;

  const barPx = p ? 18 : 14; // dot size in progress bars
  const totalBars = 20;
  const perLineDuration = 14; // frames per boot line to "boot"
  const lineStagger = 10;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Subtle horizontal scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,179,64,0.035) 0px, rgba(255,179,64,0.035) 1px, transparent 1px, transparent 3px)",
        pointerEvents: "none",
      }} />
      {/* Moving scan sweep */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${scanY}%`, height: 120,
        background: `linear-gradient(to bottom, transparent, ${amber}11 50%, transparent)`,
        pointerEvents: "none",
      }} />

      {/* Corner brackets */}
      <CornerBrackets color={amber} pad={pad / 2} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `1px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
      }}>
        {/* MBN mark */}
        <MbnMark color={amber} blue={blue} size={p ? 32 : 28} />
        <span style={{ color: blue, fontSize: labelSize * 1.25, letterSpacing: 3 }}>MBN TERMINAL</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>BOOT SEQUENCE</span>
        <div style={{ flex: 1 }} />
        <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: 5,
          backgroundColor: amber, opacity: ledPulse,
          boxShadow: `0 0 ${8 * ledPulse}px ${amber}`,
        }} />
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>LIVE</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>SESSION {mm}:{ss}</span>
      </div>

      {/* Boot panel */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: p ? "88%" : "64%",
        opacity: panelOpacity,
      }}>
        {/* Title */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
          color: amber, fontSize: tSize * 0.56,
          letterSpacing: 2, marginBottom: 22,
        }}>
          <TerminalGlyph color={amber} size={tSize * 0.5} />
          <span>{title}</span>
        </div>

        {/* Connecting line with ticking dots */}
        <div style={{
          color: blue, fontSize: logSize * 0.85, letterSpacing: 3,
          textAlign: "left", paddingLeft: p ? 28 : 24, marginBottom: 8,
          opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          CONNECTING TO MARKET DATA FEED{tickDots}
        </div>

        {/* Panel header */}
        <div style={{
          backgroundColor: BLOOMBERG_COLORS.headerBg,
          border: `1px solid ${BLOOMBERG_COLORS.border}`,
          borderBottom: `2px solid ${amber}`,
          padding: `${p ? 14 : 12}px ${p ? 28 : 24}px`,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: 4,
            backgroundColor: amber, opacity: ledPulse,
          }} />
          <span style={{ color: amber, fontSize: labelSize, letterSpacing: 4, flex: 1 }}>
            SYSTEM BOOT · AUTHENTICATING
          </span>
          <AuthBar frame={frame} color={amber} width={p ? 140 : 180} />
          <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>
            {Math.min(100, Math.floor(interpolate(frame, [0, 40], [0, 100], { extrapolateRight: "clamp" })))}%
          </span>
        </div>

        {/* Boot log */}
        <div style={{
          backgroundColor: BLOOMBERG_COLORS.panelBg,
          border: `1px solid ${BLOOMBERG_COLORS.border}`,
          borderTop: "none",
          padding: `${p ? 26 : 22}px ${p ? 28 : 24}px ${p ? 30 : 26}px`,
        }}>
          {bootLines.map((line, i) => {
            const start = 12 + i * lineStagger;
            const prog = interpolate(frame, [start, start + perLineDuration], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            const lineOpacity = interpolate(frame, [start - 4, start + 4], [0, 1], { extrapolateRight: "clamp" });
            const done = prog >= 1;
            const filled = Math.round(prog * totalBars);
            const isPrompt = line.startsWith("MBN>");
            // Tick flash on completion
            const justDone = frame >= start + perLineDuration && frame < start + perLineDuration + 6;

            return (
              <div key={i} style={{
                opacity: lineOpacity,
                display: "flex", alignItems: "center", gap: 14,
                color: isPrompt ? amber : done ? amber : BLOOMBERG_COLORS.muted,
                fontSize: logSize,
                lineHeight: 1.9,
                letterSpacing: 1,
                backgroundColor: justDone ? `${amber}15` : "transparent",
                padding: justDone ? "2px 6px" : "2px 6px",
                margin: "0 -6px",
                transition: "background-color 0.2s",
              }}>
                <span style={{ flex: "0 0 auto", minWidth: p ? 340 : 360 }}>
                  {isPrompt ? line : `${line.toUpperCase()}`}
                </span>
                {!isPrompt && (
                  <div style={{
                    display: "flex", gap: 2, flex: "0 0 auto",
                  }}>
                    {Array.from({ length: totalBars }).map((_, j) => (
                      <span key={j} style={{
                        display: "inline-block",
                        width: barPx * 0.45, height: barPx,
                        backgroundColor: j < filled ? amber : `${amber}22`,
                      }} />
                    ))}
                  </div>
                )}
                {!isPrompt && (
                  <span style={{
                    flex: 1, textAlign: "right",
                    color: done ? amber : BLOOMBERG_COLORS.muted,
                    letterSpacing: 2,
                  }}>
                    {done ? "OK" : `${Math.floor(prog * 100)}%`}
                  </span>
                )}
              </div>
            );
          })}

          {/* Blinking prompt cursor */}
          <div style={{
            marginTop: p ? 16 : 12,
            color: amber, fontSize: logSize, letterSpacing: 1,
            opacity: interpolate(frame, [bootLines.length * lineStagger + 14, bootLines.length * lineStagger + 24], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            ALL SYSTEMS NOMINAL.{" "}
            <span style={{
              display: "inline-block", width: logSize * 0.55, height: logSize * 0.9,
              backgroundColor: cursorOn ? amber : "transparent",
              verticalAlign: "text-bottom",
              marginLeft: 4,
            }} />
          </div>
        </div>

        {/* Narration */}
        <div style={{
          color: BLOOMBERG_COLORS.muted,
          fontSize: dSize * 0.65,
          marginTop: 22,
          letterSpacing: 1,
          textAlign: "center",
          opacity: interpolate(frame, [bootLines.length * lineStagger + 20, bootLines.length * lineStagger + 35], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {narration}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderTop: `1px solid ${BLOOMBERG_COLORS.border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  LIVE SESSION
        </span>
        <div style={{ flex: 1 }} />
        <MiniStat label="CPU" value={42 + (frame % 8)} color={amber} size={labelSize} />
        <MiniStat label="MEM" value={61 + (frame % 5)} color={amber} size={labelSize} />
        <MiniStat label="NET" value={88 + (frame % 4)} color={blue} size={labelSize} />
      </div>
    </AbsoluteFill>
  );
};

// -------- helpers --------

const MbnMark: React.FC<{ color: string; blue: string; size: number }> = ({ color, blue, size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect x="1" y="1" width="30" height="30" stroke={color} strokeWidth="1.5" />
    <path d="M6 22 V10 L11 16 L16 10 V22" stroke={color} strokeWidth="2" fill="none" />
    <path d="M19 22 V10 H26 V22 H19" stroke={blue} strokeWidth="2" fill="none" />
    <circle cx="28" cy="4" r="2" fill={color} />
  </svg>
);

const TerminalGlyph: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 40 28" fill="none">
    <rect x="1" y="1" width="38" height="26" stroke={color} strokeWidth="1.5" />
    <path d="M6 10 L11 14 L6 18" stroke={color} strokeWidth="2" fill="none" strokeLinecap="square" />
    <line x1="15" y1="19" x2="26" y2="19" stroke={color} strokeWidth="2" />
  </svg>
);

const CornerBrackets: React.FC<{ color: string; pad: number }> = ({ color, pad }) => {
  const arm = 28;
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

const AuthBar: React.FC<{ frame: number; color: string; width: number }> = ({ frame, color, width }) => {
  const prog = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      width, height: 10,
      border: `1px solid ${color}`,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${prog * 100}%`,
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 8px)`,
      }} />
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: number; color: string; size: number }> = ({ label, value, color, size }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 8, color: BLOOMBERG_COLORS.muted, fontSize: size, letterSpacing: 2 }}>
    {label}
    <span style={{
      display: "inline-block", width: 60, height: 8,
      border: `1px solid ${color}`, position: "relative",
    }}>
      <span style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(100, value)}%`, backgroundColor: color,
      }} />
    </span>
    <span style={{ color, width: 32, textAlign: "right" }}>{value}%</span>
  </span>
);
