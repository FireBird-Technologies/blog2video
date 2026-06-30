import { useState } from "react";
import LimitedSeatsBar from "./LimitedSeatsBar";
import {
  perUnitCents,
  totalCents,
  savingsCents,
  formatDollars,
  BASE_PRICE_CENTS,
  CASUAL_ZONE_END,
  PACK_ZONE_END,
  PACK_TIER_START_QTY,
  BULK_TIER_START_QTY,
  CASUAL_PRICE_CENTS,
  PACK_PRICE_CENTS,
  BULK_PRICE_CENTS,
} from "../lib/perVideoPricing";

type Variant = "compact" | "full";

interface Props {
  onBuy: (quantity: number) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  features?: string[];
  excludedFeatures?: string[];
  customButton?: React.ReactNode;
  /** When true, replaces the slider with a fixed "500 videos / $300" deal. */
  bulkDeal?: boolean;
  /** Buy handler for the bulk deal (only used when bulkDeal is true). */
  onBuyBulk?: () => void | Promise<void>;
  bulkLoading?: boolean;
}

// The $299.99 / 500-video credit pack (LIFETIME_DEAL_500). Credits never expire.
const BULK_DEAL_VIDEOS = 500;
const BULK_DEAL_PRICE = 299.99;

const DEFAULT_FEATURES = [
  "No subscription needed",
  "AI script generation",
  "ElevenLabs voiceover",
  "Render & download MP4",
];

const DEFAULT_EXCLUDED_FEATURES = [
  "Unlimited AI edit & image generation",
  "Custom video templates",
  "Premium voiceover + cloning",
];

function CheckMark() {
  return (
    <svg
      className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XMark() {
  return (
    <svg
      className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function PerVideoSliderCard({
  onBuy,
  loading = false,
  disabled = false,
  variant = "compact",
  features = DEFAULT_FEATURES,
  excludedFeatures = DEFAULT_EXCLUDED_FEATURES,
  customButton,
  bulkDeal = false,
  onBuyBulk,
  bulkLoading = false,
}: Props) {
  const [qty, setQty] = useState(1);
  const unit = perUnitCents(qty);
  const total = totalCents(qty);
  const saved = savingsCents(qty);

  // Slider with three equal zones, one per pricing tier. Each zone takes a
  // third of the width and maps to its tier's qty range. Aligns visually with
  // the tier strip above.
  //
  //   [ casual: pos 0..99 → qty 1..9 ] [ pack: 100..199 → 10..30 ] [ bulk: 200..300 → 31..100 ]
  //
  // High slider resolution (0..300) gives smooth pixel-by-pixel dragging.
  const SLIDER_RES = 300;
  const ZONE_RES = SLIDER_RES / 3;

  const sliderPosToQty = (pos: number): number => {
    const p = Math.max(0, Math.min(pos, SLIDER_RES));
    if (p < ZONE_RES) {
      // Casual: 1..9
      if (CASUAL_ZONE_END <= 1) return 1;
      return Math.round(1 + (p / ZONE_RES) * (CASUAL_ZONE_END - 1));
    }
    if (p < 2 * ZONE_RES) {
      // Pack: 10..30
      const t = (p - ZONE_RES) / ZONE_RES;
      return Math.round(PACK_TIER_START_QTY + t * (PACK_ZONE_END - PACK_TIER_START_QTY));
    }
    // Bulk: 31..100
    const t = (p - 2 * ZONE_RES) / ZONE_RES;
    return Math.round(BULK_TIER_START_QTY + t * (100 - BULK_TIER_START_QTY));
  };
  const qtyToSliderPos = (q: number): number => {
    if (q <= 1) return 0;
    if (q <= CASUAL_ZONE_END) {
      if (CASUAL_ZONE_END <= 1) return 0;
      // Map max casual qty to p < ZONE_RES so it does not round-trip into pack.
      return Math.round(((q - 1) / (CASUAL_ZONE_END - 1)) * (ZONE_RES - 1));
    }
    if (q <= PACK_ZONE_END) {
      const t = (q - PACK_TIER_START_QTY) / (PACK_ZONE_END - PACK_TIER_START_QTY);
      return Math.round(ZONE_RES + t * ZONE_RES);
    }
    const t = (Math.min(q, 100) - BULK_TIER_START_QTY) / (100 - BULK_TIER_START_QTY);
    return Math.round(2 * ZONE_RES + t * ZONE_RES);
  };
  const sliderPos = qtyToSliderPos(qty);

  // Each tier occupies exactly 1/3 of the slider width.
  // Pack tier spans the middle third — highlight that on the track.
  const flatPct = 100 / 3;
  const sweetPct = (100 / 3) * 2;
  const trackBackground =
    `linear-gradient(to right, ` +
    `rgb(243 232 255) 0%, ` +
    `rgb(243 232 255) ${flatPct}%, ` +
    `rgb(216 180 254) ${flatPct}%, ` +
    `rgb(216 180 254) ${sweetPct}%, ` +
    `rgb(243 232 255) ${sweetPct}%, ` +
    `rgb(243 232 255) 100%)`;

  // Tick labels at zone boundaries: each at 0%, 33%, 67%, 100%.
  const TICKS: { qty: number; pct: number; bold: boolean }[] = [
    { qty: 1,   pct: 0,            bold: false },
    { qty: 10,  pct: 100 / 3,      bold: true  },
    { qty: 30,  pct: (100 / 3) * 2, bold: true },
    { qty: 100, pct: 100,           bold: false },
  ];

  const isCompact = variant === "compact";
  const titleClass = isCompact
    ? "text-sm font-semibold text-gray-900"
    : "text-lg font-semibold text-gray-900";
  const subtitleClass = isCompact
    ? "text-xs text-gray-400 mt-0.5"
    : "text-sm text-gray-500 mt-1";
  const featureClass = isCompact
    ? "text-xs text-gray-500"
    : "text-sm text-gray-600";
  const btnClass = isCompact
    ? "w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
    : "w-full py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60";

  return (
    <div className="glass-card p-5 flex flex-col">
      {bulkDeal && <LimitedSeatsBar seed="bulk-lifetime" />}
      <div className="mb-4">
        <h3 className={titleClass}>Per Video</h3>
        <p className={subtitleClass}>{bulkDeal ? "Bulk credit pack" : "Pay as you go"}</p>
      </div>

      {bulkDeal ? (
        /* Fixed 500-video deal — shown on the Lifetime tab in place of the slider. */
        <div className="mb-3 space-y-1">
          <div className="flex items-baseline flex-wrap gap-x-1">
            <span className={isCompact ? "text-2xl font-bold text-gray-900" : "text-3xl font-bold text-gray-900"}>
              ${BULK_DEAL_PRICE}
            </span>
            <span className="text-xs text-gray-400">one-time</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {BULK_DEAL_VIDEOS} videos
          </div>
          <div className="text-xs font-medium text-emerald-600">
            Just ${(BULK_DEAL_PRICE / BULK_DEAL_VIDEOS).toFixed(2)}/video
          </div>
          <div className="text-[11px] text-gray-400 pt-0.5">
            Pay once — credits never expire, use them whenever.
          </div>
        </div>
      ) : (
      <>
      {/* Live price */}
      <div className="mb-3 space-y-1">
        <div className="flex items-baseline flex-wrap gap-x-1">
          <span className={isCompact ? "text-2xl font-bold text-gray-900" : "text-3xl font-bold text-gray-900"}>
            {formatDollars(unit)}
          </span>
          <span className="text-xs text-gray-400">/video</span>
        </div>
        <div className="text-xs text-gray-500">
          {qty} video{qty === 1 ? "" : "s"}
        </div>
        <div className="text-xs text-gray-500 flex items-baseline flex-wrap gap-x-1.5">
          <span>Total:</span>
          {saved > 0 && (
            <span className="text-gray-400 line-through">
              {formatDollars(BASE_PRICE_CENTS * qty)}
            </span>
          )}
          <span className="font-semibold text-gray-900">
            {formatDollars(total)}
          </span>
        </div>
        {saved > 0 && (
          <div className="text-xs font-medium text-emerald-600">
            You save {formatDollars(saved)}
          </div>
        )}
      </div>

      {/* Tier strip — three equal-width segments showing the flat pricing
          tiers. Active tier (where the slider thumb sits) highlights. */}
      <div className="mb-3 grid grid-cols-3 gap-1 text-[11px] font-medium">
        {[
          {
            label: formatDollars(CASUAL_PRICE_CENTS),
            range: "1–9",
            active: qty <= CASUAL_ZONE_END,
          },
          {
            label: formatDollars(PACK_PRICE_CENTS),
            range: "10–30",
            active: qty >= PACK_TIER_START_QTY && qty <= PACK_ZONE_END,
          },
          {
            label: formatDollars(BULK_PRICE_CENTS),
            range: "31+",
            active: qty >= BULK_TIER_START_QTY,
          },
        ].map((tier, i) => (
          <div
            key={i}
            className={`flex flex-col items-center justify-center py-2 rounded-md transition-colors duration-200 ${
              tier.active
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-purple-50 text-purple-700"
            }`}
          >
            <span className="font-semibold">{tier.label}</span>
            <span
              className={`text-[10px] ${
                tier.active ? "text-purple-100" : "text-purple-400"
              }`}
            >
              {tier.range}
            </span>
          </div>
        ))}
      </div>

      {/* Slider — three equal zones, each maps to one tier. */}
      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={SLIDER_RES}
          step={1}
          value={sliderPos}
          onChange={(e) => setQty(sliderPosToQty(parseInt(e.target.value, 10)))}
          style={{ background: trackBackground }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500"
          disabled={disabled || loading}
        />
        {/* Labels at zone boundaries. Thumb center travels from 8px to
            (width − 8px), so labels use the same calc to align. */}
        <div className="relative h-4 mt-1">
          {TICKS.map((tick) => (
            <span
              key={tick.qty}
              className={`absolute text-[10px] -translate-x-1/2 ${
                tick.bold ? "font-semibold text-purple-600" : "text-gray-400"
              }`}
              style={{ left: `calc(8px + (100% - 16px) * ${tick.pct / 100})` }}
            >
              {tick.qty}
            </span>
          ))}
        </div>
      </div>
      </>
      )}

      <ul className={`space-y-2 mb-5 flex-1 ${featureClass}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckMark />
            {f}
          </li>
        ))}
        {excludedFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-gray-400">
            <XMark />
            {f}
          </li>
        ))}
      </ul>

      {customButton ?? (
        bulkDeal ? (
          <button
            type="button"
            onClick={() => onBuyBulk?.()}
            disabled={disabled || bulkLoading}
            className={btnClass}
          >
            {bulkLoading ? "Redirecting…" : `Get ${BULK_DEAL_VIDEOS} videos`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(qty)}
            disabled={disabled || loading}
            className={btnClass}
          >
            {loading
              ? "Redirecting…"
              : qty === 1
              ? "Buy a video"
              : `Buy ${qty} videos`}
          </button>
        )
      )}
    </div>
  );
}
