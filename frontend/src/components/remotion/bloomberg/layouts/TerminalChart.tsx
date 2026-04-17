import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergLayoutProps } from "../types";

export const TerminalChart: React.FC<BloombergLayoutProps> = ({
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

  const tSize = titleFontSize ?? (p ? 60 : 77);
  const dSize = descriptionFontSize ?? (p ? 28 : 36);
  const labelSize = dSize * 0.4;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Parse optional numeric items as closes; else procedural OHLC
  const parsed = items
    .map((s) => {
      const m = String(s).match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : NaN;
    })
    .filter((n) => Number.isFinite(n));

  const N = parsed.length >= 8 ? parsed.length : 72;
  const candles = parsed.length >= 8 ? candlesFromCloses(parsed) : generateCandles(N, 178);
  const closes = candles.map((k) => k.c);
  const highs = candles.map((k) => k.h);
  const lows = candles.map((k) => k.l);
  const pMax = Math.max(...highs);
  const pMin = Math.min(...lows);
  const pRange = pMax - pMin || 1;
  const last = closes[N - 1];
  const prev = closes[N - 2] ?? last;
  const dayChange = last - prev;
  const dayChangePct = prev !== 0 ? (dayChange / prev) * 100 : 0;

  // MAs
  const ma = (period: number) => closes.map((_, i) => {
    const s = Math.max(0, i - period + 1);
    const slice = closes.slice(s, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const ma20 = ma(Math.min(20, Math.max(3, Math.floor(N / 4))));
  const ma50 = ma(Math.min(50, Math.max(5, Math.floor(N / 2))));

  // Bollinger Bands (20, 2σ)
  const bbU: number[] = []; const bbL: number[] = [];
  for (let i = 0; i < N; i++) {
    const s = Math.max(0, i - 19);
    const slice = closes.slice(s, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / slice.length;
    const v = slice.reduce((a, b) => a + (b - m) ** 2, 0) / slice.length;
    const sd = Math.sqrt(v);
    bbU.push(m + 2 * sd);
    bbL.push(m - 2 * sd);
  }

  // Fib levels
  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const fibVal = (r: number) => pMax - (pMax - pMin) * r;

  // Event markers
  const events = [Math.floor(N * 0.2), Math.floor(N * 0.36), Math.floor(N * 0.42), Math.floor(N * 0.72)];

  // RSI
  const rsi: number[] = [];
  let avgG = 0, avgL = 0;
  for (let i = 1; i < N; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(0, d); const l = Math.max(0, -d);
    if (i <= 14) { avgG += g / 14; avgL += l / 14; }
    else { avgG = (avgG * 13 + g) / 14; avgL = (avgL * 13 + l) / 14; }
    const rs = avgL === 0 ? 100 : avgG / avgL;
    rsi.push(100 - 100 / (1 + rs));
  }

  const reveal = interpolate(frame, [0, 60], [0.15, 1], { extrapolateRight: "clamp" });
  const visN = Math.max(4, Math.floor(N * reveal));

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 28 : 48;

  // SVG viewBox — portrait gives price panel far more vertical room
  const VB_W = 1000;
  const VB_H = p ? 1400 : 600;
  const priceH = p ? 1020 : 420;
  const rsiTop = p ? 1050 : 435;
  const rsiBot = p ? 1170 : 495;
  const volTop = p ? 1200 : 505;
  const volBot = p ? 1380 : 595;
  const divider1Y = p ? 1035 : 430;
  const divider2Y = p ? 1185 : 500;
  const priceAxisW = p ? 78 : 54;
  const chartW = VB_W - priceAxisW;
  const axisFont = p ? 18 : 10;
  const subLabelFont = p ? 16 : 9;
  const fibFont = p ? 16 : 10;
  const pillFont = p ? 20 : 11;
  const pillH = p ? 32 : 18;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,
        opacity: fadeIn,
      }}>
        <span style={{ color: blue, fontSize: labelSize * 1.2, letterSpacing: 3 }}>MBN:GRPH</span>
        <span style={{ color: amber, fontSize: tSize * 0.28 }}>{title}</span>
      </div>

      {/* Legend + headline */}
      <div style={{
        position: "absolute", top: topH + 6, left: pad, right: pad,
        display: "flex", alignItems: "center", gap: p ? 14 : 16,
        opacity: titleOp, flexWrap: "wrap", rowGap: p ? 6 : 4,
      }}>
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>— MA20</span>
        <span style={{ color: blue, fontSize: labelSize, letterSpacing: 2 }}>— MA50</span>
        <span style={{ color: BLOOMBERG_COLORS.muted, fontSize: labelSize, letterSpacing: 2 }}>— BB±2σ</span>
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2, opacity: 0.8 }}>— FIB</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: amber, fontSize: dSize * 0.72, letterSpacing: 1 }}>
          {last.toFixed(2)}
        </span>
        <span style={{
          color: dayChange >= 0 ? pos : neg,
          fontSize: labelSize * 1.1, letterSpacing: 1,
        }}>
          {dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)} ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%)
        </span>
      </div>

      {/* Chart SVG area */}
      <div style={{
        position: "absolute",
        top: topH + 44,
        left: pad,
        right: pad,
        bottom: botH + 44,
        border: `1px solid ${BLOOMBERG_COLORS.border}`,
        backgroundColor: BLOOMBERG_COLORS.panelBg,
        opacity: fadeIn,
      }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
             style={{ display: "block" }}>
          {/* price gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={`g${i}`} x1="0" x2={chartW}
                  y1={t * priceH} y2={t * priceH}
                  stroke={`${amber}18`} strokeWidth="1" strokeDasharray="2 4" />
          ))}

          {/* Fib lines */}
          {fibLevels.map((f, i) => {
            const y = ((pMax - fibVal(f)) / pRange) * priceH;
            return (
              <g key={`fib${i}`}>
                <line x1="0" x2={chartW} y1={y} y2={y}
                      stroke={amber} strokeWidth="1" strokeDasharray="5 5" opacity="0.3" />
                <text x={chartW - 6} y={y - 4} fill={amber}
                      fontSize={fibFont} textAnchor="end" opacity="0.8">
                  {(f * 100).toFixed(1)}%
                </text>
              </g>
            );
          })}

          {/* Event vertical markers */}
          {events.filter((e) => e < visN).map((e, i) => {
            const x = (e / (N - 1)) * chartW;
            return (
              <line key={`ev${i}`} x1={x} x2={x} y1="0" y2={priceH + 12}
                    stroke={amber} strokeWidth="1.2" opacity="0.55" />
            );
          })}

          {/* BB band fill */}
          <path
            d={bandPath(bbU, bbL, visN, N, pMin, pRange, priceH, chartW)}
            fill={amber} opacity="0.08"
          />
          <polyline points={linePts(bbU, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={`${amber}88`} strokeWidth="1" />
          <polyline points={linePts(bbL, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={`${amber}88`} strokeWidth="1" />

          {/* Candles */}
          {candles.slice(0, visN).map((k, i) => {
            const x = (i / (N - 1)) * chartW;
            const w = Math.max(3, chartW / N * 0.65);
            const yH = ((pMax - k.h) / pRange) * priceH;
            const yL = ((pMax - k.l) / pRange) * priceH;
            const yO = ((pMax - k.o) / pRange) * priceH;
            const yC = ((pMax - k.c) / pRange) * priceH;
            const up = k.c >= k.o;
            const color = up ? blue : neg;
            const top = Math.min(yO, yC);
            const h = Math.max(1.5, Math.abs(yC - yO));
            return (
              <g key={`c${i}`}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="1" />
                <rect x={x - w / 2} y={top} width={w} height={h} fill={color} />
              </g>
            );
          })}

          {/* MA20 / MA50 */}
          <polyline points={linePts(ma20, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={amber} strokeWidth={p ? 2.4 : 1.6} />
          <polyline points={linePts(ma50, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={blue} strokeWidth={p ? 2.4 : 1.6} />

          {/* Current price pill */}
          {(() => {
            const y = ((pMax - last) / pRange) * priceH;
            return (
              <g>
                <line x1="0" x2={chartW} y1={y} y2={y}
                      stroke={amber} strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
                <rect x={chartW + 2} y={y - pillH / 2} width={priceAxisW - 4} height={pillH} fill={amber} />
                <text x={chartW + priceAxisW / 2} y={y + pillFont / 3} fill={BLOOMBERG_COLORS.bg}
                      fontSize={pillFont} textAnchor="middle" fontWeight="700">
                  {last.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* Price axis labels */}
          {[pMax, pMax - pRange * 0.25, pMax - pRange * 0.5, pMax - pRange * 0.75, pMin].map((v, i) => (
            <text key={`ax${i}`}
                  x={chartW + 6}
                  y={i * (priceH / 4) + axisFont + 2}
                  fill={BLOOMBERG_COLORS.muted} fontSize={axisFont}>
              {v.toFixed(2)}
            </text>
          ))}

          {/* divider */}
          <line x1="0" x2={VB_W} y1={divider1Y} y2={divider1Y} stroke={BLOOMBERG_COLORS.border} strokeWidth="1" />

          {/* RSI subpanel */}
          <text x="6" y={rsiTop + subLabelFont + 2} fill={BLOOMBERG_COLORS.muted} fontSize={subLabelFont} letterSpacing="1">RSI(14)</text>
          <line x1="0" x2={chartW} y1={rsiTop + (rsiBot - rsiTop) * 0.2} y2={rsiTop + (rsiBot - rsiTop) * 0.2}
                stroke={`${amber}18`} strokeWidth="1" strokeDasharray="2 4" />
          <line x1="0" x2={chartW} y1={rsiTop + (rsiBot - rsiTop) * 0.8} y2={rsiTop + (rsiBot - rsiTop) * 0.8}
                stroke={`${amber}18`} strokeWidth="1" strokeDasharray="2 4" />
          <polyline
            points={rsi.slice(0, Math.max(1, visN - 1)).map((r, i) => {
              const x = ((i + 1) / (N - 1)) * chartW;
              const y = rsiBot - ((r - 20) / 60) * (rsiBot - rsiTop);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ")}
            fill="none" stroke={amber} strokeWidth={p ? 2 : 1.4}
          />
          <text x={chartW + 6} y={rsiTop + (rsiBot - rsiTop) * 0.2 + 4} fill={BLOOMBERG_COLORS.muted} fontSize={subLabelFont}>70</text>
          <text x={chartW + 6} y={rsiTop + (rsiBot - rsiTop) * 0.8 + 4} fill={BLOOMBERG_COLORS.muted} fontSize={subLabelFont}>30</text>

          {/* divider */}
          <line x1="0" x2={VB_W} y1={divider2Y} y2={divider2Y} stroke={BLOOMBERG_COLORS.border} strokeWidth="1" />

          {/* Volume */}
          <text x="6" y={volTop + subLabelFont + 2} fill={BLOOMBERG_COLORS.muted} fontSize={subLabelFont} letterSpacing="1">VOL</text>
          {candles.slice(0, visN).map((k, i) => {
            const x = (i / (N - 1)) * chartW;
            const w = Math.max(3, chartW / N * 0.65);
            const up = k.c >= k.o;
            const volMaxH = volBot - volTop - (p ? 24 : 10);
            const h = volMaxH * k.v;
            return (
              <rect key={`v${i}`} x={x - w / 2} y={volBot - h}
                    width={w} height={h}
                    fill={up ? blue : neg} opacity="0.85" />
            );
          })}
        </svg>
      </div>

      {/* Narration footer */}
      <div style={{
        position: "absolute", bottom: botH + 8, left: pad, right: pad,
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
          MBN TERMINAL  ·  CHART ANALYSIS
        </span>
      </div>
    </AbsoluteFill>
  );
};

// -------- helpers --------

type Candle = { o: number; h: number; l: number; c: number; v: number };

const generateCandles = (N: number, base: number): Candle[] => {
  const out: Candle[] = [];
  let price = base;
  for (let i = 0; i < N; i++) {
    const trend = Math.sin(i * 0.09) * 0.9 + Math.sin(i * 0.19) * 0.4;
    const vol = 1.3 + Math.abs(Math.sin(i * 0.31)) * 1.8;
    const o = price;
    const c = o + trend + Math.sin(i * 1.7 + 0.3) * vol;
    const h = Math.max(o, c) + Math.abs(Math.sin(i * 0.83)) * vol * 0.9;
    const l = Math.min(o, c) - Math.abs(Math.cos(i * 0.77)) * vol * 0.9;
    const v = 0.28 + Math.abs(Math.sin(i * 0.51 + 1.2)) * 0.72;
    out.push({ o, h, l, c, v });
    price = c;
  }
  return out;
};

const candlesFromCloses = (closes: number[]): Candle[] =>
  closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    const hi = Math.max(o, c);
    const lo = Math.min(o, c);
    const wiggle = Math.abs(c - o) * 0.6 + 0.4;
    return {
      o, c,
      h: hi + wiggle,
      l: lo - wiggle,
      v: 0.3 + Math.abs(Math.sin(i * 0.51)) * 0.7,
    };
  });

const linePts = (arr: number[], visN: number, N: number, pMin: number, pRange: number, h: number, w: number) => {
  const pMax = pMin + pRange;
  return arr.slice(0, visN).map((v, i) => {
    const x = (i / (N - 1)) * w;
    const y = ((pMax - v) / pRange) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
};

const bandPath = (upper: number[], lower: number[], visN: number, N: number, pMin: number, pRange: number, h: number, w: number) => {
  const pMax = pMin + pRange;
  const up = upper.slice(0, visN).map((v, i) => {
    const x = (i / (N - 1)) * w;
    const y = ((pMax - v) / pRange) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lo = lower.slice(0, visN).map((v, i) => {
    const x = (i / (N - 1)) * w;
    const y = ((pMax - v) / pRange) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).reverse();
  if (up.length === 0) return "";
  return `M${up.join(" L")} L${lo.join(" L")} Z`;
};
