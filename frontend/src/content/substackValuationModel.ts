/**
 * Valuation model for the Substack Valuation Tool (/tools/substack-valuation-calculator).
 *
 * The model is a revenue-multiple valuation. It starts from annual recurring
 * revenue, applies a base newsletter multiple, then adjusts that multiple by
 * four independent factors:
 *
 *   1. Geography  — audience ability-to-pay, derived from GDP per capita.
 *   2. Niche      — how the public market prices the equivalent sector.
 *   3. Retention  — churn, expressed as implied subscriber lifetime.
 *   4. Scale      — the size premium larger revenue bases attract.
 *   5. Growth     — what a buyer pays for a list that is still compounding.
 *
 * Every factor is a multiplier centred on 1.0, and every factor is raised to a
 * user-controlled weight so a reader who disagrees with one input can dial it
 * out entirely (weight 0) rather than being stuck with our opinion.
 *
 * All figures here are documented public estimates, not live data. They are
 * deliberately kept in one file so they can be refreshed in one place.
 */

// ─── Reference data ──────────────────────────────────────────────────────────

/** Approximate nominal GDP per capita in USD (World Bank / IMF, 2024 estimates). */
export type CountryRef = {
  code: string;
  name: string;
  gdpPerCapita: number;
};

export const COUNTRIES: CountryRef[] = [
  { code: "US", name: "United States", gdpPerCapita: 86600 },
  { code: "CH", name: "Switzerland", gdpPerCapita: 106000 },
  { code: "IE", name: "Ireland", gdpPerCapita: 107000 },
  { code: "SG", name: "Singapore", gdpPerCapita: 92900 },
  { code: "NO", name: "Norway", gdpPerCapita: 90000 },
  { code: "NL", name: "Netherlands", gdpPerCapita: 70300 },
  { code: "AU", name: "Australia", gdpPerCapita: 65000 },
  { code: "SE", name: "Sweden", gdpPerCapita: 58500 },
  { code: "DE", name: "Germany", gdpPerCapita: 55900 },
  { code: "CA", name: "Canada", gdpPerCapita: 54300 },
  { code: "GB", name: "United Kingdom", gdpPerCapita: 52400 },
  { code: "AE", name: "United Arab Emirates", gdpPerCapita: 49500 },
  { code: "FR", name: "France", gdpPerCapita: 46800 },
  { code: "IT", name: "Italy", gdpPerCapita: 39600 },
  { code: "KR", name: "South Korea", gdpPerCapita: 36100 },
  { code: "ES", name: "Spain", gdpPerCapita: 36200 },
  { code: "JP", name: "Japan", gdpPerCapita: 32900 },
  { code: "PL", name: "Poland", gdpPerCapita: 25000 },
  { code: "TR", name: "Turkey", gdpPerCapita: 15700 },
  { code: "RU", name: "Russia", gdpPerCapita: 14800 },
  { code: "MX", name: "Mexico", gdpPerCapita: 14600 },
  { code: "CN", name: "China", gdpPerCapita: 13700 },
  { code: "AR", name: "Argentina", gdpPerCapita: 13000 },
  { code: "BR", name: "Brazil", gdpPerCapita: 10300 },
  { code: "ZA", name: "South Africa", gdpPerCapita: 6400 },
  { code: "ID", name: "Indonesia", gdpPerCapita: 5000 },
  { code: "VN", name: "Vietnam", gdpPerCapita: 4700 },
  { code: "PH", name: "Philippines", gdpPerCapita: 4200 },
  { code: "EG", name: "Egypt", gdpPerCapita: 3500 },
  { code: "IN", name: "India", gdpPerCapita: 2900 },
  { code: "KE", name: "Kenya", gdpPerCapita: 2200 },
  { code: "NG", name: "Nigeria", gdpPerCapita: 1600 },
  { code: "PK", name: "Pakistan", gdpPerCapita: 1600 },
  // Catch-all so an audience mix can always total 100%.
  { code: "XX", name: "Rest of world (blended)", gdpPerCapita: 13500 },
];

export const US_GDP_PER_CAPITA = 86600;

/**
 * Price-to-sales ratios for the listed sector that most closely matches each
 * newsletter niche, against the S&P 500 blended P/S. Approximate 2025 levels.
 */
export type NicheRef = {
  id: string;
  name: string;
  /** The listed sector used as the pricing proxy. */
  proxySector: string;
  priceToSales: number;
};

export const MARKET_PRICE_TO_SALES = 3.1;

export const NICHES: NicheRef[] = [
  { id: "ai", name: "AI & data", proxySector: "S&P 500 Information Technology", priceToSales: 10.5 },
  { id: "tech", name: "Tech & software", proxySector: "S&P 500 Software", priceToSales: 9.8 },
  { id: "crypto", name: "Crypto & web3", proxySector: "Listed crypto financials", priceToSales: 8.0 },
  { id: "realestate", name: "Real estate", proxySector: "S&P 500 Real Estate", priceToSales: 7.5 },
  { id: "health", name: "Health & biotech", proxySector: "S&P 500 Pharma & Biotech", priceToSales: 4.5 },
  { id: "media", name: "Media & culture", proxySector: "S&P 500 Communication Services", priceToSales: 4.2 },
  { id: "finance", name: "Finance & investing", proxySector: "S&P 500 Financials", priceToSales: 3.6 },
  { id: "education", name: "Education & careers", proxySector: "Listed education / edtech", priceToSales: 3.0 },
  { id: "utilities", name: "Climate & utilities", proxySector: "S&P 500 Utilities", priceToSales: 2.9 },
  { id: "business", name: "Business & marketing", proxySector: "S&P 500 Industrials", priceToSales: 2.8 },
  { id: "sports", name: "Sports", proxySector: "Listed sports media", priceToSales: 2.6 },
  { id: "consumer", name: "Consumer & lifestyle", proxySector: "S&P 500 Consumer Discretionary", priceToSales: 2.4 },
  { id: "politics", name: "Politics & news", proxySector: "Listed news publishers", priceToSales: 1.8 },
  { id: "materials", name: "Science & materials", proxySector: "S&P 500 Materials", priceToSales: 1.7 },
  { id: "fiction", name: "Fiction & writing", proxySector: "Listed book publishers", priceToSales: 1.5 },
  { id: "food", name: "Food & cooking", proxySector: "S&P 500 Consumer Staples", priceToSales: 1.4 },
  { id: "energy", name: "Energy", proxySector: "S&P 500 Energy", priceToSales: 1.3 },
];

/** Median revenue multiple paid for small subscription-media businesses. */
export const BASE_REVENUE_MULTIPLE = 3.2;

/**
 * Hard band on the final multiple. Five multiplicative factors compound without
 * limit — an exceptional newsletter can otherwise come out at 15x or 20x ARR,
 * which no real buyer pays. Observed subscription-media deals essentially never
 * settle outside this range, so the band is applied last and reported when it
 * binds rather than silently swallowing the excess.
 */
export const MIN_REVENUE_MULTIPLE = 0.8;
export const MAX_REVENUE_MULTIPLE = 8.0;

/** Monthly churn a typical paid newsletter runs at, used as the retention benchmark. */
export const BENCHMARK_MONTHLY_CHURN = 3.5;

/** Monthly net paid growth a typical healthy newsletter runs at. */
export const BENCHMARK_MONTHLY_GROWTH = 2.0;

/** ARR at which the scale multiplier is exactly 1.0. */
export const SCALE_PIVOT_ARR = 250_000;

/**
 * Dampening exponents. Raw ratios swing far too hard to be credible on their
 * own — a reader in India still pays the same USD price as a reader in Oslo,
 * and a niche does not become worth 8x another just because its listed proxy
 * trades there. These compress each raw ratio toward 1.0 before weighting.
 */
export const GEO_DAMPENING = 0.35;
export const NICHE_DAMPENING = 0.5;
export const RETENTION_DAMPENING = 0.5;
export const GROWTH_DAMPENING = 0.6;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export type AudienceSlice = {
  /** Country code from COUNTRIES. */
  code: string;
  /** Share of the paid list, in percent. Shares are normalised before use. */
  share: number;
};

export type FactorWeights = {
  geography: number;
  niche: number;
  retention: number;
  scale: number;
  growth: number;
};

export type ValuationInputs = {
  paidSubscribers: number;
  freeSubscribers: number;
  monthlyPrice: number;
  annualShare: number;
  annualDiscount: number;
  monthlyChurn: number;
  monthlyGrowthRate: number;
  sponsorshipRevenuePerMonth: number;
  nicheId: string;
  audience: AudienceSlice[];
  weights: FactorWeights;
};

export const DEFAULT_WEIGHTS: FactorWeights = {
  geography: 1,
  niche: 1,
  retention: 1,
  scale: 1,
  growth: 1,
};

export const DEFAULT_INPUTS: ValuationInputs = {
  paidSubscribers: 850,
  freeSubscribers: 24000,
  monthlyPrice: 10,
  annualShare: 40,
  annualDiscount: 20,
  monthlyChurn: 3.5,
  monthlyGrowthRate: 2.5,
  sponsorshipRevenuePerMonth: 1200,
  nicheId: "finance",
  audience: [
    { code: "US", share: 55 },
    { code: "GB", share: 12 },
    { code: "CA", share: 8 },
    { code: "IN", share: 7 },
    { code: "AU", share: 5 },
    { code: "DE", share: 4 },
    { code: "XX", share: 9 },
  ],
  weights: DEFAULT_WEIGHTS,
};

// ─── Output ──────────────────────────────────────────────────────────────────

export type Factor = {
  key: keyof FactorWeights;
  label: string;
  /** The undampened, unweighted ratio — what the raw data says. */
  rawRatio: number;
  /** After dampening and weighting: what actually hits the multiple. */
  applied: number;
  detail: string;
};

export type ValuationResult = {
  subscriptionArr: number;
  sponsorshipArr: number;
  arr: number;
  mrr: number;
  baseMultiple: number;
  /** What the five factors produced before the sanity band was applied. */
  unboundedMultiple: number;
  finalMultiple: number;
  /** True when the sanity band actually bit, so the UI can say so. */
  multipleClamped: boolean;
  valuation: number;
  low: number;
  high: number;
  factors: Factor[];
  weightedGdpPerCapita: number;
  impliedLifetimeMonths: number;
  revenuePerSubscriber: number;
  /** Log-space standard deviation driving the distribution chart. */
  sigma: number;
};

// ─── Math ────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safe(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function normaliseAudience(audience: AudienceSlice[]): AudienceSlice[] {
  const total = audience.reduce((sum, slice) => sum + Math.max(slice.share, 0), 0);
  if (total <= 0) return [{ code: "US", share: 100 }];
  return audience.map((slice) => ({
    code: slice.code,
    share: (Math.max(slice.share, 0) / total) * 100,
  }));
}

export function gdpPerCapitaFor(code: string): number {
  return COUNTRIES.find((country) => country.code === code)?.gdpPerCapita ?? US_GDP_PER_CAPITA;
}

export function nicheFor(id: string): NicheRef {
  return NICHES.find((niche) => niche.id === id) ?? NICHES[0];
}

export function computeValuation(inputs: ValuationInputs): ValuationResult {
  const {
    paidSubscribers,
    monthlyPrice,
    annualShare,
    annualDiscount,
    monthlyChurn,
    monthlyGrowthRate,
    sponsorshipRevenuePerMonth,
    nicheId,
    audience,
    weights,
  } = inputs;

  // ── Revenue ──
  // Annual plans are discounted, so blended revenue per subscriber sits below
  // list price whenever any share of the list is on an annual plan.
  const annualFraction = clamp(annualShare, 0, 100) / 100;
  const discountFraction = clamp(annualDiscount, 0, 100) / 100;
  const monthlyPlanSubs = paidSubscribers * (1 - annualFraction);
  const annualPlanSubs = paidSubscribers * annualFraction;
  const annualPlanMonthlyEquivalent = monthlyPrice * (1 - discountFraction);

  const subscriptionMrr =
    monthlyPlanSubs * monthlyPrice + annualPlanSubs * annualPlanMonthlyEquivalent;
  const subscriptionArr = subscriptionMrr * 12;
  const sponsorshipArr = Math.max(sponsorshipRevenuePerMonth, 0) * 12;
  const arr = subscriptionArr + sponsorshipArr;
  const mrr = arr / 12;

  // ── Factor 1: geography ──
  // Weight each country's GDP per capita by its share of the paid list, then
  // compare against the US benchmark. Dampened because a subscriber in a
  // lower-GDP country still pays the newsletter's USD list price; GDP shifts
  // the odds they subscribe at all, not the price they pay once they do.
  const normalised = normaliseAudience(audience);
  const weightedGdpPerCapita = normalised.reduce(
    (sum, slice) => sum + (slice.share / 100) * gdpPerCapitaFor(slice.code),
    0
  );
  const geoRaw = safe(weightedGdpPerCapita / US_GDP_PER_CAPITA, 1);
  const geoDamped = Math.pow(clamp(geoRaw, 0.05, 3), GEO_DAMPENING);
  const geoApplied = Math.pow(geoDamped, clamp(weights.geography, 0, 2));

  // ── Factor 2: niche ──
  // Public markets already price every category. Use the listed proxy sector's
  // price-to-sales against the index's, dampened so a hot sector tilts the
  // valuation without dominating it.
  const niche = nicheFor(nicheId);
  const nicheRaw = safe(niche.priceToSales / MARKET_PRICE_TO_SALES, 1);
  const nicheDamped = Math.pow(clamp(nicheRaw, 0.1, 5), NICHE_DAMPENING);
  const nicheApplied = Math.pow(nicheDamped, clamp(weights.niche, 0, 2));

  // ── Factor 3: retention ──
  // Churn is the single strongest driver of what an acquirer will pay, because
  // it sets how long the revenue they are buying actually lasts.
  const churn = clamp(monthlyChurn, 0.1, 50);
  const impliedLifetimeMonths = 100 / churn;
  const retentionRaw = safe(BENCHMARK_MONTHLY_CHURN / churn, 1);
  const retentionDamped = clamp(
    Math.pow(clamp(retentionRaw, 0.1, 6), RETENTION_DAMPENING),
    0.5,
    1.8
  );
  const retentionApplied = Math.pow(retentionDamped, clamp(weights.retention, 0, 2));

  // ── Factor 4: scale ──
  // Larger revenue bases sell for higher multiples: less key-person risk, more
  // buyers able to write the cheque. Log-scaled so each 10x of ARR adds a
  // comparable step rather than running away.
  const scaleRaw =
    arr > 0 ? clamp(1 + 0.22 * Math.log10(arr / SCALE_PIVOT_ARR), 0.65, 1.7) : 0.65;
  const scaleApplied = Math.pow(scaleRaw, clamp(weights.scale, 0, 2));

  // ── Factor 5: growth ──
  // A list still compounding is worth more than a flat one of the same size,
  // because the buyer is purchasing next year's revenue, not last year's.
  const growth = clamp(monthlyGrowthRate, -20, 30);
  const annualGrowth = Math.pow(1 + growth / 100, 12) - 1;
  const benchmarkAnnualGrowth = Math.pow(1 + BENCHMARK_MONTHLY_GROWTH / 100, 12) - 1;
  const growthRaw = safe((1 + annualGrowth) / (1 + benchmarkAnnualGrowth), 1);
  const growthDamped = clamp(
    Math.pow(clamp(growthRaw, 0.1, 5), GROWTH_DAMPENING),
    0.55,
    1.9
  );
  const growthApplied = Math.pow(growthDamped, clamp(weights.growth, 0, 2));

  const unboundedMultiple =
    BASE_REVENUE_MULTIPLE *
    geoApplied *
    nicheApplied *
    retentionApplied *
    scaleApplied *
    growthApplied;
  const finalMultiple = clamp(
    unboundedMultiple,
    MIN_REVENUE_MULTIPLE,
    MAX_REVENUE_MULTIPLE
  );
  const multipleClamped =
    Math.abs(finalMultiple - unboundedMultiple) / Math.max(unboundedMultiple, 1e-9) > 1e-6;
  const valuation = arr * finalMultiple;

  // ── Uncertainty ──
  // Small, high-churn, sponsorship-dependent businesses have wider outcomes.
  const churnPenalty = clamp((churn - BENCHMARK_MONTHLY_CHURN) / 20, 0, 0.2);
  const sizePenalty = arr > 0 ? clamp(0.16 - 0.03 * Math.log10(arr / 25_000), 0, 0.18) : 0.18;
  const concentrationPenalty = arr > 0 ? clamp((sponsorshipArr / arr) * 0.18, 0, 0.18) : 0;
  const sigma = clamp(0.26 + churnPenalty + sizePenalty + concentrationPenalty, 0.2, 0.75);

  const factors: Factor[] = [
    {
      key: "geography",
      label: "Geography",
      rawRatio: geoRaw,
      applied: geoApplied,
      detail: `Weighted audience GDP per capita of $${Math.round(
        weightedGdpPerCapita
      ).toLocaleString("en-US")} against the US benchmark of $${US_GDP_PER_CAPITA.toLocaleString(
        "en-US"
      )}.`,
    },
    {
      key: "niche",
      label: "Niche",
      rawRatio: nicheRaw,
      applied: nicheApplied,
      detail: `${niche.name} priced off ${niche.proxySector} at ${niche.priceToSales.toFixed(
        1
      )}x sales versus the market at ${MARKET_PRICE_TO_SALES.toFixed(1)}x.`,
    },
    {
      key: "retention",
      label: "Retention",
      rawRatio: retentionRaw,
      applied: retentionApplied,
      detail: `${churn.toFixed(1)}% monthly churn implies a ${impliedLifetimeMonths.toFixed(
        0
      )}-month subscriber lifetime against a ${BENCHMARK_MONTHLY_CHURN}% benchmark.`,
    },
    {
      key: "scale",
      label: "Scale",
      rawRatio: scaleRaw,
      applied: scaleApplied,
      detail: `${
        arr >= SCALE_PIVOT_ARR ? "Above" : "Below"
      } the $${SCALE_PIVOT_ARR.toLocaleString("en-US")} ARR pivot where the size premium is neutral.`,
    },
    {
      key: "growth",
      label: "Growth",
      rawRatio: growthRaw,
      applied: growthApplied,
      detail: `${growth.toFixed(1)}% monthly growth compounds to ${(annualGrowth * 100).toFixed(
        0
      )}% a year against a ${(benchmarkAnnualGrowth * 100).toFixed(0)}% benchmark.`,
    },
  ];

  return {
    subscriptionArr,
    sponsorshipArr,
    arr,
    mrr,
    baseMultiple: BASE_REVENUE_MULTIPLE,
    unboundedMultiple,
    finalMultiple,
    multipleClamped,
    valuation,
    low: valuation * Math.exp(-1.2816 * sigma),
    high: valuation * Math.exp(1.2816 * sigma),
    factors,
    weightedGdpPerCapita,
    impliedLifetimeMonths,
    revenuePerSubscriber: paidSubscribers > 0 ? arr / paidSubscribers : 0,
    sigma,
  };
}

// ─── Distribution for the bell curve ─────────────────────────────────────────

export type DistributionPoint = {
  valuation: number;
  density: number;
  /** Density repeated only inside the P10–P90 band, so it can be shaded. */
  bandDensity: number | null;
};

/**
 * Lognormal probability density across the plausible valuation range. Lognormal
 * rather than normal because valuations cannot go below zero and the upside
 * tail is genuinely longer than the downside one.
 */
export function buildDistribution(
  median: number,
  sigma: number,
  points = 96
): { curve: DistributionPoint[]; p10: number; p50: number; p90: number } {
  if (!(median > 0) || !(sigma > 0)) {
    return { curve: [], p10: 0, p50: 0, p90: 0 };
  }

  const mu = Math.log(median);
  const lo = mu - 3.2 * sigma;
  const hi = mu + 3.2 * sigma;
  const p10 = Math.exp(mu - 1.2816 * sigma);
  const p90 = Math.exp(mu + 1.2816 * sigma);

  const curve: DistributionPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const logX = lo + ((hi - lo) * i) / (points - 1);
    const x = Math.exp(logX);
    // Density in log-space keeps the curve visually symmetric (a true bell)
    // while the axis still reads in dollars.
    const density =
      Math.exp(-((logX - mu) ** 2) / (2 * sigma ** 2)) / (sigma * Math.sqrt(2 * Math.PI));
    curve.push({
      valuation: x,
      density,
      bandDensity: x >= p10 && x <= p90 ? density : null,
    });
  }

  return { curve, p10, p50: median, p90 };
}

// ─── Bridge chart data ───────────────────────────────────────────────────────

export type BridgeStep = {
  label: string;
  /** Invisible offset that floats the visible bar to the right height. */
  base: number;
  /** Height of the visible bar. */
  delta: number;
  /** Running valuation after this step. */
  running: number;
  direction: "start" | "up" | "down" | "total";
};

/**
 * Waterfall from "ARR at the base multiple" to the final valuation, one bar per
 * factor, so the contribution of each adjustment is legible at a glance.
 */
export function buildBridge(result: ValuationResult): BridgeStep[] {
  const start = result.arr * result.baseMultiple;
  const steps: BridgeStep[] = [
    {
      label: `Base ${result.baseMultiple.toFixed(1)}x ARR`,
      base: 0,
      delta: start,
      running: start,
      direction: "start",
    },
  ];

  let running = start;
  for (const factor of result.factors) {
    const next = running * factor.applied;
    const delta = next - running;
    steps.push({
      label: factor.label,
      base: Math.min(running, next),
      delta: Math.abs(delta),
      running: next,
      direction: delta >= 0 ? "up" : "down",
    });
    running = next;
  }

  // When the sanity band bites, show it as its own step. Otherwise the bars
  // would walk to a total the headline figure does not agree with.
  if (result.multipleClamped) {
    const capped = result.valuation;
    const delta = capped - running;
    steps.push({
      label: `Capped at ${result.finalMultiple.toFixed(1)}x`,
      base: Math.min(running, capped),
      delta: Math.abs(delta),
      running: capped,
      direction: delta >= 0 ? "up" : "down",
    });
    running = capped;
  }

  steps.push({
    label: "Valuation",
    base: 0,
    delta: running,
    running,
    direction: "total",
  });

  return steps;
}
