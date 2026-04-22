// Per-video pack pricing — mirror of backend/app/services/per_video_pricing.py.
// If you change these constants or the formula, change both.
//
// Three-zone curve:
//   Zone A (qty 1-5):   flat $3.00 — no discount
//   Zone B (qty 6-15):  steep 15c/unit drop — the "sweet spot" incentive
//   Zone C (qty 16+):   gentle 1c/unit drop, floored at $0.60
//
// Intentional quirk: total at qty=10 and qty=15 both equal $22.50. That's the
// "drag from 10 to 15 for 5 free videos" psychological anchor — keep it.

export const BASE_PRICE_CENTS = 300;

export const FLAT_ZONE_END = 5;
export const SWEET_ZONE_END = 15;

export const SWEET_ZONE_DROP_CENTS = 15;
export const BULK_ZONE_DROP_CENTS = 1;

export const SWEET_ZONE_END_PRICE_CENTS = 150;

export const FLOOR_PRICE_CENTS = 60;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 200;

// UI anchors
export const BEST_VALUE_QTY = 10;
export const BEST_DEAL_QTY = 15;

export const QUICK_PICKS = [1, 5, 10, 15, 50, 100] as const;

export function perUnitCents(qty: number): number {
  const q = Math.max(MIN_QUANTITY, Math.min(Math.floor(qty), MAX_QUANTITY));
  if (q <= FLAT_ZONE_END) return BASE_PRICE_CENTS;
  if (q <= SWEET_ZONE_END) {
    return BASE_PRICE_CENTS - (q - FLAT_ZONE_END) * SWEET_ZONE_DROP_CENTS;
  }
  const raw = SWEET_ZONE_END_PRICE_CENTS - (q - SWEET_ZONE_END) * BULK_ZONE_DROP_CENTS;
  return Math.max(raw, FLOOR_PRICE_CENTS);
}

export function totalCents(qty: number): number {
  const q = Math.max(MIN_QUANTITY, Math.min(Math.floor(qty), MAX_QUANTITY));
  return perUnitCents(q) * q;
}

export function savingsCents(qty: number): number {
  return BASE_PRICE_CENTS * qty - totalCents(qty);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
