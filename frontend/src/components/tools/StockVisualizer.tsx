import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import type { CredentialResponse } from "@react-oauth/google";
import { getStockData } from "../../api/stockData";
import type { StockDataResponse, StockMetricRow } from "../../api/stockData";

type ChartTheme = "newscast" | "bloomberg" | "newspaper";
type Period = 7 | 30 | 60;

const DEFAULT_TICKER = "SPCX";
const DEFAULT_PERIOD: Period = 30;
const DEFAULT_THEME: ChartTheme = "newscast";

const THEMES = {
  newscast: {
    bg: "#0a0f1e",
    chartBg: "#0d1628",
    line: "#3b82f6",
    areaFill: "rgba(59,130,246,0.18)",
    areaStroke: "#3b82f6",
    grid: "#1a2535",
    axisText: "#6b7ea8",
    positive: "#22c55e",
    negative: "#ef4444",
    headerBg: "#cc0000",
    headerText: "#ffffff",
    primaryText: "#ffffff",
    secondaryText: "#8899bb",
    cardBg: "#0d1628",
    border: "#1a2535",
    tooltipBg: "#0d1628",
    tooltipBorder: "#1e3a5f",
    themeLabel: "Newscast",
    eyebrow: "LIVE MARKET DATA",
  },
  bloomberg: {
    bg: "#0d1117",
    chartBg: "#141921",
    line: "#ff8c00",
    areaFill: "rgba(255,140,0,0.12)",
    areaStroke: "#ff8c00",
    grid: "#1e2433",
    axisText: "#666666",
    positive: "#ff8c00",
    negative: "#ff4444",
    headerBg: "#ff6b00",
    headerText: "#000000",
    primaryText: "#e0e0e0",
    secondaryText: "#666666",
    cardBg: "#141921",
    border: "#2a2f3e",
    tooltipBg: "#141921",
    tooltipBorder: "#3a3f4e",
    themeLabel: "Bloomberg",
    eyebrow: "MARKET TERMINAL",
  },
  newspaper: {
    bg: "#fafaf8",
    chartBg: "#ffffff",
    line: "#1a3a6b",
    areaFill: "rgba(26,58,107,0.08)",
    areaStroke: "#1a3a6b",
    grid: "#e5e7eb",
    axisText: "#6b7280",
    positive: "#15803d",
    negative: "#b91c1c",
    headerBg: "#1a1a1a",
    headerText: "#ffffff",
    primaryText: "#1a1a1a",
    secondaryText: "#6b7280",
    cardBg: "#ffffff",
    border: "#e5e7eb",
    tooltipBg: "#ffffff",
    tooltipBorder: "#d1d5db",
    themeLabel: "Newspaper",
    eyebrow: "FINANCIAL MARKETS",
  },
} as const;

function formatPrice(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatLarge(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

function changePercent(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string } }>;
  theme: ChartTheme;
  currency: string;
}

function ChartTooltip({ active, payload, theme, currency }: ChartTooltipProps) {
  const t = THEMES[theme];
  if (!active || !payload?.length) return null;
  const { value, payload: pt } = payload[0];
  return (
    <div
      style={{
        background: t.tooltipBg,
        border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 8,
        padding: "8px 14px",
      }}
    >
      <p style={{ color: t.secondaryText, fontSize: 11, marginBottom: 2 }}>
        {formatShortDate(pt.date)}
      </p>
      <p style={{ color: t.primaryText, fontSize: 15, fontWeight: 600 }}>
        {formatPrice(value, currency)}
      </p>
    </div>
  );
}

interface LockGateProps {
  theme: ChartTheme;
  onUnlock: () => void;
  children: React.ReactNode;
  locked: boolean;
}

function LockGate({ theme, onUnlock, children, locked }: LockGateProps) {
  const t = THEMES[theme];
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div style={{ opacity: 0.35, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        style={{ background: "transparent" }}
      >
        <span
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
          style={{
            background: t.line,
            color: "#fff",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
          Sign in to customize
        </span>
      </button>
    </div>
  );
}

interface SignupModalProps {
  theme: ChartTheme;
  onClose: () => void;
  onSuccess: () => void;
}

function SignupModal({ theme, onClose, onSuccess }: SignupModalProps) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = THEMES[theme];

  const handleSuccess = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setSigningIn(true);
      setError(null);
      try {
        const res = await googleLogin(response.credential);
        login(res.data.access_token, res.data.user);
        onSuccess();
      } catch {
        setError("Sign-in failed. Please try again.");
      } finally {
        setSigningIn(false);
      }
    },
    [login, onSuccess]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{ background: t.cardBg, border: `1px solid ${t.border}` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 transition-opacity hover:opacity-60"
          style={{ color: t.secondaryText }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div
          className="mb-1 text-xs font-semibold uppercase tracking-widest"
          style={{ color: t.line }}
        >
          Free access
        </div>
        <h2
          className="mb-2 text-2xl font-bold"
          style={{ color: t.primaryText }}
        >
          Unlock the full tool
        </h2>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: t.secondaryText }}>
          Sign in to search any ticker, change time ranges, and view income statements and balance sheets — all free.
        </p>

        <div className="flex flex-col items-center gap-4">
          {signingIn ? (
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: `${t.line}33`, borderTopColor: t.line }}
            />
          ) : (
            <GoogleAuthButton
              onSuccess={handleSuccess}
              onError={() => setError("Sign-in failed. Please try again.")}
              text="signup_with"
              width="280"
            />
          )}
          {error && (
            <p className="text-sm" style={{ color: t.negative }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="mt-6 rounded-xl p-4 text-xs"
          style={{ background: `${t.line}11`, color: t.secondaryText }}
        >
          <p className="font-semibold" style={{ color: t.primaryText }}>
            What you get:
          </p>
          <ul className="mt-2 space-y-1">
            {[
              "Any stock ticker (S&P 500, NASDAQ, crypto ETFs)",
              "7, 30, or 60-day price history",
              "Income statement & balance sheet data",
              "Newscast, Bloomberg, and Newspaper themes",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span style={{ color: t.positive, marginTop: 1 }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface FinancialTableProps {
  rows: StockMetricRow[];
  theme: ChartTheme;
  title: string;
}

function FinancialTable({ rows, theme, title }: FinancialTableProps) {
  const t = THEMES[theme];
  if (!rows.length) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: t.cardBg, border: `1px solid ${t.border}`, color: t.secondaryText }}
      >
        No {title.toLowerCase()} data available for this ticker.
      </div>
    );
  }

  const dates = rows[0]?.values.map((v) => v.date) ?? [];

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: `1px solid ${t.border}` }}
    >
      <div
        className="px-4 py-3"
        style={{ background: t.headerBg }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: t.headerText }}
        >
          {title}
        </p>
      </div>
      <div style={{ background: t.cardBg }}>
        <div
          className="grid text-xs font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: `1fr ${dates.map(() => "auto").join(" ")}`,
            borderBottom: `1px solid ${t.border}`,
            color: t.secondaryText,
            padding: "8px 16px",
          }}
        >
          <span>Metric</span>
          {dates.map((d) => (
            <span key={d} className="text-right">
              {formatYear(d)}
            </span>
          ))}
        </div>
        {rows.map((row, i) => (
          <div
            key={row.metric}
            className="grid"
            style={{
              gridTemplateColumns: `1fr ${row.values.map(() => "auto").join(" ")}`,
              padding: "10px 16px",
              borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : undefined,
            }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: t.secondaryText }}
            >
              {row.metric === "Total Liabilities Net Minority Interest"
                ? "Total Liabilities"
                : row.metric}
            </span>
            {row.values.map((v) => (
              <span
                key={v.date}
                className="text-right text-xs font-semibold tabular-nums"
                style={{ color: t.primaryText }}
              >
                {formatLarge(v.value)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StockVisualizer() {
  const { user, login } = useAuth();
  const isAuthed = Boolean(user);

  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKER);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [theme, setTheme] = useState<ChartTheme>(DEFAULT_THEME);
  const [data, setData] = useState<StockDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const t = THEMES[theme];

  const fetchData = useCallback(async (sym: string, days: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStockData(sym, days);
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to load stock data.";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(ticker, period);
  }, [ticker, period, fetchData]);

  const handleSignupSuccess = useCallback(() => {
    setShowSignupModal(false);
  }, []);

  const handleTickerSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isAuthed) {
        setShowSignupModal(true);
        return;
      }
      const clean = tickerInput.trim().toUpperCase();
      if (clean && clean !== ticker) {
        setTicker(clean);
      }
    },
    [isAuthed, ticker, tickerInput]
  );

  const handlePeriodChange = useCallback(
    (p: Period) => {
      if (!isAuthed) {
        setShowSignupModal(true);
        return;
      }
      setPeriod(p);
    },
    [isAuthed]
  );

  const chartData = (data?.prices ?? []).map((p) => ({
    date: p.date,
    price: p.close,
  }));

  const currentPrice = data?.info.current_price ?? (chartData.at(-1)?.price ?? null);
  const previousClose = data?.info.previous_close ?? (chartData.at(-2)?.price ?? null);
  const change = currentPrice != null && previousClose != null ? currentPrice - previousClose : null;
  const changePct = changePercent(currentPrice, previousClose);
  const isPositive = change != null ? change >= 0 : null;
  const priceColor = isPositive == null ? t.primaryText : isPositive ? t.positive : t.negative;

  const yMin = chartData.length
    ? Math.min(...chartData.map((d) => d.price ?? Infinity)) * 0.995
    : undefined;
  const yMax = chartData.length
    ? Math.max(...chartData.map((d) => d.price ?? -Infinity)) * 1.005
    : undefined;

  const tickInterval = Math.max(Math.floor(chartData.length / 6) - 1, 0);

  return (
    <div className="space-y-4">
      {showSignupModal && (
        <SignupModal
          theme={theme}
          onClose={() => setShowSignupModal(false)}
          onSuccess={handleSignupSuccess}
        />
      )}

      {/* ── Controls ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: t.cardBg, border: `1px solid ${t.border}` }}
      >
        <div className="flex flex-wrap items-end gap-4">
          {/* Ticker input */}
          <div className="flex-1">
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: t.secondaryText }}
            >
              Ticker
            </label>
            <form onSubmit={handleTickerSubmit} className="flex gap-2">
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                onFocus={() => {
                  if (!isAuthed) setShowSignupModal(true);
                }}
                readOnly={!isAuthed}
                placeholder="e.g. AAPL, TSLA, SPY"
                className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold uppercase transition focus:outline-none focus:ring-2"
                style={{
                  background: t.bg,
                  border: `1px solid ${t.border}`,
                  color: t.primaryText,
                  cursor: isAuthed ? "text" : "pointer",
                }}
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={{ background: t.line, color: "#fff" }}
              >
                Go
              </button>
            </form>
          </div>

          {/* Period selector */}
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: t.secondaryText }}
            >
              Period
            </label>
            <div
              className="flex gap-1 rounded-xl p-1"
              style={{ background: t.bg, border: `1px solid ${t.border}` }}
            >
              {([7, 30, 60] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: period === p ? t.line : "transparent",
                    color: period === p ? "#fff" : t.secondaryText,
                  }}
                >
                  {p}D
                </button>
              ))}
            </div>
          </div>

          {/* Theme selector — always unlocked */}
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: t.secondaryText }}
            >
              Theme
            </label>
            <div
              className="flex gap-1 rounded-xl p-1"
              style={{ background: t.bg, border: `1px solid ${t.border}` }}
            >
              {(["newscast", "bloomberg", "newspaper"] as ChartTheme[]).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setTheme(th)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold capitalize transition"
                  style={{
                    background: theme === th ? t.line : "transparent",
                    color: theme === th ? "#fff" : t.secondaryText,
                  }}
                >
                  {THEMES[th].themeLabel}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!isAuthed && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: `${t.line}15`, color: t.secondaryText }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: t.line, flexShrink: 0 }}>
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
            <span>
              <button
                type="button"
                onClick={() => setShowSignupModal(true)}
                className="font-semibold underline underline-offset-2"
                style={{ color: t.line }}
              >
                Sign in free
              </button>
              {" "}to change the ticker, adjust the time range, and unlock financial statements.
            </span>
          </div>
        )}
      </div>

      {/* ── Chart card ───────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: t.bg, border: `1px solid ${t.border}` }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-4 px-5 py-3"
          style={{ background: t.headerBg }}
        >
          <span
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: t.headerText }}
          >
            {t.eyebrow}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-bold"
            style={{ background: `${t.headerText}22`, color: t.headerText }}
          >
            {data?.ticker ?? ticker}
          </span>
          <span
            className="ml-auto text-xs"
            style={{ color: `${t.headerText}aa` }}
          >
            {period}D · {data?.info.name ?? "—"}
          </span>
        </div>

        {/* Price summary */}
        <div className="flex flex-wrap items-end gap-6 px-6 pt-5 pb-2">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: t.secondaryText }}>
              {data?.info.currency ?? "USD"} · Last Price
            </p>
            <p className="mt-0.5 text-4xl font-bold tabular-nums" style={{ color: t.primaryText }}>
              {loading ? "—" : formatPrice(currentPrice, data?.info.currency)}
            </p>
          </div>
          {change != null && changePct != null && (
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: t.secondaryText }}>
                Change (1D)
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color: priceColor }}>
                {change >= 0 ? "+" : ""}
                {formatPrice(change, data?.info.currency)}{" "}
                ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </p>
            </div>
          )}
          {data?.info.market_cap != null && (
            <div className="ml-auto text-right">
              <p className="text-xs uppercase tracking-wider" style={{ color: t.secondaryText }}>
                Market Cap
              </p>
              <p className="mt-0.5 text-lg font-semibold" style={{ color: t.secondaryText }}>
                {formatLarge(data.info.market_cap)}
              </p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="px-2 pb-4" style={{ height: 280 }}>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2"
                style={{ borderColor: `${t.line}33`, borderTopColor: t.line }}
              />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-sm" style={{ color: t.negative }}>
                {error}
              </p>
              {!isAuthed && (
                <button
                  type="button"
                  onClick={() => setShowSignupModal(true)}
                  className="rounded-full px-4 py-2 text-xs font-semibold"
                  style={{ background: t.line, color: "#fff" }}
                >
                  Sign in to try a different ticker
                </button>
              )}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm" style={{ color: t.secondaryText }}>
                No chart data available
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${theme}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={t.line} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={t.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={t.grid} strokeWidth={0.5} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                  tick={{ fill: t.axisText, fontSize: 11 }}
                  tickFormatter={formatShortDate}
                />
                <YAxis
                  domain={[yMin ?? "auto", yMax ?? "auto"]}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tick={{ fill: t.axisText, fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: data?.info.currency ?? "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(v)
                  }
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      theme={theme}
                      currency={data?.info.currency ?? "USD"}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={t.areaStroke}
                  strokeWidth={2}
                  fill={`url(#grad-${theme})`}
                  dot={false}
                  activeDot={{ r: 4, fill: t.line, stroke: t.bg, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ticker tape at bottom */}
        <div
          className="flex flex-wrap gap-x-6 gap-y-1 overflow-hidden px-6 py-3 text-xs"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          {[
            { label: "P/E", value: data?.info.pe_ratio?.toFixed(2) ?? "—" },
            { label: "Div Yield", value: data?.info.dividend_yield != null ? `${(data.info.dividend_yield * 100).toFixed(2)}%` : "—" },
            { label: "Sector", value: data?.info.sector ?? "—" },
            { label: "Industry", value: data?.info.industry ?? "—" },
          ].map(({ label, value }) => (
            <span key={label} style={{ color: t.secondaryText }}>
              <span className="font-semibold" style={{ color: t.primaryText }}>
                {label}:
              </span>{" "}
              {value}
            </span>
          ))}
        </div>
      </div>

      {/* ── Financial statements ─────────────────────────── */}
      <LockGate
        theme={theme}
        onUnlock={() => setShowSignupModal(true)}
        locked={!isAuthed}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <FinancialTable
            rows={data?.income_statement ?? []}
            theme={theme}
            title="Income Statement"
          />
          <FinancialTable
            rows={data?.balance_sheet ?? []}
            theme={theme}
            title="Balance Sheet"
          />
        </div>
      </LockGate>

      {/* ── Sign-in CTA (when not authed) ────────────────── */}
      {!isAuthed && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center"
          style={{ background: t.cardBg, border: `1px solid ${t.border}` }}
        >
          <div
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: t.line }}
          >
            Free · No credit card
          </div>
          <h3 className="text-xl font-bold" style={{ color: t.primaryText }}>
            Search any ticker and unlock financials
          </h3>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: t.secondaryText }}>
            Sign in with Google to search any stock, ETF, or index, adjust time ranges from 7 to 60 days,
            and view annual income statements and balance sheets — all free.
          </p>
          <GoogleAuthButton
            onSuccess={async (response: CredentialResponse) => {
              if (!response.credential) return;
              try {
                const res = await googleLogin(response.credential);
                login(res.data.access_token, res.data.user);
              } catch {
                /* handled silently; user can retry */
              }
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
