import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalDashboard: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  metrics = [],
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const pos = blue;

  const tSize = titleFontSize ?? (p ? 103 : 144);
  const dSize = descriptionFontSize ?? (p ? 54 : 38);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });

  const tiles = metrics.length > 0 ? metrics : [
    { value: "S&P 500", label: "INDEX", suffix: "+0.84%" },
    { value: "NASDAQ", label: "INDEX", suffix: "+1.12%" },
    { value: "DXY", label: "DOLLAR", suffix: "-0.22%" },
    { value: "10Y", label: "YIELD", suffix: "4.31%" },
  ];

  const topH = p ? 60 : 48;
  const botH = p ? 48 : 36;
  const pad = p ? 40 : 48;

  const livePulse = 0.4 + 0.6 * Math.abs(Math.sin(frame / 7));
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

      {p && <CornerBrackets color={amber} pad={pad / 2.4} />}

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 16,
        opacity: headerOpacity,
      }}>
        {p && <IndexGlyph color={amber} size={30} />}
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:MRKT</span>
        {!p && <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>}
        {p && <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>MARKET OVERVIEW</span>}
        <div style={{ flex: 1 }} />
        <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: 5,
          backgroundColor: amber, opacity: livePulse,
          boxShadow: `0 0 ${8 * livePulse}px ${amber}`,
        }} />
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>LIVE</span>
        {p && <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize }}>{mm}:{ss} EST</span>}
      </div>

      {p ? (
        /* Portrait layout: richer header + vertical tiles */
        <>
          {/* Eyebrow + title (centered) */}
          <div style={{
            position: "absolute", top: topH + 20, left: pad, right: pad,
            display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
            opacity: titleOpacity,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", justifyContent: "center" }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: 4,
                backgroundColor: amber, opacity: livePulse,
              }} />
              <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 4 }}>
                MBN:MRKT · SNAPSHOT
              </span>
              <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
                · REF #{String(1000 + (frame % 999)).padStart(4, "0")}
              </span>
            </div>
            <div style={{ color: amber, fontSize: tSize * 0.62, lineHeight: 1.1, textAlign: "center" }}>
              {title}
            </div>
            <div style={{
              height: 2, width: "40%",
              background: `linear-gradient(90deg, ${amber}00, ${amber}, ${amber}00)`,
            }} />
          </div>

          {/* KPI list (centered) */}
          <div style={{
            position: "absolute",
            top: topH + 20 + tSize * 0.62 + 70,
            left: pad, right: pad,
            bottom: botH + 64,
            display: "flex", flexDirection: "column", gap: 14,
            alignItems: "center", justifyContent: "center",
          }}>
            {tiles.map((tile, i) => {
              const start = i * 8 + 12;
              const tileOpacity = interpolate(frame, [start, start + 16], [0, 1], { extrapolateRight: "clamp" });
              const tileSlide = interpolate(frame, [start, start + 16], [14, 0], { extrapolateRight: "clamp" });
              const suffix = tile.suffix || "";
              const isNeg = suffix.trim().startsWith("-");
              const isPos = suffix.trim().startsWith("+");
              const signColor = isNeg ? BLOOMBERG_COLORS.neg : isPos ? pos : amber;
              const changeMatch = suffix.match(/([+-]?\d+(?:\.\d+)?)/);
              const changeNum = changeMatch ? parseFloat(changeMatch[1]) : 0;
              const trend = isNeg ? -Math.max(0.3, Math.abs(changeNum))
                          : isPos ? Math.max(0.3, Math.abs(changeNum))
                          : 0.4;

              return (
                <div key={i} style={{
                  position: "relative",
                  width: "88%",
                  backgroundColor: BLOOMBERG_COLORS.panelBg,
                  border: `1px solid ${BLOOMBERG_COLORS.border}`,
                  borderLeft: `3px solid ${amber}`,
                  padding: "16px 24px",
                  opacity: tileOpacity,
                  transform: `translateY(${tileSlide}px)`,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  {/* Label column */}
                  <div style={{
                    flex: "0 0 auto", minWidth: 110,
                    display: "flex", flexDirection: "column", gap: 6,
                    textAlign: "center", alignItems: "center",
                  }}>
                    <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 3 }}>
                      {tile.label}
                    </div>
                    <div style={{ color: amber, fontSize: dSize * 1.1, lineHeight: 1 }}>
                      {tile.value}
                    </div>
                  </div>

                  {/* Sparkline — colored by sign */}
                  <Sparkline
                    color={signColor}
                    width={160} height={40}
                    seed={i * 3 + 1}
                    trend={trend}
                    frame={frame}
                  />

                  <div style={{ flex: 1 }} />

                  {/* Change value — colored by sign */}
                  <span style={{ color: signColor, fontSize: dSize * 0.95, letterSpacing: 1 }}>
                    {suffix}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Landscape: tile grid */
        <>
          <div style={{
            position: "absolute", top: topH + 12, left: pad, right: pad,
            color: amber, fontSize: tSize * 0.5, opacity: titleOpacity, letterSpacing: -0.5,
          }}>
            {title}
          </div>

          <div style={{
            position: "absolute",
            top: topH + 70, left: pad, right: pad,
            bottom: botH + 46,
            display: "flex", flexWrap: "wrap", gap: 16,
            alignContent: "center", justifyContent: "center",
          }}>
            {tiles.map((tile, i) => {
              const tileOpacity = interpolate(frame, [i * 8 + 10, i * 8 + 26], [0, 1], { extrapolateRight: "clamp" });
              const isNeg = (tile.suffix || "").startsWith("-");
              const suffixColor = isNeg ? BLOOMBERG_COLORS.neg : pos;
              const tileW = tiles.length <= 3 ? "30%" : "46%";
              return (
                <div key={i} style={{
                  width: tileW, minHeight: 170,
                  backgroundColor: BLOOMBERG_COLORS.panelBg,
                  border: `1px solid ${BLOOMBERG_COLORS.border}`,
                  borderTop: `2px solid ${amber}`,
                  padding: "20px 24px",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  opacity: tileOpacity,
                }}>
                  <div style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 3 }}>
                    {tile.label}
                  </div>
                  <div style={{ color: amber, fontSize: tSize * 0.65, lineHeight: 1 }}>
                    {tile.value}
                  </div>
                  <div style={{ color: suffixColor, fontSize: dSize * 0.85, letterSpacing: 1 }}>
                    {tile.suffix}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + (p ? 14 : 8), left: pad, right: pad,
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
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 18,
      }}>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
          MBN TERMINAL  ·  MARKET OVERVIEW
        </span>
        {p && (
          <>
            <div style={{ flex: 1 }} />
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: 4,
              backgroundColor: amber, opacity: livePulse,
            }} />
            <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>
              TICKS {String(frame).padStart(5, "0")}
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

// -------- helpers --------

const IndexGlyph: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect x="1" y="1" width="30" height="30" stroke={color} strokeWidth="1.5" />
    <polyline points="4,24 10,18 16,22 22,10 28,14" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="28" cy="14" r="2" fill={color} />
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

const Sparkline: React.FC<{
  color: string; width: number; height: number; seed: number; trend: number; frame: number;
}> = ({ color, width, height, seed, trend, frame }) => {
  const N = 24;
  const pts: number[] = [];
  for (let i = 0; i < N; i++) {
    const noise = Math.sin((i + seed) * 1.37) * 0.4 + Math.sin((i + seed) * 0.61) * 0.25;
    const slope = (trend / 6) * (i / N);
    pts.push(noise + slope);
  }
  const minV = Math.min(...pts);
  const maxV = Math.max(...pts);
  const range = maxV - minV || 1;
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
