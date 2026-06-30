import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import type { CredentialResponse } from "@react-oauth/google";
import { getStockData } from "../../api/stockData";
import type { StockDataResponse, StockMetricRow } from "../../api/stockData";

type Period = 7 | 30 | 60;

const DEFAULT_TICKER = "SPCX";
const DEFAULT_PERIOD: Period = 30;

// ─── Purple palette ────────────────────────────────────────
const P = {
  bg:          "#09071a",
  surface:     "#0e0b20",
  card:        "#120f28",
  border:      "#1e1a3a",
  grid:        "#16132e",
  primary:     "#7c3aed",
  primaryHov:  "#6d28d9",
  glow:        "rgba(124,58,237,0.18)",
  light:       "#a78bfa",
  dim:         "#4c3d7a",
  text:        "#e2d9f3",
  textSub:     "#7c6fa0",
  up:          "#22c55e",
  upFill:      "#16a34a",
  down:        "#ef4444",
  downFill:    "#dc2626",
  vol:         "rgba(124,58,237,0.35)",
  volHov:      "rgba(124,58,237,0.55)",
};

// ─── Formatters ────────────────────────────────────────────
function fmtPrice(n: number | null | undefined, cur = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
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

// ─── Candlestick SVG chart ──────────────────────────────────
interface PricePoint { date: string; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null; }

interface HoveredCandle { idx: number; x: number; y: number; data: PricePoint; }

function CandlestickChart({ prices, currency }: { prices: PricePoint[]; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 340 });
  const [hovered, setHovered] = useState<HoveredCandle | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const valid = prices.filter(p => p.high != null && p.low != null && p.open != null && p.close != null);
  if (!valid.length) return (
    <div ref={containerRef} className="flex h-full items-center justify-center" style={{ color: P.textSub }}>
      No chart data
    </div>
  );

  const ML = 4, MR = 64, MT = 12, MB = 32;
  const VOL_H = 52;
  const { w, h } = dims;
  const chartW = w - ML - MR;
  const priceH = h - MT - MB - VOL_H - 6;

  // Price scale
  const highs = valid.map(p => p.high!), lows = valid.map(p => p.low!);
  const rawMax = Math.max(...highs), rawMin = Math.min(...lows);
  const pad = (rawMax - rawMin) * 0.06;
  const pMax = rawMax + pad, pMin = rawMin - pad;

  // Volume scale
  const vols = valid.map(p => p.volume ?? 0);
  const vMax = Math.max(...vols, 1);

  const n = valid.length;
  const slot = chartW / n;
  const candleW = Math.max(Math.min(slot * 0.65, 14), 1.5);

  const xOf = (i: number) => ML + (i + 0.5) * slot;
  const yP = (p: number) => MT + (1 - (p - pMin) / (pMax - pMin)) * priceH;
  const yV = (v: number) => (h - MB) - (v / vMax) * VOL_H;

  // Y-axis price ticks (5 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => pMin + t * (pMax - pMin));

  // X-axis date ticks (6 max)
  const xTickStep = Math.max(Math.floor(n / 6), 1);
  const xTicks = valid
    .map((p, i) => ({ i, label: fmtShortDate(p.date) }))
    .filter((_, i) => i % xTickStep === 0 || i === n - 1);

  // Current price position
  const lastClose = valid[valid.length - 1]?.close;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - ML) / slot)));
    const d = valid[idx];
    if (d) {
      setHovered({ idx, x: xOf(idx), y: yP(d.close ?? d.high ?? 0), data: d });
    }
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        width={w} height={h}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ display: "block", cursor: "crosshair" }}
      >
        {/* Background */}
        <rect width={w} height={h} fill={P.surface} />

        {/* Horizontal grid + price labels */}
        {yTicks.map(tick => {
          const y = yP(tick);
          return (
            <g key={tick}>
              <line x1={ML} y1={y} x2={w - MR} y2={y} stroke={P.grid} strokeWidth={0.8} />
              <text
                x={w - MR + 6} y={y + 4}
                fill={P.textSub} fontSize={10} fontFamily="monospace"
              >
                {new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(tick)}
              </text>
            </g>
          );
        })}

        {/* Current price line */}
        {lastClose != null && (
          <g>
            <line
              x1={ML} y1={yP(lastClose)}
              x2={w - MR} y2={yP(lastClose)}
              stroke={P.primary} strokeWidth={0.8} strokeDasharray="4 3"
            />
            <rect x={w - MR + 2} y={yP(lastClose) - 9} width={MR - 4} height={17} rx={3} fill={P.primary} />
            <text
              x={w - MR + (MR - 4) / 2 + 2} y={yP(lastClose) + 4}
              fill="#fff" fontSize={10} fontFamily="monospace" textAnchor="middle" fontWeight="bold"
            >
              {new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lastClose)}
            </text>
          </g>
        )}

        {/* Volume bars */}
        {valid.map((p, i) => {
          const isGreen = (p.close ?? 0) >= (p.open ?? 0);
          const vH = ((p.volume ?? 0) / vMax) * VOL_H;
          return (
            <rect
              key={`v-${i}`}
              x={xOf(i) - candleW / 2} y={h - MB - vH}
              width={candleW} height={Math.max(vH, 1)}
              fill={isGreen ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}
            />
          );
        })}

        {/* Separator between price and volume */}
        <line x1={ML} y1={h - MB - VOL_H - 3} x2={w - MR} y2={h - MB - VOL_H - 3} stroke={P.grid} strokeWidth={0.5} />

        {/* Candlesticks */}
        {valid.map((p, i) => {
          const isGreen = (p.close ?? 0) >= (p.open ?? 0);
          const col = isGreen ? P.up : P.down;
          const bodyTop = yP(Math.max(p.open!, p.close!));
          const bodyBot = yP(Math.min(p.open!, p.close!));
          const bodyH = Math.max(bodyBot - bodyTop, 1);
          const x = xOf(i);
          const isHov = hovered?.idx === i;
          return (
            <g key={`c-${i}`} opacity={isHov ? 1 : 0.92}>
              {/* Wick */}
              <line x1={x} y1={yP(p.high!)} x2={x} y2={yP(p.low!)} stroke={col} strokeWidth={1.2} />
              {/* Body */}
              <rect
                x={x - candleW / 2} y={bodyTop}
                width={candleW} height={bodyH}
                fill={isGreen ? P.upFill : P.downFill}
                stroke={col} strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* Crosshair */}
        {hovered && (
          <>
            <line x1={hovered.x} y1={MT} x2={hovered.x} y2={h - MB} stroke={P.light} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.5} />
            <line x1={ML} y1={hovered.y} x2={w - MR} y2={hovered.y} stroke={P.light} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.5} />
          </>
        )}

        {/* X-axis date labels */}
        {xTicks.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={h - MB + 14} fill={P.textSub} fontSize={10} textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>

      {/* Hover OHLCV tooltip */}
      {hovered && (() => {
        const d = hovered.data;
        const isGreen = (d.close ?? 0) >= (d.open ?? 0);
        const tooltipX = hovered.x > dims.w * 0.65 ? hovered.x - 170 : hovered.x + 12;
        return (
          <div
            className="pointer-events-none absolute top-3 rounded-xl border px-3 py-2 text-xs shadow-lg"
            style={{
              left: tooltipX,
              background: P.card,
              border: `1px solid ${P.border}`,
              minWidth: 154,
            }}
          >
            <p className="mb-1 font-semibold" style={{ color: P.light }}>{fmtShortDate(d.date)}</p>
            {[
              ["O", d.open], ["H", d.high], ["L", d.low], ["C", d.close],
            ].map(([lbl, v]) => (
              <div key={lbl as string} className="flex justify-between gap-4">
                <span style={{ color: P.textSub }}>{lbl}</span>
                <span style={{ color: isGreen ? P.up : P.down, fontFamily: "monospace" }}>
                  {fmtPrice(v as number | null, currency)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-4 border-t pt-1" style={{ borderColor: P.border }}>
              <span style={{ color: P.textSub }}>Vol</span>
              <span style={{ color: P.textSub, fontFamily: "monospace" }}>{fmtLarge(d.volume)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Signup modal (matches FreeTemplatesPage style) ────────
interface SignupModalProps { onClose: () => void; onSuccess: () => void; }

function SignupModal({ onClose, onSuccess }: SignupModalProps) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    setError(null);
    try {
      const res = await googleLogin(response.credential, false, localStorage.getItem("b2v_ref_code"));
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user);
      onSuccess();
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }, [login, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
        <div className="h-1 w-full bg-purple-600" />
        <div className="p-8">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon + title */}
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
            Sign in to search <span className="font-semibold text-gray-800">any ticker</span>, adjust time ranges, and view income statements and balance sheets — all free.
          </p>

          <ul className="mb-6 space-y-2">
            {[
              "Any stock, ETF, or index ticker",
              "7, 30, or 60-day price + candlestick history",
              "Annual income statement & balance sheet",
            ].map((item) => (
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
              <GoogleAuthButton
                onSuccess={handleSuccess}
                onError={() => setError("Sign-in failed. Please try again.")}
                text="signup_with"
                width="320"
              />
            )}
          </div>
          {error && <p className="text-center text-xs text-red-500">{error}</p>}
          <p className="text-center text-xs text-gray-400">No credit card required.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Financial table ────────────────────────────────────────
function FinancialTable({ rows, title }: { rows: StockMetricRow[]; title: string }) {
  if (!rows.length) return (
    <div className="rounded-xl border p-4 text-sm" style={{ background: P.card, border: `1px solid ${P.border}`, color: P.textSub }}>
      No {title.toLowerCase()} data for this ticker.
    </div>
  );
  const dates = rows[0]?.values.map(v => v.date) ?? [];
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${P.border}` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: P.card, borderBottom: `1px solid ${P.border}` }}>
        <span className="h-2 w-2 rounded-full" style={{ background: P.primary }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: P.light }}>{title}</p>
      </div>
      <div style={{ background: P.surface }}>
        <div
          className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: `1fr ${dates.map(() => "80px").join(" ")}`, color: P.textSub, borderBottom: `1px solid ${P.border}` }}
        >
          <span>Metric</span>
          {dates.map(d => <span key={d} className="text-right">{fmtYear(d)}</span>)}
        </div>
        {rows.map((row, i) => (
          <div
            key={row.metric}
            className="grid px-4 py-2.5"
            style={{
              gridTemplateColumns: `1fr ${row.values.map(() => "80px").join(" ")}`,
              borderBottom: i < rows.length - 1 ? `1px solid ${P.border}` : undefined,
            }}
          >
            <span className="text-xs" style={{ color: P.textSub }}>
              {row.metric === "Total Liabilities Net Minority Interest" ? "Total Liabilities" : row.metric}
            </span>
            {row.values.map(v => (
              <span key={v.date} className="text-right text-xs font-semibold tabular-nums" style={{ color: P.text }}>
                {fmtLarge(v.value)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────
export default function StockVisualizer() {
  const { user, login } = useAuth();
  const isAuthed = Boolean(user);

  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKER);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [data, setData] = useState<StockDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async (sym: string, days: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStockData(sym, days);
      setData(res.data);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to load stock data."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(ticker, period); }, [ticker, period, fetchData]);

  const handleTickerSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) { setShowModal(true); return; }
    const c = tickerInput.trim().toUpperCase();
    if (c && c !== ticker) setTicker(c);
  }, [isAuthed, ticker, tickerInput]);

  const handlePeriod = useCallback((p: Period) => {
    if (!isAuthed) { setShowModal(true); return; }
    setPeriod(p);
  }, [isAuthed]);

  const handleSignupSuccess = useCallback(() => {
    setShowModal(false);
  }, []);

  const prices = data?.prices ?? [];
  const cur = data?.info.currency ?? "USD";
  const lastPrice = data?.info.current_price ?? (prices.length ? prices[prices.length - 1]?.close ?? null : null);
  const prevClose = data?.info.previous_close ?? (prices.length >= 2 ? prices[prices.length - 2]?.close ?? null : null);
  const change = lastPrice != null && prevClose != null ? lastPrice - prevClose : null;
  const changePct = change != null && prevClose ? (change / Math.abs(prevClose)) * 100 : null;
  const isUp = change != null ? change >= 0 : null;

  return (
    <div className="space-y-3">
      {showModal && (
        <SignupModal onClose={() => setShowModal(false)} onSuccess={handleSignupSuccess} />
      )}

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl p-3"
        style={{ background: P.card, border: `1px solid ${P.border}` }}
      >
        {/* Ticker input */}
        <form onSubmit={handleTickerSubmit} className="flex gap-2">
          <input
            type="text"
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onFocus={() => { if (!isAuthed) setShowModal(true); }}
            readOnly={!isAuthed}
            placeholder="TICKER"
            className="w-28 rounded-xl border px-3 py-1.5 text-sm font-bold uppercase tracking-wider transition focus:outline-none focus:ring-2"
            style={{
              background: P.surface, border: `1px solid ${P.border}`,
              color: P.text, cursor: isAuthed ? "text" : "pointer",
              focusRingColor: P.primary,
            }}
          />
          <button
            type="submit"
            className="rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition hover:opacity-90"
            style={{ background: P.primary, color: "#fff" }}
          >
            Search
          </button>
        </form>

        {/* Period tabs */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: P.surface, border: `1px solid ${P.border}` }}
        >
          {([7, 30, 60] as Period[]).map(p => (
            <button
              key={p} type="button"
              onClick={() => handlePeriod(p)}
              className="rounded-lg px-3 py-1 text-xs font-bold transition"
              style={{
                background: period === p ? P.primary : "transparent",
                color: period === p ? "#fff" : P.textSub,
              }}
            >
              {p}D
            </button>
          ))}
        </div>

        {/* Auth hint */}
        {!isAuthed && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
            style={{ border: `1px solid ${P.dim}`, color: P.light, background: P.glow }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
            Sign in to customize
          </button>
        )}
      </div>

      {/* ── Chart card ───────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: P.bg, border: `1px solid ${P.border}` }}
      >
        {/* Price header */}
        <div className="flex flex-wrap items-end gap-6 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: P.light }}>
                {data?.ticker ?? ticker}
              </span>
              {data?.info.name && data.info.name !== (data?.ticker ?? ticker) && (
                <span className="text-xs" style={{ color: P.textSub }}>{data.info.name}</span>
              )}
            </div>
            {loading ? (
              <div className="mt-1 h-9 w-32 animate-pulse rounded-lg" style={{ background: P.card }} />
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums" style={{ color: P.text }}>
                  {fmtPrice(lastPrice, cur)}
                </span>
                {change != null && changePct != null && (
                  <span className="text-sm font-semibold" style={{ color: isUp ? P.up : P.down }}>
                    {change >= 0 ? "▲" : "▼"} {fmtPrice(Math.abs(change), cur)} ({Math.abs(changePct).toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="ml-auto flex flex-wrap gap-5">
            {[
              { label: "Market Cap", val: fmtLarge(data?.info.market_cap) },
              { label: "P/E", val: data?.info.pe_ratio?.toFixed(2) ?? "—" },
              { label: "Div Yield", val: data?.info.dividend_yield != null ? `${(data.info.dividend_yield * 100).toFixed(2)}%` : "—" },
              { label: "Sector", val: data?.info.sector ?? "—" },
            ].map(({ label, val }) => (
              <div key={label} className="text-right">
                <p className="text-xs uppercase tracking-wider" style={{ color: P.textSub }}>{label}</p>
                <p className="text-xs font-semibold" style={{ color: P.text }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ height: 340, position: "relative" }}>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin" style={{ color: P.primary }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-xs" style={{ color: P.textSub }}>Fetching market data…</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-sm" style={{ color: P.down }}>{error}</p>
              <button type="button" onClick={() => setShowModal(true)}
                className="rounded-full px-4 py-2 text-xs font-semibold"
                style={{ background: P.primary, color: "#fff" }}
              >
                Try a different ticker
              </button>
            </div>
          ) : (
            <CandlestickChart prices={prices} currency={cur} />
          )}
        </div>
      </div>

      {/* ── Financial statements (locked) ─────────────────── */}
      <div className="relative">
        {!isAuthed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ background: "rgba(9,7,26,0.82)", backdropFilter: "blur(4px)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill={P.primary}>
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
            <p className="text-sm font-semibold" style={{ color: P.text }}>Sign in to view financial statements</p>
            <button type="button" onClick={() => setShowModal(true)}
              className="rounded-full px-5 py-2 text-sm font-bold transition hover:opacity-90"
              style={{ background: P.primary, color: "#fff" }}
            >
              Sign in free
            </button>
          </div>
        )}
        <div className={`grid gap-3 lg:grid-cols-2 ${!isAuthed ? "pointer-events-none select-none opacity-30" : ""}`}>
          <FinancialTable rows={data?.income_statement ?? []} title="Income Statement" />
          <FinancialTable rows={data?.balance_sheet ?? []} title="Balance Sheet" />
        </div>
      </div>

      {/* ── Sign-in CTA ───────────────────────────────────── */}
      {!isAuthed && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center"
          style={{ background: P.card, border: `1px solid ${P.border}` }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: P.light }}>
            Free · No credit card
          </p>
          <h3 className="text-xl font-bold" style={{ color: P.text }}>
            Search any ticker and unlock financials
          </h3>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: P.textSub }}>
            Sign in with Google to search any stock, ETF, or index, adjust time ranges, and view annual income statements and balance sheets.
          </p>
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
            width="280"
          />
        </div>
      )}
    </div>
  );
}
