// Single source of truth for what action a plan card should offer the user
// given their current plan slug and the active monthly/annual toggle.
//
// Used by both the Pricing page (public) and the Subscription page (in-app).
// The backend's classification logic in billing.py mirrors this exactly.

export type PaidPlanSlug =
  | "standard_monthly"
  | "standard_annual"
  | "pro_monthly"
  | "pro_annual";

export type CurrentSlug = PaidPlanSlug | "free";

export type CardTier = "standard" | "pro";
export type Toggle = "monthly" | "annual";

export type SwitchAction =
  | { kind: "current"; targetSlug: PaidPlanSlug }
  | { kind: "subscribe"; targetSlug: PaidPlanSlug }
  | { kind: "upgrade"; targetSlug: PaidPlanSlug }
  | { kind: "downgrade"; targetSlug: PaidPlanSlug }
  | {
      kind: "cycle_change";
      targetSlug: PaidPlanSlug;
      direction: "upgrade" | "downgrade";
    };

// Lexicographic rank: tier dominates cycle.
const PLAN_RANK: Record<PaidPlanSlug, [number, number]> = {
  standard_monthly: [1, 1],
  standard_annual: [1, 2],
  pro_monthly: [2, 1],
  pro_annual: [2, 2],
};

function compareRank(a: PaidPlanSlug, b: PaidPlanSlug): number {
  const [aTier, aCycle] = PLAN_RANK[a];
  const [bTier, bCycle] = PLAN_RANK[b];
  if (aTier !== bTier) return aTier - bTier;
  return aCycle - bCycle;
}

function tierOf(slug: PaidPlanSlug): "standard" | "pro" {
  return slug.startsWith("pro") ? "pro" : "standard";
}

export function targetSlug(tier: CardTier, toggle: Toggle): PaidPlanSlug {
  return `${tier}_${toggle}` as PaidPlanSlug;
}

export function getSwitchAction(
  currentSlug: CurrentSlug,
  cardTier: CardTier,
  toggle: Toggle,
): SwitchAction {
  const target = targetSlug(cardTier, toggle);

  if (currentSlug === "free") {
    return { kind: "subscribe", targetSlug: target };
  }

  if (currentSlug === target) {
    return { kind: "current", targetSlug: target };
  }

  const cmp = compareRank(target, currentSlug);

  // Same tier, different cycle → render the action ONLY on the current tier's card.
  if (tierOf(currentSlug) === tierOf(target)) {
    return {
      kind: "cycle_change",
      targetSlug: target,
      direction: cmp > 0 ? "upgrade" : "downgrade",
    };
  }

  return {
    kind: cmp > 0 ? "upgrade" : "downgrade",
    targetSlug: target,
  };
}

export function planParts(slug: PaidPlanSlug): {
  plan: "standard" | "pro";
  cycle: Toggle;
} {
  const [plan, cycle] = slug.split("_") as ["standard" | "pro", Toggle];
  return { plan, cycle };
}

export function isPaidSlug(slug: string): slug is PaidPlanSlug {
  return slug in PLAN_RANK;
}

export function getSwitchButtonLabel(action: SwitchAction): string {
  switch (action.kind) {
    case "current":
      return "Current plan";
    case "subscribe":
      return action.targetSlug.startsWith("pro")
        ? "Upgrade to Pro"
        : "Upgrade to Standard";
    case "upgrade":
      return "Upgrade";
    case "downgrade":
      return "Downgrade";
    case "cycle_change":
      return action.targetSlug.endsWith("_annual")
        ? "Switch to Annual"
        : "Switch to Monthly";
  }
}

export function isSwitchActionDisabled(
  action: SwitchAction,
  options: {
    paymentBlocked?: boolean;
    scheduledTargetSlug?: string | null;
  },
): boolean {
  if (action.kind === "current" || action.kind === "subscribe") {
    return false;
  }
  if (options.paymentBlocked) {
    return true;
  }
  const scheduled = options.scheduledTargetSlug;
  if (!scheduled) {
    return false;
  }
  // Upgrades replace any pending schedule, so they stay enabled.
  if (action.kind === "upgrade") {
    return false;
  }
  if (action.targetSlug === scheduled) {
    return true;
  }
  if (action.kind === "downgrade") {
    return true;
  }
  if (action.kind === "cycle_change" && action.direction === "downgrade") {
    return true;
  }
  return false;
}
