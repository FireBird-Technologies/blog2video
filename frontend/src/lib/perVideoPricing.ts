// Per-video pack pricing — mirror of backend/app/services/per_video_pricing.py.
// If you change these constants, change both.
//
// Three flat tiers:
//   Zone A (qty 1-9):   $4.00/video — casual one-off buys
//   Zone B (qty 10-30): $3.00/video — pack tier
//   Zone C (qty 31+):   $2.80/video — bulk tier
//
// Crossing qty=9->10 or qty=30->31 drops to the next tier; within a tier the
// price is flat.

export const CASUAL_PRICE_CENTS = 400;
export const PACK_PRICE_CENTS = 300;
export const BULK_PRICE_CENTS = 280;

export const CASUAL_ZONE_END = 9;
export const PACK_ZONE_END = 30;

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 200;

export const PACK_TIER_START_QTY = 10;
export const BULK_TIER_START_QTY = 31;

// Strikethrough comparison uses casual price ($4) × qty.
export const BASE_PRICE_CENTS = CASUAL_PRICE_CENTS;

export const QUICK_PICKS = [1, 9, 10, 30, 31, 100] as const;

export function perUnitCents(qty: number): number {
  const q = Math.max(MIN_QUANTITY, Math.min(Math.floor(qty), MAX_QUANTITY));
  if (q <= CASUAL_ZONE_END) return CASUAL_PRICE_CENTS;
  if (q <= PACK_ZONE_END) return PACK_PRICE_CENTS;
  return BULK_PRICE_CENTS;
}

export function totalCents(qty: number): number {
  const q = Math.max(MIN_QUANTITY, Math.min(Math.floor(qty), MAX_QUANTITY));
  return perUnitCents(q) * q;
}

export function savingsCents(qty: number): number {
  return CASUAL_PRICE_CENTS * qty - totalCents(qty);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
