import { useState } from "react";
import {
  perUnitCents,
  totalCents,
  savingsCents,
  formatDollars,
  BASE_PRICE_CENTS,
  MIN_QUANTITY,
  MAX_QUANTITY,
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
      </div>

      {/* Slider */}
      <div className="mb-3">
        <input
          type="range"
          min={MIN_QUANTITY}
          max={MAX_QUANTITY}
          step={1}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-purple-100 rounded-full appearance-none cursor-pointer accent-purple-500"
          disabled={disabled || loading}
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
          <span>1</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
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
