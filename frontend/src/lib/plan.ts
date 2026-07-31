/** User-facing plan tier from auth/billing APIs. Mirrors backend PlanTier. */
export type UserPlan = "free" | "lite" | "standard" | "pro";

/** Every tier that pays. Keep in lockstep with backend PAID_TIERS. */
export const PAID_PLANS: readonly UserPlan[] = ["lite", "standard", "pro"];

export function isPaidPlan(plan: string | null | undefined): plan is UserPlan {
  return plan === "lite" || plan === "standard" || plan === "pro";
}
