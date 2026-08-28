import { useEffect, useMemo, useRef, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";
import { googleLogin } from "../../api/client";
import GoogleAuthButton from "../public/GoogleAuthButton";
import {
  BASE_REVENUE_MULTIPLE,
  COUNTRIES,
  DEFAULT_INPUTS,
  MARKET_PRICE_TO_SALES,
  MAX_REVENUE_MULTIPLE,
  MIN_REVENUE_MULTIPLE,
  NICHES,
  US_GDP_PER_CAPITA,
  buildBridge,
  buildDistribution,
  computeValuation,
  nicheFor,
  normaliseAudience,
  type AudienceSlice,
  type FactorWeights,
  type ValuationInputs,
} from "../../content/substackValuationModel";

// Validated against the white page surface with scripts/validate_palette.js —
// all checks pass on the all-pairs list. Do not substitute by eye.
const INK = "#0b0b0b";
const MUTED = "#898781";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const SERIES_BASE = "#7c3aed";
const SERIES_UP = "#0d9488";
const SERIES_DOWN = "#d97706";

// ─── Formatting ──────────────────────────────────────────────────────────────

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function usdCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function num(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function multiple(value: number) {
  return `${value.toFixed(2)}x`;
}

function signedPercent(value: number) {
  const pct = (value - 1) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

// ─── Small UI primitives ─────────────────────────────────────────────────────

function fieldClass() {
  return "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200";
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
      </div>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          className={`${fieldClass()} ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""}`}
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const tone = value === 0 ? "Ignored" : value < 0.9 ? "Muted" : value > 1.1 ? "Amplified" : "Normal";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-xs font-medium tabular-nums text-purple-700">
          {value.toFixed(1)}x · {tone}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-purple-600"
        aria-label={`${label} weight`}
      />
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-gray-400">
        <span>Off</span>
        <span>Normal</span>
        <span>Double</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  emphasis = false,
}: {
  label: string;
  value: string;
  helper?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-2xl border border-purple-200 bg-purple-50/60 p-5"
          : "rounded-2xl border border-gray-200 bg-white p-5"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      {helper ? <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{helper}</p> : null}
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

type CurveDatum = {
  valuation: number;
  density: number;
  bandDensity: number | null;
};

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CurveDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold tabular-nums text-gray-900">{usd(point.valuation)}</p>
      <p className="mt-0.5 text-xs text-gray-500">Relative likelihood of this outcome</p>
    </div>
  );
}

function ValuationDistributionChart({
  median,
  sigma,
}: {
  median: number;
  sigma: number;
}) {
  const { curve, p10, p90 } = useMemo(
    () => buildDistribution(median, sigma),
    [median, sigma]
  );

  if (!curve.length) return null;

  return (
    <figure className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <figcaption className="mb-1">
        <h3 className="text-base font-semibold text-gray-900">
          Where your valuation is likely to land
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          A valuation is a range, not a number. The shaded band is the middle 80% of plausible
          outcomes — the tails are what a hard negotiation looks like in either direction.
        </p>
      </figcaption>

      <div className="mt-5 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curve} margin={{ top: 24, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="valuation"
              type="number"
              scale="log"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => usdCompact(value)}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: AXIS }}
              tickMargin={8}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              content={<DistributionTooltip />}
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
            />
            <Area
              dataKey="bandDensity"
              stroke="none"
              fill={SERIES_BASE}
              fillOpacity={0.16}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              dataKey="density"
              stroke={SERIES_BASE}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine
              x={p10}
              stroke={AXIS}
              strokeDasharray="4 4"
              label={{
                value: `P10 ${usdCompact(p10)}`,
                position: "insideTopLeft",
                fill: MUTED,
                fontSize: 11,
              }}
            />
            <ReferenceLine
              x={median}
              stroke={SERIES_BASE}
              strokeWidth={2}
              label={{
                value: `Estimate ${usdCompact(median)}`,
                position: "top",
                fill: INK,
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <ReferenceLine
              x={p90}
              stroke={AXIS}
              strokeDasharray="4 4"
              label={{
                value: `P90 ${usdCompact(p90)}`,
                position: "insideTopRight",
                fill: MUTED,
                fontSize: 11,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

type BridgeDatum = {
  label: string;
  base: number;
  delta: number;
  running: number;
  direction: "start" | "up" | "down" | "total";
};

function BridgeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: BridgeDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const verb =
    point.direction === "up" ? "adds" : point.direction === "down" ? "removes" : "sets";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">{point.label}</p>
      <p className="mt-0.5 text-xs text-gray-600">
        {point.direction === "start" || point.direction === "total"
          ? `${verb} ${usd(point.running)}`
          : `${verb} ${usd(point.delta)}`}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-gray-500">
        Running total {usd(point.running)}
      </p>
    </div>
  );
}

function barColor(direction: BridgeDatum["direction"]) {
  if (direction === "up") return SERIES_UP;
  if (direction === "down") return SERIES_DOWN;
  return SERIES_BASE;
}

function ValuationBridgeChart({ steps }: { steps: BridgeDatum[] }) {
  return (
    <figure className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <figcaption className="mb-1">
        <h3 className="text-base font-semibold text-gray-900">
          How each factor moves the number
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          Starting from your ARR at the base {BASE_REVENUE_MULTIPLE.toFixed(1)}x multiple, each
          adjustment either adds to or takes from the valuation.
        </p>
      </figcaption>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_BASE }} />
          Anchor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_UP }} />
          Adds value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_DOWN }} />
          Removes value
        </span>
      </div>

      <div className="mt-4 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 24, right: 12, bottom: 8, left: 4 }} barGap={2}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: AXIS }}
              tickMargin={8}
              interval={0}
            />
            <YAxis
              tickFormatter={(value: number) => usdCompact(value)}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip content={<BridgeTooltip />} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
            {/* Transparent riser floats each bar to its running height. */}
            <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="delta" stackId="bridge" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {steps.map((step) => (
                <Cell key={step.label} fill={barColor(step.direction)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

// ─── Soft auth gate ──────────────────────────────────────────────────────────
// The whole input panel stays open to anonymous visitors — they can model the
// business freely. Sign-in is only demanded at the moment they ask for the
// answer, which is also the moment the tool has proved it is worth an account.

function SignInPrompt({ onCancel }: { onCancel: () => void }) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    setError(null);
    try {
      const res = await googleLogin(
        response.credential,
        false,
        localStorage.getItem("b2v_ref_code")
      );
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user, { createdNewUser: res.data.created_new_user, metaEventId: res.data.meta_event_id });
      // login() flips `user`; the parent watches for that and runs the analysis.
    } catch {
      setError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  return (
    <div className="rounded-3xl border border-purple-200 bg-gradient-to-b from-purple-50 via-white to-white p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white shadow-sm">
        <svg
          className="h-6 w-6 text-purple-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-gray-900">Your valuation is ready</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600">
        Sign in to see the full breakdown — headline valuation, the P10–P90 range, the factor
        bridge, and every assumption behind the number. Free account, no credit card.
      </p>
      <div className="mt-7 flex justify-center">
        {signingIn ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Signing you in…
          </div>
        ) : (
          <GoogleAuthButton
            onSuccess={handleSuccess}
            onError={() => setError("Sign-in failed. Please try again.")}
            text="continue_with"
            width="320"
          />
        )}
      </div>
      {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}
      <button
        type="button"
        onClick={onCancel}
        className="mt-5 text-xs font-medium text-gray-500 underline underline-offset-4 transition hover:text-gray-700"
      >
        Keep editing my inputs
      </button>
    </div>
  );
}

// ─── Audience mix editor ─────────────────────────────────────────────────────

function AudienceEditor({
  audience,
  onChange,
}: {
  audience: AudienceSlice[];
  onChange: (next: AudienceSlice[]) => void;
}) {
  const total = audience.reduce((sum, slice) => sum + Math.max(slice.share, 0), 0);
  const unused = COUNTRIES.filter(
    (country) => !audience.some((slice) => slice.code === country.code)
  );

  const update = (index: number, patch: Partial<AudienceSlice>) => {
    onChange(audience.map((slice, i) => (i === index ? { ...slice, ...patch } : slice)));
  };

  return (
    <div>
      <div className="space-y-2">
        {audience.map((slice, index) => {
          const country = COUNTRIES.find((entry) => entry.code === slice.code);
          return (
            <div key={`${slice.code}-${index}`} className="flex items-center gap-2">
              <select
                className={`${fieldClass()} flex-1`}
                value={slice.code}
                onChange={(event) => update(index, { code: event.target.value })}
                aria-label="Country"
              >
                {COUNTRIES.map((country) => (
                  <option
                    key={country.code}
                    value={country.code}
                    disabled={
                      country.code !== slice.code &&
                      audience.some((entry) => entry.code === country.code)
                    }
                  >
                    {country.name}
                  </option>
                ))}
              </select>
              <div className="relative w-24 shrink-0">
                <input
                  type="number"
                  className={`${fieldClass()} pr-7 text-right`}
                  value={slice.share}
                  min={0}
                  max={100}
                  onChange={(event) =>
                    update(index, { share: Math.max(Number(event.target.value) || 0, 0) })
                  }
                  aria-label={`${country?.name ?? "Country"} share of paid list`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange(audience.filter((_, i) => i !== index))}
                disabled={audience.length <= 1}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove ${country?.name ?? "country"}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {unused.length ? (
          <button
            type="button"
            onClick={() => onChange([...audience, { code: unused[0].code, share: 5 }])}
            className="text-sm font-semibold text-purple-700 transition hover:text-purple-900"
          >
            + Add country
          </button>
        ) : (
          <span />
        )}
        <span
          className={`text-xs tabular-nums ${
            Math.abs(total - 100) < 0.5 ? "text-gray-500" : "text-amber-700"
          }`}
        >
          {total.toFixed(0)}% entered
          {Math.abs(total - 100) < 0.5 ? "" : " — shares are normalised to 100%"}
        </span>
      </div>
    </div>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export default function SubstackValuationTool() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState<ValuationInputs>(DEFAULT_INPUTS);
  const [analysed, setAnalysed] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const result = useMemo(() => computeValuation(inputs), [inputs]);
  const bridge = useMemo(() => buildBridge(result), [result]);
  const niche = nicheFor(inputs.nicheId);
  const normalisedAudience = useMemo(
    () => normaliseAudience(inputs.audience),
    [inputs.audience]
  );

  const set = <K extends keyof ValuationInputs>(key: K, value: ValuationInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const setWeight = (key: keyof FactorWeights, value: number) =>
    setInputs((prev) => ({ ...prev, weights: { ...prev.weights, [key]: value } }));

  const handleAnalyse = () => {
    if (!user) {
      setAwaitingAuth(true);
      return;
    }
    setAnalysed(true);
  };

  // Once the visitor signs in from the prompt, run the analysis they asked for
  // rather than making them click Analyze a second time.
  useEffect(() => {
    if (user && awaitingAuth) {
      setAwaitingAuth(false);
      setAnalysed(true);
    }
  }, [user, awaitingAuth]);

  useEffect(() => {
    if (analysed) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [analysed]);

  return (
    <div className="space-y-8">
      {/* ── Inputs (always open, no sign-in required) ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            Size & revenue
          </h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <NumberField
              label="Paid subscribers"
              value={inputs.paidSubscribers}
              onChange={(value) => set("paidSubscribers", value)}
            />
            <NumberField
              label="Free subscribers"
              hint="Context only"
              value={inputs.freeSubscribers}
              onChange={(value) => set("freeSubscribers", value)}
            />
            <NumberField
              label="Monthly price"
              prefix="$"
              step={0.5}
              value={inputs.monthlyPrice}
              onChange={(value) => set("monthlyPrice", value)}
            />
            <NumberField
              label="Sponsorship revenue"
              hint="Per month"
              prefix="$"
              step={50}
              value={inputs.sponsorshipRevenuePerMonth}
              onChange={(value) => set("sponsorshipRevenuePerMonth", value)}
            />
            <NumberField
              label="On annual plans"
              suffix="%"
              max={100}
              value={inputs.annualShare}
              onChange={(value) => set("annualShare", value)}
            />
            <NumberField
              label="Annual discount"
              suffix="%"
              max={100}
              value={inputs.annualDiscount}
              onChange={(value) => set("annualDiscount", value)}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            Retention & category
          </h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <NumberField
              label="Monthly churn"
              hint="% of paid lost"
              suffix="%"
              step={0.1}
              max={50}
              value={inputs.monthlyChurn}
              onChange={(value) => set("monthlyChurn", value)}
            />
            <NumberField
              label="Monthly growth"
              hint="Net new paid"
              suffix="%"
              step={0.1}
              value={inputs.monthlyGrowthRate}
              onChange={(value) => set("monthlyGrowthRate", value)}
            />
          </div>

          <div className="mt-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-900">Niche</span>
              <select
                className={fieldClass()}
                value={inputs.nicheId}
                onChange={(event) => set("nicheId", event.target.value)}
              >
                {NICHES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Priced off <span className="font-medium text-gray-700">{niche.proxySector}</span> at{" "}
              <span className="tabular-nums">{niche.priceToSales.toFixed(1)}x</span> sales, against
              the market at <span className="tabular-nums">{MARKET_PRICE_TO_SALES.toFixed(1)}x</span>.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            Audience geography
          </h3>
          <p className="text-xs text-gray-500">
            Weighted GDP per capita{" "}
            <span className="font-semibold tabular-nums text-gray-900">
              {usd(result.weightedGdpPerCapita)}
            </span>{" "}
            vs US {usd(US_GDP_PER_CAPITA)}
          </p>
        </div>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
          Where your paid readers live changes what each one is worth to a buyer. Enter the split of
          your <em>paid</em> list — shares are normalised, so rough numbers are fine.
        </p>
        <div className="mt-5">
          <AudienceEditor
            audience={inputs.audience}
            onChange={(next) => set("audience", next)}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
          Factor weights
        </h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
          Disagree with one of the adjustments? Turn it down or off. Every factor is a multiplier on
          the base {BASE_REVENUE_MULTIPLE.toFixed(1)}x, and these sliders control how hard each one
          is allowed to push.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <WeightSlider
            label="Geography"
            description="How much audience ability-to-pay should move the multiple."
            value={inputs.weights.geography}
            onChange={(value) => setWeight("geography", value)}
          />
          <WeightSlider
            label="Niche"
            description="How much the listed sector's pricing should carry over."
            value={inputs.weights.niche}
            onChange={(value) => setWeight("niche", value)}
          />
          <WeightSlider
            label="Retention"
            description="How much churn should drive the multiple up or down."
            value={inputs.weights.retention}
            onChange={(value) => setWeight("retention", value)}
          />
          <WeightSlider
            label="Scale"
            description="How much the size premium on larger revenue should count."
            value={inputs.weights.scale}
            onChange={(value) => setWeight("scale", value)}
          />
          <WeightSlider
            label="Growth"
            description="How much a still-compounding list should be paid forward."
            value={inputs.weights.growth}
            onChange={(value) => setWeight("growth", value)}
          />
        </div>
      </section>

      {/* ── Analyze ── */}
      {!analysed ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={handleAnalyse}
            className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-700"
          >
            Analyze my valuation
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="text-xs text-gray-500">
            Free. Takes your inputs only — nothing is published anywhere.
          </p>
        </div>
      ) : null}

      {awaitingAuth ? <SignInPrompt onCancel={() => setAwaitingAuth(false)} /> : null}

      {/* ── Results ── */}
      {analysed ? (
        <div ref={resultsRef} className="space-y-6 scroll-mt-24">
          <div className="overflow-hidden rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-8 text-white sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
              Estimated valuation
            </p>
            <p className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
              {usd(result.valuation)}
            </p>
            <p className="mt-3 text-sm text-purple-100">
              Plausible range {usd(result.low)} – {usd(result.high)} · {multiple(result.finalMultiple)}{" "}
              on {usd(result.arr)} ARR
            </p>
            {result.multipleClamped ? (
              <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-xs leading-relaxed text-purple-50">
                Your inputs compounded to {multiple(result.unboundedMultiple)}, which is outside the{" "}
                {MIN_REVENUE_MULTIPLE.toFixed(1)}x–{MAX_REVENUE_MULTIPLE.toFixed(1)}x band that real
                subscription-media deals settle in. The multiple has been capped at{" "}
                {multiple(result.finalMultiple)}.
              </p>
            ) : null}
            <div className="mt-7 grid gap-4 border-t border-white/20 pt-6 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-200">Annual revenue</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{usd(result.arr)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-200">Final multiple</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {multiple(result.finalMultiple)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-200">
                  Revenue per paid subscriber
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {usd(result.revenuePerSubscriber)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Subscription ARR"
              value={usd(result.subscriptionArr)}
              helper={`${num(inputs.paidSubscribers)} paid subscribers, blended for annual plans.`}
            />
            <StatCard
              label="Sponsorship ARR"
              value={usd(result.sponsorshipArr)}
              helper={
                result.arr > 0
                  ? `${((result.sponsorshipArr / result.arr) * 100).toFixed(0)}% of revenue — buyers discount this more than subscriptions.`
                  : "No sponsorship revenue entered."
              }
            />
            <StatCard
              label="Subscriber lifetime"
              value={`${result.impliedLifetimeMonths.toFixed(0)} mo`}
              helper={`At ${inputs.monthlyChurn.toFixed(1)}% monthly churn.`}
            />
            <StatCard
              label="Base multiple"
              value={multiple(result.baseMultiple)}
              helper="Median revenue multiple for small subscription-media deals, before adjustments."
              emphasis
            />
          </div>

          <ValuationDistributionChart median={result.valuation} sigma={result.sigma} />

          <ValuationBridgeChart steps={bridge} />

          {/* Factor table — the numbers behind both charts. */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="text-base font-semibold text-gray-900">Factor detail</h3>
              <p className="mt-1 text-sm text-gray-500">
                What the raw data said, and what actually reached the multiple after dampening and
                your weights.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wider text-gray-500">
                    <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                      Factor
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Raw signal
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Weight
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Applied
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.factors.map((factor) => (
                    <tr key={factor.key} className="border-b border-gray-100 last:border-0">
                      <th scope="row" className="px-5 py-4 font-normal sm:px-6">
                        <span className="flex items-center gap-2 font-semibold text-gray-900">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                              background: factor.applied >= 1 ? SERIES_UP : SERIES_DOWN,
                            }}
                          />
                          {factor.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                          {factor.detail}
                        </span>
                      </th>
                      <td className="px-5 py-4 text-right tabular-nums text-gray-600">
                        {factor.rawRatio.toFixed(2)}x
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-gray-600">
                        {inputs.weights[factor.key].toFixed(1)}x
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900">
                        {factor.applied.toFixed(2)}x
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {signedPercent(factor.applied)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audience breakdown so the geography factor is auditable. */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900">Audience mix used</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {normalisedAudience.map((slice) => {
                const country = COUNTRIES.find((entry) => entry.code === slice.code);
                return (
                  <span
                    key={slice.code}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700"
                  >
                    <span className="font-semibold">{country?.name ?? slice.code}</span>
                    <span className="tabular-nums text-gray-500">{slice.share.toFixed(0)}%</span>
                    <span className="tabular-nums text-gray-400">
                      {usdCompact(country?.gdpPerCapita ?? 0)} GDP/capita
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAnalysed(false)}
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
            >
              Adjust assumptions
            </button>
            <button
              type="button"
              onClick={() => setInputs(DEFAULT_INPUTS)}
              className="text-sm font-medium text-gray-500 underline underline-offset-4 transition hover:text-gray-700"
            >
              Reset to defaults
            </button>
          </div>

          <p className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-xs leading-relaxed text-amber-900">
            <span className="font-semibold">This is a planning estimate, not an appraisal.</span>{" "}
            Real newsletter sales turn on things no model sees: whether the audience follows the
            writer or the publication, how transferable the voice is, sponsor relationships, and how
            many buyers are actually at the table. Use this to set a starting range and to see which
            inputs matter most — then get a real valuation before you sign anything.
          </p>
        </div>
      ) : null}
    </div>
  );
}
