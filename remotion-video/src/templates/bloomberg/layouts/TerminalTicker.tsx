import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalTicker: React.FC<BloombergLayoutProps> = ({
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
  const pos = blue;
  const neg = BLOOMBERG_COLORS.neg;

  const tSize = titleFontSize ?? (p ? 64 : 97);
  const dSize = descriptionFontSize ?? (p ? 28 : 32);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const rows = items.length > 0 ? items : [
    "AAPL  +2.14%  $189.40",
    "NVDA  +4.88%  $847.20",
    "MSFT  +1.32%  $415.60",
    "TSLA  -1.74%  $172.30",
    "AMZN  +0.96%  $189.10",
  ];

  const topH = p ? 56 : 48;
  const marqueeH = p ? 36 : 32;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;
  const colH = p ? 40 : 36;

  // Pulsing LIVE dot
  const livePulse = 0.35 + 0.65 * Math.abs(Math.sin(frame / 6));
  // tick-tick-tick ellipsis between rows
  const tickDot = (frame % 30) < 15;

  // Marquee content built from rows (so it references the data)
  const marqueeText = rows.concat(rows).map((r) => r.replace(/\s+/g, "  ")).join("   ·   ");
  const marqueeOffset = ((frame * 4) % 2000);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Subtle scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,179,64,0.025) 0px, rgba(255,179,64,0.025) 1px, transparent 1px, transparent 3px)",
        pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
        opacity: headerOpacity,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:SCRN</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: 5,
          backgroundColor: pos, opacity: livePulse,
          boxShadow: `0 0 ${8 * livePulse}px ${pos}`,
        }} />
        <span style={{ color: pos, fontSize: labelSize, letterSpacing: 3 }}>LIVE</span>
      </div>

      {/* Scrolling marquee ticker tape */}
      <div style={{
        position: "absolute", top: topH, left: 0, right: 0, height: marqueeH,
        backgroundColor: "#0A0800",
        borderBottom: `1px solid ${BLOOMBERG_COLORS.border}`,
        overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>
        <div style={{
          whiteSpace: "nowrap",
          color: amber,
          fontSize: marqueeH * 0.55,
          letterSpacing: 2,
          transform: `translateX(${-marqueeOffset}px)`,
        }}>
          {marqueeText}   ·   {marqueeText}
        </div>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: topH + marqueeH + (p ? 14 : 10), left: pad, right: pad,
        color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
        display: "flex", alignItems: "center", gap: 14,
        justifyContent: p ? "center" : "flex-start",
      }}>
        <ChartGlyph color={amber} size={tSize * 0.5} />
        <span>{title}</span>
      </div>

      {/* Column headers */}
      <div style={{
        position: "absolute",
        top: topH + marqueeH + (p ? 76 : 66),
        left: p ? "6%" : "15%", right: p ? "6%" : "15%", height: colH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `1px solid ${amber}`,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
        opacity: headerOpacity,
        justifyContent: "center",
      }}>
        <span style={{
          display: "inline-block", width: 6, height: 6, borderRadius: 3,
          backgroundColor: tickDot ? amber : `${amber}55`,
        }} />
        <span style={{
          color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 3,
          flex: p ? "0 0 auto" : 1,
          textAlign: p ? "center" : "left",
        }}>
          SYMBOL  ·  CHANGE  ·  PRICE  ·  TREND
        </span>
      </div>

      {/* Ticker rows */}
      <div style={{
        position: "absolute",
        top: topH + marqueeH + (p ? 124 : 110),
        left: pad, right: pad,
        bottom: botH + (p ? 52 : 46),
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        {rows.map((row, i) => {
          const start = i * 7 + 8;
          const rowOpacity = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: "clamp" });
          const isNeg = row.includes("-");
          const rowBg = i % 2 === 0 ? BLOOMBERG_COLORS.panelBg : BLOOMBERG_COLORS.bg;

          // Tick-flash on entry: bright highlight that fades
          const flash = interpolate(frame, [start + 8, start + 20], [1, 0], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const flashBg = isNeg ? `${neg}33` : `${pos}33`;

          // Per-row heartbeat: subtle scale/pulse after appearance, on a slow cadence
          const beatPhase = (frame - start) / 18;
          const beat = Math.max(0, Math.sin(beatPhase) * 0.25);

          // Try to parse the change % for visuals; fallback to sign check
          const changeMatch = row.match(/([+-]?\d+(?:\.\d+)?)%/);
          const change = changeMatch ? parseFloat(changeMatch[1]) : (isNeg ? -1 : 1);

          return (
            <div key={i} style={{
              position: "relative",
              width: p ? "88%" : "70%",
              alignSelf: "center",
              backgroundColor: rowBg,
              border: `1px solid ${BLOOMBERG_COLORS.border}`,
              borderTop: "none",
              padding: p ? "14px 20px" : "12px 20px",
              opacity: rowOpacity,
              display: "flex", alignItems: "center", gap: 16,
              justifyContent: "center",
            }}>
              {/* Flash overlay */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundColor: flashBg, opacity: flash,
                pointerEvents: "none",
              }} />

              {/* Left-edge live pulse */}
              <span style={{
                display: "inline-block", width: 4,
                height: p ? 26 : 22,
                backgroundColor: isNeg ? neg : pos,
                opacity: 0.55 + beat,
                marginRight: 4, flex: "0 0 auto",
              }} />

              {/* Arrow */}
              <Arrow up={!isNeg} color={isNeg ? neg : pos} size={dSize * 0.9} />

              {/* Row text */}
              <span style={{
                color: isNeg ? neg : amber,
                fontSize: dSize * 0.9,
                letterSpacing: 1,
                flex: 1,
              }}>
                {row}
              </span>

              {/* Sparkline */}
              <Sparkline
                color={isNeg ? neg : pos}
                width={p ? 100 : 140}
                height={p ? 24 : 28}
                seed={i}
                trend={change}
                frame={frame}
              />
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
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  SCREENER
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

const Arrow: React.FC<{ up: boolean; color: string; size: number }> = ({ up, color, size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "0 0 auto" }}>
    {up ? (
      <polygon points="8,2 14,12 2,12" fill={color} />
    ) : (
      <polygon points="8,14 14,4 2,4" fill={color} />
    )}
  </svg>
);

const ChartGlyph: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size * 1.2} height={size} viewBox="0 0 48 40" fill="none">
    <rect x="1" y="1" width="46" height="38" stroke={color} strokeWidth="1.5" />
    <polyline points="5,32 14,22 22,26 32,12 44,18" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="44" cy="18" r="2.5" fill={color} />
  </svg>
);

const Sparkline: React.FC<{
  color: string; width: number; height: number; seed: number; trend: number; frame: number;
}> = ({ color, width, height, seed, trend, frame }) => {
  const N = 24;
  // Deterministic pseudo-random points influenced by trend and animated subtly
  const pts: number[] = [];
  for (let i = 0; i < N; i++) {
    const noise = Math.sin((i + seed) * 1.37) * 0.4 + Math.sin((i + seed) * 0.61) * 0.25;
    const slope = (trend / 6) * (i / N);
    pts.push(noise + slope);
  }
  const minV = Math.min(...pts);
  const maxV = Math.max(...pts);
  const range = maxV - minV || 1;
  // Animated reveal
  const reveal = interpolate(frame, [0, 30], [0.15, 1], { extrapolateRight: "clamp" });
  const visibleN = Math.max(2, Math.floor(N * reveal));
  const coords = pts.slice(0, visibleN).map((v, i) => {
    const x = (i / (N - 1)) * width;
    const y = height - ((v - minV) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const lastY = height - ((pts[visibleN - 1] - minV) / range) * (height - 2) - 1;
  const lastX = ((visibleN - 1) / (N - 1)) * width;

  return (
    <svg width={width} height={height} style={{ flex: "0 0 auto" }}>
      <polyline points={coords} stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx={lastX} cy={lastY} r="2.2" fill={color} />
    </svg>
  );
};
