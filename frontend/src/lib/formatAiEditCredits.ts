/** Display tiers for AI-edit credit counts (highest matching tier wins). */
const DISPLAY_TIERS = [
  5000, 4500, 3500, 2500, 2000, 1500, 1000, 500, 300, 250, 200, 150, 100,
] as const;

/** Format a credit balance for UI: exact below 100, then tiered 100+ … 5000+. */
export function formatAiEditCreditsDisplay(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n < 100) return String(n);
  for (const tier of DISPLAY_TIERS) {
    if (n >= tier) return `${tier}+`;
  }
  return String(n);
}
