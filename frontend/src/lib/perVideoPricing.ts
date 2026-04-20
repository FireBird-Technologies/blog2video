// Per-video pack pricing — mirror of backend/app/services/per_video_pricing.py.
// If you change these constants, change both.

export const BASE_PRICE_CENTS = 300;
export const FLOOR_PRICE_CENTS = 60;
export const DISCOUNT_PER_UNIT_CENTS = 5;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 100;

export const QUICK_PICKS = [1, 10, 20, 50, 100] as const;

export function perUnitCents(qty: number): number {
  const q = Math.max(MIN_QUANTITY, Math.min(Math.floor(qty), MAX_QUANTITY));
  const raw = BASE_PRICE_CENTS - (q - 1) * DISCOUNT_PER_UNIT_CENTS;
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
