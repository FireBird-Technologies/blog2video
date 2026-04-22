import { useState } from "react";
import {
  perUnitCents,
  totalCents,
  savingsCents,
  formatDollars,
  BASE_PRICE_CENTS,
  FLAT_ZONE_END,
  BEST_VALUE_QTY,
  BEST_DEAL_QTY,
} from "../lib/perVideoPricing";

type Variant = "compact" | "full";

interface Props {
  onBuy: (quantity: number) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  features?: string[];
}

const DEFAULT_FEATURES = [
  "No subscription needed",
  "AI script generation",
  "ElevenLabs voiceover",
  "Render & download MP4",
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

export default function PerVideoSliderCard({
  onBuy,
  loading = false,
  disabled = false,
  variant = "compact",
  features = DEFAULT_FEATURES,
}: Props) {
  const [qty, setQty] = useState(1);
  const unit = perUnitCents(qty);
  const total = totalCents(qty);
  const saved = savingsCents(qty);

  // Sweet-spot messaging: nudge users into the 6-15 discount band.
  let badge: { text: string; tone: "value" | "deal" } | null = null;
  if (qty === BEST_DEAL_QTY) {
    badge = { text: "Best deal — 5 free videos", tone: "deal" };
  } else if (qty === BEST_VALUE_QTY) {
    badge = { text: "Best value", tone: "value" };
  } else if (qty > FLAT_ZONE_END && qty < BEST_VALUE_QTY) {
    badge = { text: `Move up to ${BEST_VALUE_QTY} for best value`, tone: "value" };
  } else if (qty > BEST_VALUE_QTY && qty < BEST_DEAL_QTY) {
    badge = { text: `${BEST_DEAL_QTY - qty} more for 5 free videos`, tone: "deal" };
  }

  // Non-linear slider: labels are evenly spaced but map to custom qty stops.
  // This keeps 5, 10, 15 readable instead of crammed at the far left.
  const STOPS = [1, 5, 10, 15, 25, 50, 100];
  const sliderPosToQty = (pos: number): number => {
    const segSize = 1 / (STOPS.length - 1);
    const seg = Math.min(Math.floor(pos / segSize), STOPS.length - 2);
    const localT = (pos - seg * segSize) / segSize;
    const q = STOPS[seg] + (STOPS[seg + 1] - STOPS[seg]) * localT;
    return Math.round(q);
  };
  const qtyToSliderPos = (q: number): number => {
    if (q <= STOPS[0]) return 0;
    if (q >= STOPS[STOPS.length - 1]) return 1000;
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (q <= STOPS[i + 1]) {
        const localT = (q - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
        return Math.round(((i + localT) / (STOPS.length - 1)) * 1000);
      }
    }
    return 1000;
  };
  const sliderPos = qtyToSliderPos(qty);

  // Sweet-spot band: 5 is STOPS[1] = pct 1/6, 15 is STOPS[3] = pct 3/6.
  const flatPct = (1 / (STOPS.length - 1)) * 100;
  const sweetPct = (3 / (STOPS.length - 1)) * 100;
  const trackBackground =
    `linear-gradient(to right, ` +
    `rgb(243 232 255) 0%, ` +
    `rgb(243 232 255) ${flatPct}%, ` +
    `rgb(216 180 254) ${flatPct}%, ` +
    `rgb(216 180 254) ${sweetPct}%, ` +
    `rgb(243 232 255) ${sweetPct}%, ` +
    `rgb(243 232 255) 100%)`;

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
      <div className="mb-4">
        <h3 className={titleClass}>Per Video</h3>
        <p className={subtitleClass}>Pay as you go</p>
      </div>

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
        {badge && (
          <div
            className={
              badge.tone === "deal"
                ? "inline-block text-[11px] font-semibold text-white bg-purple-600 rounded-full px-2 py-0.5"
                : "inline-block text-[11px] font-semibold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5"
            }
          >
            {badge.text}
          </div>
        )}
      </div>

      {/* Slider */}
      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={sliderPos}
          onChange={(e) => setQty(sliderPosToQty(parseInt(e.target.value, 10) / 1000))}
          style={{ background: trackBackground }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500"
          disabled={disabled || loading}
        />
        {/* Labels positioned at thumb-center positions, not edge-to-edge. */}
        {/* Native range thumb ~16px wide, so center travels from 8px to (width-8px). */}
        <div className="relative h-4 mt-1">
          {STOPS.map((n, i) => {
            const purple = n === 5 || n === 10 || n === 15;
            const pct = (i / (STOPS.length - 1)) * 100;
            return (
              <span
                key={n}
                className={`absolute text-[10px] -translate-x-1/2 ${
                  purple ? "font-semibold text-purple-600" : "text-gray-400"
                }`}
                style={{ left: `calc(8px + (100% - 16px) * ${pct / 100})` }}
              >
                {n}
              </span>
            );
          })}
        </div>
      </div>

      <ul className={`space-y-2 mb-5 flex-1 ${featureClass}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckMark />
            {f}
          </li>
        ))}
      </ul>

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
    </div>
  );
}
