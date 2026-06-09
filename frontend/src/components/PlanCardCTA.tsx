import type { BillingCycle, PlanKey } from "../api/billing";
import {
  getSwitchAction,
  getSwitchButtonLabel,
  isSwitchActionDisabled,
  planParts,
  type CardTier,
  type CurrentSlug,
} from "../lib/planSwitch";

interface Props {
  tier: CardTier;
  currentSlug: CurrentSlug;
  billingCycle: BillingCycle;
  scheduledTargetSlug?: string | null;
  scheduledPending?: boolean;
  paymentBlocked?: boolean;
  onSubscribe: () => void;
  onSwitch: (plan: PlanKey, cycle: BillingCycle) => void;
  subscribeLoading?: boolean;
  variant?: "compact" | "full";
}

// CTA button rendered on a single plan card. Encapsulates the "which button do
// I show this user given their current plan and the active toggle" rule, so
// Pricing.tsx and Subscription.tsx render identical behavior.
export default function PlanCardCTA({
  tier,
  currentSlug,
  billingCycle,
  scheduledTargetSlug,
  scheduledPending = false,
  paymentBlocked = false,
  onSubscribe,
  onSwitch,
  subscribeLoading = false,
  variant = "compact",
}: Props) {
  const action = getSwitchAction(currentSlug, tier, billingCycle);
  const label = getSwitchButtonLabel(action);
  const disabled = isSwitchActionDisabled(action, {
    paymentBlocked,
    scheduledTargetSlug: scheduledTargetSlug ?? null,
  });

  const isFull = variant === "full";
  const baseBtn = isFull
    ? "w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
    : "w-full py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-60";

  if (action.kind === "current") {
    return (
      <div
        className={
          isFull
            ? "w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center bg-purple-50 text-purple-500"
            : "py-2 text-center text-xs font-medium text-purple-500 bg-purple-50 rounded-lg"
        }
      >
        Current plan
      </div>
    );
  }

  if (action.kind === "subscribe") {
    const isPro = tier === "pro";
    const colorClasses = isPro
      ? "bg-purple-600 hover:bg-purple-700 text-white"
      : "bg-gray-900 hover:bg-gray-800 text-white";
    return (
      <button
        onClick={onSubscribe}
        disabled={subscribeLoading}
        className={`${baseBtn} ${colorClasses}`}
      >
        {subscribeLoading ? "Redirecting..." : label}
      </button>
    );
  }

  // upgrade / downgrade / cycle_change → open the switch confirm modal.
  const { plan, cycle } = planParts(action.targetSlug);

  const isUpgradeAction =
    action.kind === "upgrade" ||
    (action.kind === "cycle_change" && action.direction === "upgrade");

  const colorClasses = isUpgradeAction
    ? "bg-purple-600 hover:bg-purple-700 text-white"
    : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200";

  return (
    <button
      onClick={() => onSwitch(plan, cycle)}
      disabled={disabled}
      title={
        disabled && scheduledPending
          ? "A scheduled plan change is pending. Cancel it first."
          : disabled && paymentBlocked
            ? "Resolve your payment issue first."
            : undefined
      }
      className={`${baseBtn} ${colorClasses}`}
    >
      {label}
    </button>
  );
}
