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
  ticker,
  ohlcvTable,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const neg = BLOOMBERG_COLORS.neg;
  const pos = "#7BE495";
  const muted = BLOOMBERG_COLORS.muted;

  const tSize = titleFontSize ?? (p ? 60 : 77);
  const dSize = descriptionFontSize ?? (p ? 28 : 36);
  const labelSize = dSize * 0.4;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const panelOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  // Parse ohlcvTable into candles if available; otherwise fall back to items
  const candlesFromOhlcvTable = (table: { headers: string[]; rows: string[][] }): Candle[] | null => {
    const hdrs = table.headers.map((h) => String(h).toLowerCase().trim());
    const findCol = (...kws: string[]) => {
      for (const kw of kws) {
        const i = hdrs.findIndex((h) => h.includes(kw));
        if (i !== -1) return i;
      }
      return -1;
    };
    const parseNum = (v: string) => {
      const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const openCol = findCol("open");
    const highCol = findCol("high");
    const lowCol = findCol("low");
    const closeCol = findCol("close");
    const volCol = findCol("volume", "vol");
    if (openCol === -1 || highCol === -1 || lowCol === -1 || closeCol === -1) return null;
    const result: Candle[] = [];
    for (const row of table.rows) {
      const o = parseNum(row[openCol] ?? "");
      const h = parseNum(row[highCol] ?? "");
      const l = parseNum(row[lowCol] ?? "");
      const c = parseNum(row[closeCol] ?? "");
      if (o === null || h === null || l === null || c === null) continue;
      let v = 0;
      if (volCol !== -1) {
        const raw = parseFloat(String(row[volCol] ?? "").replace(/[^0-9.\-]/g, ""));
        if (Number.isFinite(raw)) v = raw > 1e9 ? raw / 1e9 : raw > 1e6 ? raw / 1e6 : raw;
      }
      result.push({ o, h, l, c, v });
    }
    return result.length >= 4 ? result : null;
  };

  const tableParsed = ohlcvTable ? candlesFromOhlcvTable(ohlcvTable) : null;

  // Parse optional numeric items as closes; else procedural OHLC
  const parsed = items
    .map((s) => {
      const parts = String(s).split("|");
      // Full OHLCV format: "date|open|high|low|close|vol"
      if (parts.length >= 5) {
        const c = parseFloat(parts[4]);
        return Number.isFinite(c) ? c : NaN;
      }
      const m = String(s).match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : NaN;
    })
    .filter((n) => Number.isFinite(n));

  // Only use real OHLCV data — never synthesize fake candles from plain close prices.
  // If no real data is available, fall back to the deterministic procedural generator
  // so the layout still renders gracefully while the backend guard re-routes the scene.
  const tableCandles = tableParsed ?? null;
  const N = tableCandles ? tableCandles.length : 72;
  const candles = tableCandles ?? generateCandles(N, 178);
  const closes = candles.map((k) => k.c);
  const highs = candles.map((k) => k.h);
  const lows = candles.map((k) => k.l);
  // Use the 5th–95th percentile of close prices as the "core range" instead of
  // raw min/max. This stops a single outlier candle (or two) from dominating the
  // vertical scale and forcing every other bar to span the chart. Then expand by
  // 50% above/below so the visible price action fills only ~50% of the chart.
  const sortedCloses = [...closes].sort((a, b) => a - b);
  const pct = (frac: number) => {
    const idx = Math.max(0, Math.min(sortedCloses.length - 1, Math.round(frac * (sortedCloses.length - 1))));
    return sortedCloses[idx];
  };
  const coreLo = pct(0.05);
  const coreHi = pct(0.95);
  // Still respect actual highs/lows but clip them to a multiplier of core range
  const coreRange = (coreHi - coreLo) || 1;
  const cap = coreRange * 1.5;
  const pMaxRaw = Math.min(Math.max(...highs), coreHi + cap);
  const pMinRaw = Math.max(Math.min(...lows), coreLo - cap);
  const pRangeRaw = (pMaxRaw - pMinRaw) || 1;
  const yPadFrac = 0.5;
  const pMax = pMaxRaw + pRangeRaw * yPadFrac;
  const pMin = pMinRaw - pRangeRaw * yPadFrac;
  const pRange = pMax - pMin;
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

  // RSI(14)
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

  // ── Plain-English chart analysis ──
  const pctChange = ((closes[N - 1] - closes[0]) / Math.max(Math.abs(closes[0]), 0.001)) * 100;
  const verdict = pctChange > 5 ? "BULLISH TREND" : pctChange < -5 ? "BEARISH DECLINE" : "CONSOLIDATING";
  const verdictColor = pctChange > 5 ? pos : pctChange < -5 ? neg : amber;

  // Pre-compute date helpers (used in insights below)
  const _tradingDatesEarly: string[] = (() => {
    const out: string[] = [];
    const d = new Date();
    let count = 0;
    while (count < N) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        out.unshift(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d));
        count++;
      }
      d.setDate(d.getDate() - 1);
    }
    return out;
  })();

  // Insight 1: overall direction with open → close prices
  const insightTrend = `Started at ${closes[0].toFixed(1)}, now at ${last.toFixed(1)} — ${pctChange >= 0 ? "up" : "down"} ${Math.abs(pctChange).toFixed(1)}% over ${N} trading days`;

  // Insight 2: recent momentum with actual % and date
  const recentWindow = Math.max(4, Math.floor(N * 0.12));
  const recentSlice = closes.slice(-recentWindow);
  const recentDelta = recentSlice[recentSlice.length - 1] - recentSlice[0];
  const recentPct = (recentDelta / Math.max(Math.abs(recentSlice[0]), 0.001)) * 100;
  const recentDateLabel = _tradingDatesEarly[N - recentWindow] ?? "";
  const insightMomentum = Math.abs(recentPct) < 0.5
    ? `Flat since ${recentDateLabel} — no clear direction recently`
    : recentPct > 0 && pctChange > 0
    ? `Accelerating — up another ${recentPct.toFixed(1)}% since ${recentDateLabel}`
    : recentPct > 0 && pctChange <= 0
    ? `Recovering — gained ${recentPct.toFixed(1)}% since ${recentDateLabel} after the drop`
    : pctChange > 0
    ? `Stalling — down ${Math.abs(recentPct).toFixed(1)}% since ${recentDateLabel} despite the overall uptrend`
    : `Still falling — down ${Math.abs(recentPct).toFixed(1)}% since ${recentDateLabel}`;

  // Insight 3: biggest single-bar move with actual date
  const bodyPcts = candles.map(k => ((k.c - k.o) / Math.max(Math.abs(k.o), 0.001)) * 100);
  const biggestIdx = bodyPcts.reduce((best, _, i) => Math.abs(bodyPcts[i]) > Math.abs(bodyPcts[best]) ? i : best, 0);
  const biggestPct = bodyPcts[biggestIdx];
  const biggestDate = _tradingDatesEarly[biggestIdx] ?? `day ${biggestIdx + 1}`;
  const insightBigMove = `Biggest single day: ${biggestPct >= 0 ? "+" : ""}${biggestPct.toFixed(1)}% on ${biggestDate} — ${biggestPct >= 0 ? "a strong buying surge" : "heavy selling pressure"}`;

  // Insight 4: where price sits vs period high/low with actual values
  const posInRange = (last - pMin) / Math.max(pRange, 0.001);
  const insightRange = posInRange > 0.75
    ? `Near its ${N}-day high of ${pMax.toFixed(1)} — buyers are in control`
    : posInRange < 0.25
    ? `Near its ${N}-day low of ${pMin.toFixed(1)} — sellers have the upper hand`
    : `Mid-range between ${pMin.toFixed(1)} and ${pMax.toFixed(1)} — neither side dominating`;

  // Insight 5: volatility with actual average daily swing
  const avgDailyRange = candles.reduce((s, k) => s + (k.h - k.l) / Math.max(k.c, 0.001), 0) / N * 100;
  const insightVol = avgDailyRange < 1.5
    ? `Calm — average daily swing of ${avgDailyRange.toFixed(1)}%, low volatility`
    : avgDailyRange > 3.5
    ? `Volatile — average daily swing of ${avgDailyRange.toFixed(1)}%, expect big moves`
    : `Moderate — average daily swing of ${avgDailyRange.toFixed(1)}%`;

  const insights = [insightTrend, insightMomentum, insightBigMove, insightRange, insightVol];

  // ── Generate N trading-day dates going back from today ──
  const tradingDates: string[] = (() => {
    const out: string[] = [];
    const d = new Date();
    let count = 0;
    while (count < N) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        out.unshift(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d));
        count++;
      }
      d.setDate(d.getDate() - 1);
    }
    return out;
  })();

  // ── Layout dimensions ──
  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 28 : 36;
  const legendH = p ? 52 : 36;
  // Landscape: text panel on left (42%), chart pushed right
  const chartLeft = p ? pad : "42%";
  const signalStripH = p ? 100 : 0;
  const narrationH = p ? 36 : 0;

  // ── SVG viewBox — portrait gives price panel far more vertical room ──
  const VB_W = 1000;
  const VB_H = p ? 1400 : 600;
  const priceH = p ? 1020 : 420;
  const rsiTop = p ? 1055 : 438;
  const rsiBot = p ? 1175 : 498;
  const volTop = p ? 1205 : 508;
  const volBot = p ? 1385 : 597;
  const divider1Y = p ? 1038 : 432;
  const divider2Y = p ? 1190 : 504;
  const priceAxisW = p ? 80 : 56;
  const chartW = VB_W - priceAxisW;
  const axisFont = p ? 22 : 14;
  const subLabelFont = p ? 16 : 9;
  const fibFont = p ? 15 : 10;
  const pillFont = p ? 20 : 11;
  const pillH = p ? 32 : 18;
  const xLabelY = p ? priceH + 26 : priceH + 8;
  const xLabelFont = p ? 20 : 13;
  const xAxisTitleFont = p ? 12 : 8;
  const yAxisTitleFont = p ? 12 : 8;
  const xAxisTitleY = p ? priceH + 10 : priceH + 2;
  const yAxisTitleX = chartW + priceAxisW / 2;
  const yAxisTitleY = priceH / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 24,

      }}>
        <span style={{ backgroundColor: amber, color: "#000000", fontSize: tSize * 0.28, padding: "1px 8px 2px", display: "inline-block" }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: amber, fontSize: dSize * 0.7, letterSpacing: 1 }}>
          {last.toFixed(2)}
        </span>
        <span style={{ color: dayChange >= 0 ? pos : neg, fontSize: labelSize * 1.05, letterSpacing: 1 }}>
          {dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)} ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%)
        </span>
      </div>

      {/* Period info strip */}
      <div style={{
        position: "absolute", top: topH + 4, left: pad, right: pad,
        height: legendH,
        display: "flex", alignItems: "center",
        opacity: titleOp,
      }}>
        <span style={{ color: muted, fontSize: labelSize * 0.9, letterSpacing: 1 }}>
          {tradingDates[0]} — {tradingDates[tradingDates.length - 1]}  ·  {N} TRADING DAYS
        </span>
      </div>

      {/* ── Chart SVG area ── */}
      <div style={{
        position: "absolute",
        top: topH + legendH + 8,
        left: chartLeft,
        right: pad,
        bottom: botH + (p ? signalStripH + narrationH + 12 : 4),
        border: `1px solid ${BLOOMBERG_COLORS.border}`,
        backgroundColor: BLOOMBERG_COLORS.panelBg,
        opacity: fadeIn,
      }}>

        <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
             style={{ display: "block" }}>

          {/* Price gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={`g${i}`} x1="0" x2={chartW}
                  y1={t * priceH} y2={t * priceH}
                  stroke={`${amber}18`} strokeWidth="1" strokeDasharray="2 4" />
          ))}

          {/* Y-axis gridline value labels — right axis only (avoids left-side clutter) */}

          {/* Candle type legend — two separate chips, top-right */}
          {(() => {
            const tf = p ? 13 : 7.5; const bw = p ? 10 : 6; const bh = p ? 14 : 9;
            const chipH = p ? 20 : 13; const gap = p ? 8 : 5;
            const labels = [
              { color: pos, text: "Up day" },
              { color: neg,  text: "Down day" },
            ];
            // Measure chip widths and stack right-to-left from chartW edge
            const chipW = (txt: string) => txt.length * tf * 0.62 + bw + 14;
            let cx = chartW - (p ? 10 : 6);
            const ly = p ? 30 : 18;
            return (
              <g>
                {[...labels].reverse().map(({ color, text }, ri) => {
                  const cw = chipW(text);
                  cx -= cw + (ri === 0 ? 0 : gap);
                  const x = cx;
                  return (
                    <g key={text}>
                      <rect x={x} y={ly} width={cw} height={chipH} fill={`${bg}CC`} rx="2" />
                      <rect x={x + 4} y={ly + (chipH - bh) / 2} width={bw} height={bh} fill={color} rx="1" />
                      <text x={x + 4 + bw + 4} y={ly + chipH * 0.72} fill={muted} fontSize={tf}>{text}</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Key price levels — period high, 75%, midpoint, 25%, period low */}
          {[
            { pct: 1,    label: "Period High" },
            { pct: 0.75, label: "Upper zone" },
            { pct: 0.5,  label: "Midpoint" },
            { pct: 0.25, label: "Lower zone" },
            { pct: 0,    label: "Period Low" },
          ].map(({ pct, label }, i) => {
            const price = pMin + pRange * pct;
            const y = ((pMax - price) / pRange) * priceH;
            const labelW = p ? 80 : 50;
            return (
              <g key={`kl${i}`}>
                <line x1="0" x2={chartW} y1={y} y2={y}
                      stroke={`${amber}20`} strokeWidth="1" strokeDasharray="4 5" />
                <rect x="0" y={y - fibFont - 1} width={labelW} height={fibFont + 2} fill={`${bg}AA`} />
                <text x="3" y={y - 2} fill={muted} fontSize={fibFont} opacity="0.8">
                  {label} {price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Event vertical markers */}
          {events.filter((e) => e < visN).map((e, i) => {
            const x = (e / (N - 1)) * chartW;
            return (
              <line key={`ev${i}`} x1={x} x2={x} y1="0" y2={priceH + 12}
                    stroke={amber} strokeWidth="1.2" opacity="0.5" />
            );
          })}

          {/* BB band fill + borders */}
          <path
            d={bandPath(bbU, bbL, visN, N, pMin, pRange, priceH, chartW)}
            fill={amber} opacity="0.07"
          />
          <polyline points={linePts(bbU, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={`${amber}77`} strokeWidth="1" />
          <polyline points={linePts(bbL, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={`${amber}77`} strokeWidth="1" />

          {/* Candles — bodies/wicks clamped so a single outlier never spans the chart */}
          {candles.slice(0, visN).map((k, i) => {
            const x = (i / (N - 1)) * chartW;
            const w = Math.max(3, Math.min(10, (chartW / N) * 0.5));
            // Clamp y values into the visible range so wicks can't overflow
            const clamp = (y: number) => Math.max(0, Math.min(priceH, y));
            const yH = clamp(((pMax - k.h) / pRange) * priceH);
            const yL = clamp(((pMax - k.l) / pRange) * priceH);
            const yO = clamp(((pMax - k.o) / pRange) * priceH);
            const yC = clamp(((pMax - k.c) / pRange) * priceH);
            const up = k.c >= k.o;
            const color = up ? pos : neg;
            const top = Math.min(yO, yC);
            // Cap any single body at 25% of the chart height — never let one bar span
            const h = Math.min(priceH * 0.25, Math.max(1.5, Math.abs(yC - yO)));
            return (
              <g key={`c${i}`}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                <rect x={x - w / 2} y={top} width={w} height={h} fill={color} />
              </g>
            );
          })}

          {/* MA20 / MA50 */}
          <polyline points={linePts(ma20, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={amber} strokeWidth={p ? 2.4 : 1.8} />
          <polyline points={linePts(ma50, visN, N, pMin, pRange, priceH, chartW)}
                    fill="none" stroke={blue} strokeWidth={p ? 2.4 : 1.8} />

          {/* MA endpoint labels — anchored to left of right axis, spread apart if close */}
          {(() => {
            const lf = p ? 13 : 7.5; const lh = p ? 15 : 9; const lw = p ? 88 : 54;
            const vIdx = Math.min(visN - 1, N - 1);
            // Place labels at 85% across so they don't crowd the right axis price pill
            const lx = chartW * 0.85;
            let ma20y = ((pMax - ma20[vIdx]) / pRange) * priceH;
            let ma50y = ((pMax - ma50[vIdx]) / pRange) * priceH;
            // Push labels apart if too close
            const minGap = lh + 4;
            if (Math.abs(ma20y - ma50y) < minGap) {
              const mid = (ma20y + ma50y) / 2;
              ma20y = mid - minGap / 2;
              ma50y = mid + minGap / 2;
            }
            return (
              <g>
                <rect x={lx - lw / 2} y={ma20y - lh} width={lw} height={lh} fill={`${bg}DD`} rx="2" />
                <text x={lx} y={ma20y - 3} fill={amber} fontSize={lf} textAnchor="middle" fontWeight="700">
                  20-day avg {ma20[vIdx].toFixed(1)}
                </text>
                <rect x={lx - lw / 2} y={ma50y + 2} width={lw} height={lh} fill={`${bg}DD`} rx="2" />
                <text x={lx} y={ma50y + lh - 1} fill={blue} fontSize={lf} textAnchor="middle" fontWeight="700">
                  50-day avg {ma50[vIdx].toFixed(1)}
                </text>
              </g>
            );
          })()}

          {/* Opening price dot + label at bar 0 */}
          {(() => {
            const oy = ((pMax - closes[0]) / pRange) * priceH;
            const lf = p ? 13 : 7.5;
            return (
              <g>
                <circle cx="4" cy={oy} r={p ? 5 : 3} fill={muted} opacity="0.7" />
                <rect x="8" y={oy - (p ? 10 : 6)} width={p ? 70 : 44} height={p ? 14 : 9} fill={`${bg}BB`} rx="2" />
                <text x="12" y={oy + (p ? 3 : 2)} fill={muted} fontSize={lf}>
                  OPEN {closes[0].toFixed(1)}
                </text>
              </g>
            );
          })()}

          {/* Current price pill (right axis) */}
          {(() => {
            const y = ((pMax - last) / pRange) * priceH;
            return (
              <g>
                <line x1="0" x2={chartW} y1={y} y2={y}
                      stroke={amber} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
                <rect x={chartW + 2} y={y - pillH / 2} width={priceAxisW - 4} height={pillH} fill={amber} rx="2" />
                <text x={chartW + priceAxisW / 2} y={y + pillFont / 3} fill={BLOOMBERG_COLORS.bg}
                      fontSize={pillFont} textAnchor="middle" fontWeight="700">
                  {last.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* Y-axis label */}
          <text
            x={yAxisTitleX}
            y={yAxisTitleY}
            transform={`rotate(-90 ${yAxisTitleX} ${yAxisTitleY})`}
            fill={muted}
            fontSize={yAxisTitleFont}
            fontWeight={700}
            opacity="0.85"
            textAnchor="middle"
          >
            PRICE ($)
          </text>

          {/* Right axis price labels */}
          {[pMax, pMax - pRange * 0.25, pMax - pRange * 0.5, pMax - pRange * 0.75, pMin].map((v, i) => (
            <text key={`ax${i}`}
                  x={chartW + 6}
                  y={i * (priceH / 4) + axisFont + 2}
                  fill={muted} fontSize={axisFont} fontWeight={700}>
              {v.toFixed(1)}
            </text>
          ))}

          {/* X-axis date labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const idx = Math.min(Math.round(t * (N - 1)), tradingDates.length - 1);
            const x = t * chartW;
            const dateLabel = tradingDates[idx] ?? `Day ${idx + 1}`;
            return (
              <g key={`xt${i}`}>
                <line x1={x} x2={x} y1={priceH} y2={priceH + (p ? 14 : 8)}
                      stroke={`${amber}44`} strokeWidth="1" />
                <text x={x} y={xLabelY} fill={amber} fontSize={xLabelFont}
                      textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} opacity="0.85" fontWeight={700}>
                  {dateLabel}
                </text>
              </g>
            );
          })}

          {/* X-axis label */}
          <text
            x={chartW / 2}
            y={xAxisTitleY}
            fill={amber}
            fontSize={xAxisTitleFont}
            fontWeight={700}
            opacity="0.75"
            textAnchor="middle"
          >
            TRADING DAYS
          </text>

          {/* Divider price → RSI */}
          <line x1="0" x2={VB_W} y1={divider1Y} y2={divider1Y} stroke={BLOOMBERG_COLORS.border} strokeWidth="1" />

          {/* RSI subpanel */}
          {(() => {
            const lastR = rsi[Math.min(visN - 2, rsi.length - 1)] ?? 50;
            const rsiColor = lastR > 70 ? neg : lastR < 30 ? blue : amber;
            const ob70y = rsiTop + (rsiBot - rsiTop) * 0.2;
            const os30y = rsiTop + (rsiBot - rsiTop) * 0.8;
            const rx = (Math.min(visN - 1, N - 1) / (N - 1)) * chartW;
            const ry = rsiBot - ((lastR - 20) / 60) * (rsiBot - rsiTop);
            const lf = p ? 12 : 7;
            return (
              <g>
                {/* RSI label sits in the divider gap above the panel — no overlap */}
                <text x="6" y={divider1Y - (p ? 6 : 3)} fill={muted} fontSize={subLabelFont} letterSpacing="1">
                  Momentum (RSI)
                </text>
                <text x={p ? 160 : 92} y={divider1Y - (p ? 6 : 3)} fill={rsiColor} fontSize={subLabelFont} fontWeight="700">
                  {lastR.toFixed(0)} — {lastR > 70 ? "Overbought" : lastR < 30 ? "Oversold" : "Neutral"}
                </text>

                {/* 70 line — label right-aligned, above line */}
                <line x1="0" x2={chartW} y1={ob70y} y2={ob70y} stroke={`${neg}35`} strokeWidth="1" strokeDasharray="3 4" />
                <rect x={chartW - (p ? 90 : 56)} y={ob70y - lf - (p ? 4 : 2)} width={p ? 88 : 54} height={lf + (p ? 3 : 2)} fill={`${bg}AA`} />
                <text x={chartW - (p ? 4 : 3)} y={ob70y - (p ? 3 : 2)} fill={`${neg}99`} fontSize={lf} textAnchor="end">Overbought (70)</text>

                {/* 30 line — label right-aligned, below line */}
                <line x1="0" x2={chartW} y1={os30y} y2={os30y} stroke={`${blue}35`} strokeWidth="1" strokeDasharray="3 4" />
                <rect x={chartW - (p ? 82 : 50)} y={os30y + (p ? 2 : 1)} width={p ? 80 : 48} height={lf + (p ? 3 : 2)} fill={`${bg}AA`} />
                <text x={chartW - (p ? 4 : 3)} y={os30y + lf + (p ? 2 : 1)} fill={`${blue}99`} fontSize={lf} textAnchor="end">Oversold (30)</text>

                {/* RSI line */}
                <polyline
                  points={rsi.slice(0, Math.max(1, visN - 1)).map((r, i) => {
                    const x = ((i + 1) / (N - 1)) * chartW;
                    const y = rsiBot - ((r - 20) / 60) * (rsiBot - rsiTop);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(" ")}
                  fill="none" stroke={rsiColor} strokeWidth={p ? 2 : 1.4}
                />

                {/* End dot only — value already shown in header */}
                <circle cx={rx} cy={ry} r={p ? 5 : 3} fill={rsiColor} />
              </g>
            );
          })()}

          {/* Divider RSI → Volume */}
          <line x1="0" x2={VB_W} y1={divider2Y} y2={divider2Y} stroke={BLOOMBERG_COLORS.border} strokeWidth="1" />

          {/* Volume bars — each bar = one trading day */}
          <text x="6" y={volTop + subLabelFont + 2} fill={muted} fontSize={subLabelFont} letterSpacing="1">
            VOLUME (per day)
          </text>
          {(() => {
            const volMaxH = volBot - volTop - (p ? 28 : 12);
            const visCandles = candles.slice(0, visN);
            // CRITICAL: normalize volumes to [0, 1] using the max volume in the
            // dataset. Otherwise crypto-scale volumes (billions, divided by 1e9
            // by the parser) produce values like 17, which would render bars at
            // 17 × volMaxH SVG units tall — overflowing the entire chart.
            const maxV = Math.max(...visCandles.map((k) => k.v), 1e-9);
            const avgV = visCandles.reduce((s, k) => s + k.v, 0) / visN;
            const avgVNorm = avgV / maxV;
            const avgY = volBot - volMaxH * avgVNorm;
            const fmtVol = (v: number) => {
              if (v >= 1000) return `${(v / 1000).toFixed(1)}B`;
              if (v >= 1) return `${v.toFixed(1)}M`;
              return `${(v * 1000).toFixed(0)}K`;
            };
            const sorted = [...visCandles].sort((a, b) => b.v - a.v);
            const top6 = new Set(sorted.slice(0, 6).map((k) => k.v));
            const lf = p ? 12 : 6.5;
            const barW = Math.max(3, Math.min(10, (chartW / N) * 0.5));
            return (
              <>
                {visCandles.map((k, i) => {
                  const x = (i / (N - 1)) * chartW;
                  const up = k.c >= k.o;
                  // Normalize this bar's volume into [0, 1] then scale to volMaxH
                  const h = Math.max(0, Math.min(volMaxH, volMaxH * (k.v / maxV)));
                  const barTop = volBot - h;
                  const showLabel = top6.has(k.v);
                  return (
                    <g key={`v${i}`}>
                      <rect x={x - barW / 2} y={barTop} width={barW} height={h}
                            fill={up ? pos : neg} opacity="0.85" />
                      {showLabel && (
                        <text
                          x={x} y={barTop - (p ? 5 : 3)}
                          fill={up ? pos : neg}
                          fontSize={lf} textAnchor="middle" fontWeight="700"
                        >
                          {fmtVol(k.v)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Average volume reference line */}
                <line x1="0" x2={chartW} y1={avgY} y2={avgY}
                      stroke={`${amber}66`} strokeWidth="1" strokeDasharray="5 4" />
                <rect x={chartW - (p ? 70 : 44)} y={avgY - (p ? 13 : 8)} width={p ? 68 : 42} height={p ? 12 : 8} fill={`${bg}BB`} rx="1" />
                <text x={chartW - (p ? 36 : 22)} y={avgY - (p ? 3 : 1)} fill={`${amber}AA`} fontSize={lf} textAnchor="middle">
                  AVG {fmtVol(avgV)}
                </text>
              </>
            );
          })()}
        </svg>
      </div>

      {/* ── Analysis panel — left column, does not overlap chart ── */}
      {!p && (
        <div style={{
          position: "absolute",
          top: topH + legendH + 8,
          left: pad,
          width: `calc(42% - ${pad * 2}px)`,
          bottom: botH + 4,
          background: BLOOMBERG_COLORS.panelBg,
          border: `1px solid ${BLOOMBERG_COLORS.border}`,
          borderLeft: `4px solid ${verdictColor}`,
          padding: "20px 22px",
          opacity: panelOp,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          overflow: "hidden",
        }}>
          {/* Header row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${amber}44`,
          }}>
            <span style={{ color: amber, fontSize: dSize * 0.6, letterSpacing: 2, fontWeight: 700 }}>
              CHART ANALYSIS
            </span>
            <span style={{
              color: "#000", backgroundColor: amber,
              fontSize: dSize * 0.52, padding: "3px 10px", letterSpacing: 1, fontWeight: 700,
            }}>
              {ticker || title?.split(" ").slice(0, 2).join(" ").toUpperCase() || "CHART"}
            </span>
          </div>

          {/* Verdict */}
          <div style={{
            color: verdictColor, fontSize: dSize * 0.72, fontWeight: 700,
            letterSpacing: 2, marginBottom: 16,
          }}>
            {verdict}
          </div>

          {/* Insight bullets */}
          {insights.map((txt, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              marginBottom: 10,
            }}>
              <span style={{ color: amber, fontSize: dSize * 0.65, flexShrink: 0, lineHeight: 1.4 }}>›</span>
              <span style={{ color: "#e8e0cc", fontSize: dSize * 0.6, lineHeight: 1.5 }}>
                {txt}
              </span>
            </div>
          ))}

          {/* Narration */}
          {narration ? (
            <div style={{
              marginTop: "auto",
              paddingTop: 12,
              borderTop: `1px solid ${amber}33`,
              color: `${muted}CC`, fontSize: dSize * 0.52, lineHeight: 1.5,
            }}>
              {narration}
            </div>
          ) : null}
        </div>
      )}

      {/* Portrait overlay panel (unchanged behaviour) */}
      {p && (
        <div style={{
          position: "absolute",
          top: topH + legendH + 24,
          left: pad + 16,
          width: "78%",
          background: `rgba(0,0,0,0.45)`,
          border: `1px solid ${amber}33`,
          borderLeft: `3px solid ${verdictColor}`,
          padding: "20px 22px",
          opacity: panelOp,
          backdropFilter: "blur(4px)",
          zIndex: 2,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${amber}33`,
          }}>
            <span style={{ color: amber, fontSize: dSize * 0.42, letterSpacing: 2, fontWeight: 700 }}>CHART ANALYSIS</span>
            <span style={{ color: "#000", backgroundColor: amber, fontSize: dSize * 0.35, padding: "2px 8px", letterSpacing: 1, fontWeight: 700 }}>
              {ticker || title?.split(" ").slice(0, 2).join(" ").toUpperCase() || "CHART"}
            </span>
          </div>
          <div style={{ color: verdictColor, fontSize: dSize * 0.44, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
            {verdict}
          </div>
          {insights.map((txt, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ color: amber, fontSize: dSize * 0.4, flexShrink: 0, lineHeight: 1.4 }}>›</span>
              <span style={{ color: "#e8e0cc", fontSize: dSize * 0.38, lineHeight: 1.45 }}>{txt}</span>
            </div>
          ))}
          {narration ? (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${amber}33`, color: `${muted}CC`, fontSize: dSize * 0.34, lineHeight: 1.45 }}>
              {narration}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Portrait: narration + signal strip ── */}
      {p && (
        <>
          <div style={{
            position: "absolute",
            bottom: botH + signalStripH + 6,
            left: pad, right: pad,
            color: muted, fontSize: dSize * 0.6,
            opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
            lineHeight: 1.4,
          }}>
            {narration}
          </div>

          {/* Analysis strip for portrait */}
          <div style={{
            position: "absolute",
            bottom: botH + 4,
            left: pad, right: pad,
            height: signalStripH,
            backgroundColor: BLOOMBERG_COLORS.panelBg,
            border: `1px solid ${BLOOMBERG_COLORS.border}`,
            borderLeft: `3px solid ${verdictColor}`,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "6px 10px",
            opacity: panelOp,
            gap: 4,
          }}>
            <span style={{ color: verdictColor, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 2 }}>
              {verdict}
            </span>
            {insights.slice(0, 3).map((txt, i) => (
              <div key={i} style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                <span style={{ color: amber, fontSize: 9, flexShrink: 0, marginTop: 1 }}>›</span>
                <span style={{ color: muted, fontSize: 9, lineHeight: 1.35 }}>{txt}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: BLOOMBERG_COLORS.headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 16,
      }}>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 2 }}>
          CHART ANALYSIS
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: verdictColor, fontSize: labelSize, letterSpacing: 1, fontWeight: 700 }}>
          {verdict}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ────────── helpers ──────────

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
