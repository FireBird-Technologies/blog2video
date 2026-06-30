import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import type { CredentialResponse } from "@react-oauth/google";
import { getStockData } from "../../api/stockData";
import type { StockDataResponse, StockMetricRow } from "../../api/stockData";

type Period = 7 | 30 | 60;
const DEFAULT_TICKER = "B2V";
const DEFAULT_PERIOD: Period = 30;

// ─── Theme definitions ────────────────────────────────────
type ThemeId = "newscast" | "bloomberg" | "economist";

interface Theme {
  id: ThemeId;
  label: string;
  // layout backgrounds
  pageBg:   string;
  cardBg:   string;
  surfBg:   string;
  border:   string;
  grid:     string;
  // accents
  accent:   string;
  accentDim: string;
  amber:    string;
  amberLt:  string;
  // text
  text:     string;
  textMid:  string;
  textSub:  string;
  // chart
  chartBg:  string;
  // price moves
  up:       string;
  upFill:   string;
  down:     string;
  downFill: string;
  // ticker bar
  tickerBg:  string;
  tickerLabel: string;
  // whether text on accent is white or dark
  onAccent: string;
  // tag/badge styling for "LIVE" badge
  badgeBg:  string;
  badgeText: string;
}

const THEMES: Record<ThemeId, Theme> = {
  newscast: {
    id: "newscast", label: "Newscast",
    pageBg: "#07080f", cardBg: "#10131f", surfBg: "#0c0e18",
    border: "#1a1e30", grid: "#141826",
    accent: "#cc1a1a", accentDim: "#3d0a0a",
    amber: "#d97706", amberLt: "#fbbf24",
    text: "#f0f2f8", textMid: "#8892aa", textSub: "#5a6480",
    chartBg: "#07080f",
    up: "#22c55e", upFill: "#15803d", down: "#ef4444", downFill: "#b91c1c",
    tickerBg: "#0c0e18", tickerLabel: "#cc1a1a",
    onAccent: "#ffffff", badgeBg: "#cc1a1a", badgeText: "#ffffff",
  },
  bloomberg: {
    id: "bloomberg", label: "Bloomberg",
    pageBg: "#020202", cardBg: "#0a0a0a", surfBg: "#060606",
    border: "#1e1e1e", grid: "#111111",
    accent: "#e8a032", accentDim: "#3d2700",
    amber: "#e8a032", amberLt: "#f5c061",
    text: "#f0ede8", textMid: "#b0a080", textSub: "#5a5040",
    chartBg: "#020202",
    up: "#00d97e", upFill: "#00a85a", down: "#ff3838", downFill: "#cc2020",
    tickerBg: "#060606", tickerLabel: "#e8a032",
    onAccent: "#000000", badgeBg: "#e8a032", badgeText: "#000000",
  },
  economist: {
    id: "economist", label: "Economist",
    pageBg: "#faf8f4", cardBg: "#ffffff", surfBg: "#f5f3ef",
    border: "#d8d3c8", grid: "#ece9e2",
    accent: "#e3120b", accentDim: "#fde8e7",
    amber: "#c05c00", amberLt: "#a04800",
    text: "#1a1a1a", textMid: "#4a4a4a", textSub: "#888888",
    chartBg: "#faf8f4",
    up: "#007a3d", upFill: "#005c2e", down: "#c0392b", downFill: "#a93226",
    tickerBg: "#e3120b", tickerLabel: "#e3120b",
    onAccent: "#ffffff", badgeBg: "#e3120b", badgeText: "#ffffff",
  },
};

// ─── Dynamic trading days (relative to today) ────────────
function getRecentTradingDays(n: number): string[] {
  const result: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (result.length < n) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      result.unshift(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
}
const TRADING_DAYS = getRecentTradingDays(30);

// ─── Formatters ───────────────────────────────────────────
function fmtPrice(n: number | null | undefined, cur = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtLarge(n: number | null | undefined) {
  if (n == null) return "—";
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6)  return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3)  return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(2)}`;
}
function fmtShortDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtYear(d: string) { return d.slice(0, 4); }

// ─── Preset dummy data (uses current trading days) ───────
type PriceRow = { date: string; open: number; high: number; low: number; close: number; volume: number };

function makePrices(base: number, seed: number): PriceRow[] {
  let price = base;
  return TRADING_DAYS.map((date, i) => {
    const r = Math.sin(i * seed + seed) * 0.5 + Math.cos(i * 1.7 + seed) * 0.3;
    price = Math.max(price + r * base * 0.012, base * 0.85);
    const spread = base * 0.006;
    const open  = Math.round((price - r * base * 0.005) * 100) / 100;
    const close = Math.round(price * 100) / 100;
    const high  = Math.round((Math.max(open, close) + Math.abs(Math.sin(i * 3.1)) * spread) * 100) / 100;
    const low   = Math.round((Math.min(open, close) - Math.abs(Math.cos(i * 2.7)) * spread) * 100) / 100;
    return { date, open, high, low, close, volume: Math.round(30000 + Math.abs(Math.sin(i * 1.9 + seed)) * 60000) };
  });
}

function makeIncome(revenue: number, netIncome: number): StockMetricRow[] {
  const yrs = ["2025-12-31", "2024-12-31", "2023-12-31"];
  const g = (v: number) => yrs.map((d, i) => ({ date: d, value: Math.round(v * Math.pow(0.87, i)) }));
  return [
    { metric: "Total Revenue",    values: g(revenue) },
    { metric: "Gross Profit",     values: g(revenue * 0.55) },
    { metric: "Operating Income", values: g(netIncome * 1.3) },
    { metric: "Net Income",       values: g(netIncome) },
    { metric: "EBITDA",           values: g(netIncome * 1.6) },
  ];
}
function makeBalance(assets: number): StockMetricRow[] {
  const yrs = ["2025-12-31", "2024-12-31", "2023-12-31"];
  const g = (v: number) => yrs.map((d, i) => ({ date: d, value: Math.round(v * Math.pow(0.9, i)) }));
  const liab = assets * 0.48;
  return [
    { metric: "Total Assets",        values: g(assets) },
    { metric: "Total Liabilities",   values: g(liab) },
    { metric: "Stockholders Equity", values: g(assets - liab) },
    { metric: "Total Debt",          values: g(liab * 0.6) },
    { metric: "Cash",                values: g(assets * 0.12) },
  ];
}

const PRESET_DATA: Record<string, StockDataResponse> = {
  B2V:   { ticker: "B2V",   period: "30", info: { name: "Blog2Video Inc. ✦ Demo", sector: "Technology",           industry: "AI & Video Software",          currency: "USD", current_price: 42.38,  previous_close: 40.31,  market_cap: 1_240_000_000,      pe_ratio: 28.4, dividend_yield: null   }, prices: makePrices(38,  1.3), income_statement: makeIncome(180_000_000, 28_000_000),             balance_sheet: makeBalance(320_000_000)         },
  SPCX:  { ticker: "SPCX",  period: "30", info: { name: "SPC Credit",             sector: "Financial Services",   industry: "Asset Management",             currency: "USD", current_price: 25.47,  previous_close: 25.69,  market_cap: 412_000_000,        pe_ratio: null, dividend_yield: 0.089  }, prices: makePrices(25,  2.1), income_statement: [],                                            balance_sheet: makeBalance(412_000_000)         },
  AAPL:  { ticker: "AAPL",  period: "30", info: { name: "Apple Inc.",              sector: "Technology",           industry: "Consumer Electronics",         currency: "USD", current_price: 198.45, previous_close: 199.34, market_cap: 3_050_000_000_000,  pe_ratio: 32.1, dividend_yield: 0.0052 }, prices: makePrices(194, 3.7), income_statement: makeIncome(391_000_000_000, 100_000_000_000),  balance_sheet: makeBalance(352_000_000_000)     },
  GOOGL: { ticker: "GOOGL", period: "30", info: { name: "Alphabet Inc.",           sector: "Communication Svcs",   industry: "Internet Content",             currency: "USD", current_price: 185.23, previous_close: 186.28, market_cap: 2_270_000_000_000,  pe_ratio: 24.8, dividend_yield: 0.0048 }, prices: makePrices(181, 4.2), income_statement: makeIncome(307_000_000_000, 73_000_000_000),   balance_sheet: makeBalance(402_000_000_000)     },
  NVDA:  { ticker: "NVDA",  period: "30", info: { name: "NVIDIA Corporation",      sector: "Technology",           industry: "Semiconductors",               currency: "USD", current_price: 134.56, previous_close: 130.84, market_cap: 3_290_000_000_000,  pe_ratio: 48.2, dividend_yield: 0.0003 }, prices: makePrices(128, 5.1), income_statement: makeIncome(130_000_000_000, 72_000_000_000),   balance_sheet: makeBalance(111_000_000_000)     },
  TSLA:  { ticker: "TSLA",  period: "30", info: { name: "Tesla, Inc.",             sector: "Consumer Cyclical",    industry: "Auto Manufacturers",           currency: "USD", current_price: 248.90, previous_close: 244.12, market_cap: 796_000_000_000,    pe_ratio: 89.7, dividend_yield: null   }, prices: makePrices(238, 6.8), income_statement: makeIncome(98_000_000_000, 7_000_000_000),    balance_sheet: makeBalance(106_000_000_000)     },
  MSFT:  { ticker: "MSFT",  period: "30", info: { name: "Microsoft Corporation",   sector: "Technology",           industry: "Software—Infrastructure",      currency: "USD", current_price: 414.72, previous_close: 412.57, market_cap: 3_080_000_000_000,  pe_ratio: 36.8, dividend_yield: 0.007  }, prices: makePrices(408, 7.2), income_statement: makeIncome(245_000_000_000, 88_000_000_000),   balance_sheet: makeBalance(484_000_000_000)     },
  AMZN:  { ticker: "AMZN",  period: "30", info: { name: "Amazon.com Inc.",         sector: "Consumer Cyclical",    industry: "Internet Retail",              currency: "USD", current_price: 224.15, previous_close: 222.80, market_cap: 2_370_000_000_000,  pe_ratio: 42.3, dividend_yield: null   }, prices: makePrices(218, 8.4), income_statement: makeIncome(590_000_000_000, 30_000_000_000),   balance_sheet: makeBalance(464_000_000_000)     },
  SPY:   { ticker: "SPY",   period: "30", info: { name: "SPDR S&P 500 ETF",        sector: "ETF",                  industry: "Large Blend",                  currency: "USD", current_price: 542.18, previous_close: 540.84, market_cap: 560_000_000_000,    pe_ratio: 22.4, dividend_yield: 0.013  }, prices: makePrices(536, 9.1), income_statement: [],                                            balance_sheet: []                               },
  QQQ:   { ticker: "QQQ",   period: "30", info: { name: "Invesco QQQ Trust",       sector: "ETF",                  industry: "Large Growth",                 currency: "USD", current_price: 468.32, previous_close: 466.43, market_cap: 296_000_000_000,    pe_ratio: 27.9, dividend_yield: 0.006  }, prices: makePrices(462, 2.9), income_statement: [],                                            balance_sheet: []                               },
};

const ALL_TICKERS = Object.keys(PRESET_DATA);
const QUICK_PICKS = ["B2V", "SPCX", "AAPL", "GOOGL", "NVDA", "TSLA"] as const;

// ─── Scrolling market ticker ──────────────────────────────
const TICKER_SCROLL = [
  { symbol: "B2V",     price: 42.00, pct: 5.12 },
  { symbol: "SPCX",    price: 25.47, pct: -0.86 },
  { symbol: "SPY",     price: 542.18, pct: 0.25 },
  { symbol: "QQQ",     price: 468.32, pct: 0.40 },
  { symbol: "AAPL",    price: 198.45, pct: -0.45 },
  { symbol: "MSFT",    price: 414.72, pct: 0.52 },
  { symbol: "NVDA",    price: 134.56, pct: 2.44 },
  { symbol: "GOOGL",   price: 185.23, pct: -0.56 },
  { symbol: "TSLA",    price: 248.90, pct: 1.96 },
  { symbol: "AMZN",    price: 224.15, pct: 0.43 },
  { symbol: "BTC-USD", price: 98450,  pct: 1.27 },
  { symbol: "GLD",     price: 238.74, pct: -0.20 },
];

function MarketTicker({ t }: { t: Theme }) {
  const items = [...TICKER_SCROLL, ...TICKER_SCROLL];
  return (
    <div className="overflow-hidden border-t" style={{ background: t.tickerBg, borderColor: t.border }}>
      <style>{`
        @keyframes sv-tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .sv-tick{animation:sv-tick 55s linear infinite;display:flex;width:max-content}
        .sv-tick:hover{animation-play-state:paused}
      `}</style>
      <div className="flex items-stretch" style={{ height: 30 }}>
        <div className="flex flex-shrink-0 items-center px-3 text-xs font-bold uppercase tracking-widest"
          style={{ background: t.badgeBg, color: t.badgeText }}>
          MARKETS
        </div>
        <div className="flex flex-1 items-center overflow-hidden">
          <div className="sv-tick">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 px-4 text-xs" style={{ borderRight: `1px solid ${t.border}` }}>
                <span className="font-bold" style={{ color: t.text, fontFamily: "monospace" }}>{item.symbol}</span>
                <span className="tabular-nums" style={{ color: t.amberLt, fontFamily: "monospace" }}>
                  {item.price < 1000 ? item.price.toFixed(2) : item.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: item.pct >= 0 ? t.up : t.down, fontFamily: "monospace" }}>
                  {item.pct >= 0 ? "▲" : "▼"} {Math.abs(item.pct).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Line chart (SVG, theme-aware) ───────────────────────
interface PricePoint { date: string; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null; }

function LineChart({ prices, currency, ticker, t }: { prices: PricePoint[]; currency: string; ticker: string; t: Theme }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 440 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setDims({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const valid = prices.filter(p => p.close != null);
  if (!valid.length) return (
    <div ref={containerRef} className="flex h-full items-center justify-center" style={{ color: t.textSub }}>No data</div>
  );

  const ML = 72, MR = 18, MT = 20, MB = 40, VOL_H = 52;
  const { w, h } = dims;
  const chartW = w - ML - MR;
  const priceH = h - MT - MB - VOL_H - 8;

  const closes = valid.map(p => p.close!);
  const rawMax = Math.max(...closes), rawMin = Math.min(...closes);
  const pad = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.01);
  const pMax = rawMax + pad, pMin = rawMin - pad;
  const vMax = Math.max(...valid.map(p => p.volume ?? 0), 1);
  const n = valid.length;
  const slot = n > 1 ? chartW / (n - 1) : chartW;

  const xOf = (i: number) => ML + i * slot;
  const yP  = (p: number) => MT + (1 - (p - pMin) / (pMax - pMin)) * priceH;

  // Y-ticks (6 clean values)
  const yRange = pMax - pMin;
  const rawStep = yRange / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.ceil(rawStep / mag) * mag;
  const firstTick = Math.ceil(pMin / step) * step;
  const yTicks = Array.from({ length: 8 }, (_, i) => firstTick + i * step).filter(v => v >= pMin && v <= pMax);

  // X-ticks
  const xTickCount = Math.min(n, 8);
  const xStep = Math.max(Math.floor((n - 1) / (xTickCount - 1)), 1);
  const xTicks = valid.map((p, i) => ({ i, label: fmtShortDate(p.date) })).filter((_, i) => i % xStep === 0 || i === n - 1);

  const linePath = valid.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yP(p.close!).toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${xOf(n - 1).toFixed(1)},${(h - MB - VOL_H - 8).toFixed(1)} L${ML},${(h - MB - VOL_H - 8).toFixed(1)} Z`;

  const lastClose = valid[valid.length - 1]?.close;
  const isOverallUp = valid.length >= 2 ? (valid[valid.length - 1].close ?? 0) >= (valid[0].close ?? 0) : true;
  const lineColor = isOverallUp ? t.up : t.down;
  const gradId = `svgrad-${ticker}`;
  const clipId = `svclip-${ticker}`;
  const hov = hoverIdx != null ? valid[hoverIdx] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.max(0, Math.min(n - 1, Math.round((e.clientX - rect.left - ML) / slot)));
    setHoverIdx(idx);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg width={w} height={h} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)} style={{ display: "block", cursor: "crosshair" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={ML} y={MT} width={chartW} height={priceH} />
          </clipPath>
        </defs>

        <rect width={w} height={h} fill={t.chartBg} />

        {/* Y-axis label */}
        <text x={14} y={MT + priceH / 2} fill={t.textSub} fontSize={10} textAnchor="middle" fontFamily="monospace"
          transform={`rotate(-90,14,${MT + priceH / 2})`}>
          Price ({currency})
        </text>

        {/* Y grid + labels */}
        {yTicks.map(tick => {
          const y = yP(tick);
          return (
            <g key={tick}>
              <line x1={ML} y1={y} x2={w - MR} y2={y} stroke={t.grid} strokeWidth={0.8} />
              <text x={ML - 6} y={y + 4} fill={t.textSub} fontSize={10} textAnchor="end" fontFamily="monospace">
                {new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: tick >= 1000 ? 0 : 2, maximumFractionDigits: tick >= 1000 ? 0 : 2 }).format(tick)}
              </text>
            </g>
          );
        })}

        {/* Y-axis border */}
        <line x1={ML} y1={MT} x2={ML} y2={h - MB - VOL_H - 8} stroke={t.border} strokeWidth={1} />

        {/* Volume separator */}
        <line x1={ML} y1={h - MB - VOL_H - 4} x2={w - MR} y2={h - MB - VOL_H - 4} stroke={t.grid} strokeWidth={0.5} />

        {/* Volume label */}
        <text x={ML + 4} y={h - MB - VOL_H + 10} fill={t.textSub} fontSize={9} fontFamily="monospace">VOL</text>

        {/* Volume bars */}
        {valid.map((p, i) => {
          const isUp = (p.close ?? 0) >= (p.open ?? 0);
          const barW = Math.max((n > 1 ? slot * 0.55 : 8), 2);
          const vH = ((p.volume ?? 0) / vMax) * VOL_H;
          return (
            <rect key={`v-${i}`} x={xOf(i) - barW / 2} y={h - MB - vH} width={barW} height={Math.max(vH, 1)}
              fill={isUp ? (t.id === "economist" ? "rgba(0,122,61,0.3)" : "rgba(34,197,94,0.22)") : (t.id === "economist" ? "rgba(192,57,43,0.3)" : "rgba(239,68,68,0.22)")} />
          );
        })}

        {/* X-axis */}
        <line x1={ML} y1={h - MB} x2={w - MR} y2={h - MB} stroke={t.border} strokeWidth={0.8} />

        {/* X labels */}
        {xTicks.map(({ i, label }) => (
          <g key={i}>
            <line x1={xOf(i)} y1={h - MB - VOL_H - 4} x2={xOf(i)} y2={h - MB - VOL_H} stroke={t.border} strokeWidth={0.6} />
            <text x={xOf(i)} y={h - MB + 14} fill={t.textSub} fontSize={10} textAnchor="middle" fontFamily="monospace">{label}</text>
          </g>
        ))}

        {/* X-axis label */}
        <text x={ML + chartW / 2} y={h - 6} fill={t.textSub} fontSize={10} textAnchor="middle" fontFamily="monospace">Date</text>

        {/* Fill + line */}
        <path d={fillPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.2} strokeLinejoin="round" clipPath={`url(#${clipId})`} />

        {/* Current price badge */}
        {lastClose != null && (
          <g>
            <line x1={ML} y1={yP(lastClose)} x2={w - MR} y2={yP(lastClose)} stroke={t.amberLt} strokeWidth={0.8} strokeDasharray="4 3" />
            <rect x={ML - 68} y={yP(lastClose) - 10} width={64} height={20} rx={2} fill={t.accent} />
            <text x={ML - 36} y={yP(lastClose) + 5} fill={t.onAccent} fontSize={10} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              {new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lastClose)}
            </text>
          </g>
        )}

        {/* Crosshair + dot */}
        {hov && hoverIdx != null && (
          <>
            <line x1={xOf(hoverIdx)} y1={MT} x2={xOf(hoverIdx)} y2={h - MB} stroke={t.amberLt} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.5} />
            <circle cx={xOf(hoverIdx)} cy={yP(hov.close!)} r={5} fill={lineColor} stroke={t.chartBg} strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hov && hoverIdx != null && (() => {
        const isUp = (hov.close ?? 0) >= (hov.open ?? 0);
        const tx = xOf(hoverIdx) > dims.w * 0.62 ? xOf(hoverIdx) - 170 : xOf(hoverIdx) + 14;
        return (
          <div className="pointer-events-none absolute text-xs shadow-xl"
            style={{ left: tx, top: 20, background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 8, minWidth: 162, padding: "10px 14px" }}>
            <p className="mb-1.5 font-bold uppercase tracking-wider" style={{ color: t.amberLt, fontSize: 10 }}>
              {fmtShortDate(hov.date)}
            </p>
            {(["Open","High","Low","Close"] as const).map((lbl, idx) => {
              const v = [hov.open, hov.high, hov.low, hov.close][idx];
              return (
                <div key={lbl} className="flex justify-between gap-4">
                  <span style={{ color: t.textSub }}>{lbl}</span>
                  <span style={{ color: isUp ? t.up : t.down, fontFamily: "monospace" }}>{fmtPrice(v, currency)}</span>
                </div>
              );
            })}
            <div className="mt-1.5 flex justify-between gap-4 border-t pt-1.5" style={{ borderColor: t.border }}>
              <span style={{ color: t.textSub }}>Volume</span>
              <span style={{ color: t.textSub, fontFamily: "monospace" }}>{fmtLarge(hov.volume)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Financial table (theme-aware, full-width) ────────────
function FinancialTable({ rows, title, t }: { rows: StockMetricRow[]; title: string; t: Theme }) {
  if (!rows.length) return (
    <div className="rounded-xl p-5 text-sm" style={{ background: t.cardBg, border: `1px solid ${t.border}`, color: t.textSub }}>
      No {title.toLowerCase()} data for this ticker.
    </div>
  );
  const dates = rows[0]?.values.map(v => v.date) ?? [];
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: t.cardBg, borderBottom: `1px solid ${t.border}` }}>
        <span className="h-2 w-2 rounded-full" style={{ background: t.accent }} />
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: t.amberLt }}>{title}</p>
      </div>
      <div style={{ background: t.surfBg }}>
        <div className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider"
          style={{ gridTemplateColumns: `1fr ${dates.map(() => "110px").join(" ")}`, color: t.textSub, borderBottom: `1px solid ${t.border}` }}>
          <span>Metric</span>
          {dates.map(d => <span key={d} className="text-right">{fmtYear(d)}</span>)}
        </div>
        {rows.map((row, i) => (
          <div key={row.metric} className="grid px-5 py-3 hover:opacity-90"
            style={{ gridTemplateColumns: `1fr ${row.values.map(() => "110px").join(" ")}`, borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : undefined, background: i % 2 === 1 ? `rgba(0,0,0,0.02)` : "transparent" }}>
            <span className="text-sm font-medium" style={{ color: t.textMid }}>{row.metric}</span>
            {row.values.map(v => (
              <span key={v.date} className="text-right text-sm font-semibold tabular-nums" style={{ color: t.text, fontFamily: "monospace" }}>
                {fmtLarge(v.value)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Signup modal (FreeTemplatesPage pattern, purple) ────
function SignupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true); setError(null);
    try {
      const res = await googleLogin(response.credential, false, localStorage.getItem("b2v_ref_code"));
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user);
      onSuccess();
    } catch { setError("Sign-in failed. Please try again."); }
    finally { setSigningIn(false); }
  }, [login, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
        <div className="h-1 w-full bg-purple-600" />
        <div className="p-8">
          <button onClick={onClose} aria-label="Close"
            className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-purple-50">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">Free stock tool</p>
              <h2 className="text-lg font-bold leading-tight text-gray-900">Unlock full market data</h2>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-gray-500">
            Sign in to search <span className="font-semibold text-gray-800">any ticker</span>, change time ranges, and view income statements and balance sheets — all free.
          </p>

          <ul className="mb-6 space-y-2">
            {["Any stock, ETF, or index ticker", "7, 30, or 60-day live price history", "Annual income statement & balance sheet"].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-purple-100 bg-purple-50 text-xs font-bold text-purple-600">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mb-5 border-t border-gray-100" />

          <div className="mb-3 flex justify-center">
            {signingIn ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="h-4 w-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing in…
              </div>
            ) : (
              <GoogleAuthButton onSuccess={handleSuccess} onError={() => setError("Sign-in failed. Please try again.")} text="signup_with" width="320" />
            )}
          </div>
          {error && <p className="mb-2 text-center text-xs text-red-500">{error}</p>}
          <p className="text-center text-xs text-gray-400">No credit card required · Free forever</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export default function StockVisualizer() {
  const { user, login } = useAuth();
  const isAuthed = Boolean(user);

  const [themeId, setThemeId] = useState<ThemeId>("newscast");
  const t = THEMES[themeId];

  const [activeTicker, setActiveTicker] = useState(DEFAULT_TICKER);
  const [searchQuery, setSearchQuery] = useState(DEFAULT_TICKER);
  const [showDropdown, setShowDropdown] = useState(false);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [data, setData] = useState<StockDataResponse | null>(PRESET_DATA[DEFAULT_TICKER]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = ALL_TICKERS.filter(s => s.startsWith(searchQuery.toUpperCase()) && s !== activeTicker);

  const fetchData = useCallback(async (sym: string, days: Period) => {
    setLoading(true); setError(null);
    try {
      const res = await getStockData(sym, days);
      setData(res.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load data.");
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    // B2V is fictional — keep it as demo data, never hit the API for it
    if (activeTicker === "B2V") { setData(PRESET_DATA["B2V"]); return; }
    // All real tickers always fetch live data from yfinance
    void fetchData(activeTicker, period);
  }, [activeTicker, period, isAuthed, fetchData]);

  const switchTicker = useCallback((sym: string) => {
    if (!isAuthed) { setShowModal(true); return; }
    setActiveTicker(sym);
    setSearchQuery(sym);
    setShowDropdown(false);
    if (sym === "B2V") setData(PRESET_DATA["B2V"]);
    else void fetchData(sym, period);
  }, [isAuthed, period, fetchData]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) { setShowModal(true); return; }
    const sym = searchQuery.trim().toUpperCase();
    if (!sym) return;
    setActiveTicker(sym);
    setShowDropdown(false);
    if (sym === "B2V") setData(PRESET_DATA["B2V"]);
    else void fetchData(sym, period);
  }, [isAuthed, searchQuery, period, fetchData]);

  const prices = data?.prices ?? [];
  const cur = data?.info.currency ?? "USD";
  const lastPrice = data?.info.current_price ?? (prices.length ? prices[prices.length - 1]?.close ?? null : null);
  const prevClose = data?.info.previous_close ?? (prices.length >= 2 ? prices[prices.length - 2]?.close ?? null : null);
  const change = lastPrice != null && prevClose != null ? lastPrice - prevClose : null;
  const changePct = change != null && prevClose ? (change / Math.abs(prevClose)) * 100 : null;
  const isUp = change != null ? change >= 0 : null;

  return (
    <div className="space-y-3" style={{ background: t.pageBg, borderRadius: 16, padding: "12px" }}>
      {showModal && (
        <SignupModal onClose={() => setShowModal(false)} onSuccess={() => setShowModal(false)} />
      )}
      {/* ── Theme + toolbar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-3"
        style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
        {/* LIVE badge */}
        <span className="rounded px-2 py-0.5 text-xs font-bold uppercase tracking-widest"
          style={{ background: t.badgeBg, color: t.badgeText }}>
          LIVE
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.textMid }}>
          Market Data
        </span>

        {/* Theme switcher */}
        <div className="ml-auto flex gap-1 rounded-lg p-0.5" style={{ background: t.surfBg, border: `1px solid ${t.border}` }}>
          {(["newscast", "bloomberg", "economist"] as ThemeId[]).map(id => (
            <button key={id} type="button"
              onClick={() => setThemeId(id)}
              className="rounded-md px-2.5 py-1 text-xs font-bold transition capitalize"
              style={{
                background: themeId === id ? t.accent : "transparent",
                color: themeId === id ? t.onAccent : t.textSub,
              }}>
              {THEMES[id].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + quick picks + period ───────────────── */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
        {/* Search */}
        <div className="relative flex-shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: t.textSub }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { if (!isAuthed) { setShowModal(true); return; } setSearchQuery(e.target.value.toUpperCase()); setShowDropdown(true); }}
                onFocus={() => { if (!isAuthed) { setShowModal(true); return; } setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                readOnly={!isAuthed}
                placeholder="Search any ticker…"
                className="w-48 rounded-xl border pl-9 pr-3 py-2 text-sm font-bold uppercase tracking-wider focus:outline-none"
                style={{
                  border: `1px solid ${t.border}`, background: t.surfBg,
                  color: t.text, cursor: "pointer",
                }}
              />
            </div>
            <button type="submit"
              className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ background: t.accent, color: t.onAccent }}>
              Go
            </button>
          </form>

          {/* Autocomplete dropdown */}
          {showDropdown && filtered.length > 0 && isAuthed && (
            <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl shadow-xl"
              style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
              {filtered.map(sym => (
                <button key={sym} type="button"
                  onMouseDown={() => switchTicker(sym)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                  style={{ borderBottom: `1px solid ${t.border}`, color: t.text }}>
                  <span className="font-bold" style={{ color: t.accent }}>{sym}</span>
                  <span style={{ color: t.textSub }}>{PRESET_DATA[sym]?.info.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick picks */}
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_PICKS.map(sym => (
            <button key={sym} type="button"
              onClick={() => switchTicker(sym)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:opacity-90"
              style={{
                background: activeTicker === sym ? t.accent : t.surfBg,
                color: activeTicker === sym ? t.onAccent : t.textMid,
                border: `1px solid ${activeTicker === sym ? t.accent : t.border}`,
                cursor: "pointer",
              }}>
              {sym}
              {sym === "B2V" && <span className="ml-1" style={{ fontSize: 8, color: activeTicker === "B2V" ? t.onAccent + "aa" : t.amber }}>DEMO</span>}
            </button>
          ))}
          {!isAuthed && (
            <button type="button" onClick={() => setShowModal(true)}
              className="text-xs underline-offset-2 hover:underline"
              style={{ color: "#7c3aed" }}>
              + sign in to search any ticker
            </button>
          )}
        </div>

        {/* Period */}
        <div className="ml-auto flex gap-1 rounded-lg p-0.5" style={{ background: t.surfBg, border: `1px solid ${t.border}` }}>
          {([7, 30, 60] as Period[]).map(p => (
            <button key={p} type="button"
              onClick={() => isAuthed ? setPeriod(p) : setShowModal(true)}
              className="rounded-md px-3 py-1.5 text-xs font-bold transition hover:opacity-90"
              style={{
                background: period === p ? t.accent : "transparent",
                color: period === p ? t.onAccent : t.textMid,
                cursor: "pointer",
              }}>
              {p}D
            </button>
          ))}
        </div>
      </div>

      {/* ── Demo notice ──────────────────────────────────── */}
      {activeTicker === "B2V" && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: t.accentDim, border: `1px solid ${t.accent}44` }}>
          <span style={{ color: t.amber }}>★</span>
          <span>
            <strong style={{ color: t.amberLt }}>Demo mode — </strong>
            <span style={{ color: t.textMid }}>
              B2V (Blog2Video Inc.) is a fictional ticker. Sign in below to switch to real stocks — SPCX, AAPL, GOOGL, NVDA, TSLA, or search any symbol.
            </span>
          </span>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl" style={{ background: t.chartBg, border: `1px solid ${t.border}` }}>
        {/* Price header */}
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: t.accent }}>
                {data?.ticker ?? activeTicker}
              </span>
              {data?.info.name && (
                <span className="text-sm" style={{ color: t.textMid }}>— {data.info.name}</span>
              )}
            </div>
            {loading
              ? <div className="mt-1 h-10 w-40 animate-pulse rounded" style={{ background: t.cardBg }} />
              : (
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-bold tabular-nums" style={{ color: t.text, fontFamily: "monospace" }}>
                    {fmtPrice(lastPrice, cur)}
                  </span>
                  {change != null && changePct != null && (
                    <span className="text-base font-bold tabular-nums" style={{ color: isUp ? t.up : t.down, fontFamily: "monospace" }}>
                      {change >= 0 ? "▲" : "▼"} {fmtPrice(Math.abs(change), cur)} ({Math.abs(changePct).toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}
          </div>
          <div className="flex flex-wrap gap-6">
            {[
              { label: "MKT CAP", val: fmtLarge(data?.info.market_cap) },
              { label: "P/E",     val: data?.info.pe_ratio?.toFixed(2) ?? "N/A" },
              { label: "DIV YLD", val: data?.info.dividend_yield != null ? `${(data.info.dividend_yield * 100).toFixed(2)}%` : "—" },
              { label: "SECTOR",  val: data?.info.sector ?? "—" },
              { label: "INDUSTRY",val: data?.info.industry ?? "—" },
            ].map(({ label, val }) => (
              <div key={label} className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.textSub }}>{label}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: t.amberLt, fontFamily: "monospace" }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart */}
        <div style={{ height: 440 }}>
          {loading
            ? <div className="flex h-full items-center justify-center">
                <svg className="h-10 w-10 animate-spin" style={{ color: t.accent }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            : error
              ? <div className="flex h-full flex-col items-center justify-center gap-2">
                  <p className="text-sm" style={{ color: t.down }}>{error}</p>
                </div>
              : <LineChart prices={prices} currency={cur} ticker={activeTicker} t={t} />
          }
        </div>

        <MarketTicker t={t} />
      </div>

      {/* ── Financial statements ─────────────────────────── */}
      <div className="relative">
        {!isAuthed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl"
            style={{ background: t.id === "economist" ? "rgba(250,248,244,0.92)" : "rgba(7,8,15,0.88)", backdropFilter: "blur(4px)" }}>
            <div className="flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#7c3aed">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              <span className="text-sm font-semibold text-purple-700">Sign in to view financials</span>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-full px-8 py-2.5 text-sm font-bold transition hover:opacity-90"
              style={{ background: "#7c3aed", color: "#fff" }}
            >
              Sign up free
            </button>
            <p className="text-xs text-gray-500">No credit card required</p>
          </div>
        )}
        <div className={`space-y-3 ${!isAuthed ? "pointer-events-none select-none opacity-20" : ""}`}>
          <FinancialTable rows={data?.income_statement ?? []} title="Income Statement" t={t} />
          <FinancialTable rows={data?.balance_sheet ?? []} title="Balance Sheet" t={t} />
        </div>
      </div>

      {/* ── Bottom CTA ───────────────────────────────────── */}
      {!isAuthed && (
        <div className="rounded-xl p-10 text-center" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
          <div className="mx-auto mb-5 inline-flex rounded px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ background: t.accentDim, color: t.accent, border: `1px solid ${t.accent}66` }}>
            Free · No credit card
          </div>
          <h3 className="mb-3 text-2xl font-bold" style={{ color: t.text }}>
            Search any real ticker and unlock financials
          </h3>
          <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed" style={{ color: t.textMid }}>
            B2V is a demo ticker. Sign in to search SPCX, AAPL, GOOGL, NVDA, TSLA, or any stock symbol — and view live 30-day price charts plus 3 years of annual income statements and balance sheets.
          </p>
          <div className="flex justify-center">
            <GoogleAuthButton
              onSuccess={async (response: CredentialResponse) => {
                if (!response.credential) return;
                try {
                  const res = await googleLogin(response.credential, false, localStorage.getItem("b2v_ref_code"));
                  localStorage.removeItem("b2v_ref_code");
                  login(res.data.access_token, res.data.user);
                } catch { /* silently ignore */ }
              }}
              onError={() => undefined}
              text="signup_with"
              width="300"
            />
          </div>
        </div>
      )}
    </div>
  );
}
