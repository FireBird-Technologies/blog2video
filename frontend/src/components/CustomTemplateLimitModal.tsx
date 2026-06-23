import { useState } from "react";
import ReactDOM from "react-dom";
import {
  createCheckoutSession,
  createCustomTemplateCheckout,
} from "../api/client";
import {
  STANDARD_MONTHLY_PRICE,
  STANDARD_ANNUAL_MONTHLY_PRICE,
  PRO_MONTHLY_PRICE,
  PRO_ANNUAL_MONTHLY_PRICE,
  STANDARD_CUSTOM_TEMPLATE_COUNT,
  PRO_CUSTOM_TEMPLATE_COUNT,
} from "../content/pricingContent";
import { useAuth } from "../hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional custom heading */
  title?: string;
  /** Optional custom subtext below the heading */
  subtitle?: string;
}

/**
 * Compact, plan-tiered upgrade modal for the custom-template creation limit.
 *
 * Unlike the general UpgradePlanModal, this is purpose-built for the templates
 * tab: it shows only the plans that are an actual step up for the current user
 * (free → Standard + Pro, standard → Pro, pro → none) plus a one-off $5 slot
 * that's always available. No per-video card, and it fits without scrolling.
 */
export default function CustomTemplateLimitModal({
  open,
  onClose,
  title: titleProp,
  subtitle: subtitleProp,
}: Props) {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [slotQty, setSlotQty] = useState(1);

  const SLOT_PRICE = 5;
  const SLOT_MIN = 1;
  const SLOT_MAX = 20;

  if (!open) return null;

  const plan = user?.plan ?? "free";
  const showStandard = plan === "free";
  const showPro = plan === "free" || plan === "standard";

  const handleSubscribe = async (target: "standard" | "pro") => {
    if (!user) {
      window.location.href = "/pricing";
      return;
    }
    setLoadingPlan(target);
    try {
      const res = await createCheckoutSession({
        plan: target,
        billing_cycle: billingCycle,
      });
      window.location.href = res.data.checkout_url;
    } catch {
      setLoadingPlan(null);
    }
  };

  const handleExtraSlot = async () => {
    if (!user) {
      window.location.href = "/pricing";
      return;
    }
    setLoadingPlan("extra_slot");
    try {
      const res = await createCustomTemplateCheckout(slotQty);
      if (res.data.checkout_url) window.location.href = res.data.checkout_url;
    } catch {
      setLoadingPlan(null);
    }
  };

  const clampQty = (n: number) => Math.max(SLOT_MIN, Math.min(n, SLOT_MAX));

  const planCards = (showStandard ? 1 : 0) + (showPro ? 1 : 0);
  // 2 cards → 2 cols, 1 card → 1 col (keeps it from stretching edge-to-edge).
  const gridCols = planCards >= 2 ? "sm:grid-cols-2" : "sm:grid-cols-1 sm:max-w-sm sm:mx-auto";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            title="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-xl font-semibold text-gray-900 pr-8">
            {titleProp ?? "You've reached your custom-template limit"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {subtitleProp ??
              "Upgrade your plan for more custom templates, or grab a single extra slot."}
          </p>

          {planCards > 0 && (
            <>
              {/* Monthly / Annual toggle */}
              <div className="flex items-center gap-2 mt-4">
                <span className={`text-xs font-medium ${billingCycle === "monthly" ? "text-gray-900" : "text-gray-400"}`}>
                  Monthly
                </span>
                <button
                  type="button"
                  onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
                  className={`relative w-10 h-5 rounded-full transition-colors ${billingCycle === "annual" ? "bg-purple-600" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${billingCycle === "annual" ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
                <span className={`text-xs font-medium ${billingCycle === "annual" ? "text-gray-900" : "text-gray-400"}`}>
                  Annual
                </span>
                <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded-full">
                  Save 20%
                </span>
              </div>

              <div className={`grid grid-cols-1 ${gridCols} gap-4 mt-5`}>
                {showStandard && (
                  <PlanCard
                    name="Standard"
                    blurb={`${STANDARD_CUSTOM_TEMPLATE_COUNT} custom templates`}
                    monthly={STANDARD_MONTHLY_PRICE}
                    annualMonthly={STANDARD_ANNUAL_MONTHLY_PRICE}
                    billingCycle={billingCycle}
                    templateCount={STANDARD_CUSTOM_TEMPLATE_COUNT}
                    videoCount={30}
                    cta="Upgrade to Standard"
                    loading={loadingPlan === "standard"}
                    disabled={!!loadingPlan}
                    onClick={() => handleSubscribe("standard")}
                  />
                )}
                {showPro && (
                  <PlanCard
                    name="Pro"
                    blurb={`${PRO_CUSTOM_TEMPLATE_COUNT} custom templates`}
                    monthly={PRO_MONTHLY_PRICE}
                    annualMonthly={PRO_ANNUAL_MONTHLY_PRICE}
                    billingCycle={billingCycle}
                    templateCount={PRO_CUSTOM_TEMPLATE_COUNT}
                    videoCount={100}
                    cta="Upgrade to Pro"
                    highlight
                    loading={loadingPlan === "pro"}
                    disabled={!!loadingPlan}
                    onClick={() => handleSubscribe("pro")}
                  />
                )}
              </div>
            </>
          )}

          {/* One-off extra slots — always available, even on Pro. */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {slotQty > 1 ? `Need ${slotQty} more templates?` : "Just need one more template?"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Buy custom template slots — one-time $5 each, no subscription.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Ticker counter */}
              <div className="flex items-center gap-1 rounded-full bg-purple-100/70 p-1">
                <button
                  type="button"
                  onClick={() => setSlotQty((q) => clampQty(q - 1))}
                  disabled={!!loadingPlan || slotQty <= SLOT_MIN}
                  aria-label="Decrease quantity"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-purple-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M5 12h14" />
                  </svg>
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-900 tabular-nums select-none">
                  {slotQty}
                </span>
                <button
                  type="button"
                  onClick={() => setSlotQty((q) => clampQty(q + 1))}
                  disabled={!!loadingPlan || slotQty >= SLOT_MAX}
                  aria-label="Increase quantity"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-purple-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleExtraSlot}
                disabled={!!loadingPlan}
                className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingPlan === "extra_slot" ? "Redirecting…" : `Buy — $${slotQty * SLOT_PRICE}`}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-purple-600 transition-colors"
            >
              Maybe later
            </button>
            {/* Share B2V disabled
            <a
              href="/survey"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
              Share B2V to get 5 videos free
            </a> */}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PlanCard({
  name,
  blurb,
  monthly,
  annualMonthly,
  billingCycle,
  templateCount,
  videoCount,
  cta,
  highlight,
  loading,
  disabled,
  onClick,
}: {
  name: string;
  blurb: string;
  monthly: number;
  annualMonthly: number;
  billingCycle: "monthly" | "annual";
  templateCount: number;
  videoCount: number;
  cta: string;
  highlight?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isAnnual = billingCycle === "annual";
  return (
    <div className={`glass-card p-5 flex flex-col relative ${highlight ? "ring-2 ring-purple-100" : ""}`}>
      {highlight && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="px-3 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded-full">
            Best value
          </span>
        </div>
      )}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{blurb}</p>
      </div>
      <div className="mb-4">
        <span className="text-2xl font-bold text-gray-900">${isAnnual ? annualMonthly : monthly}</span>
        <span className="text-xs text-gray-400 ml-1">/month</span>
        <p className="text-[10px] text-gray-400 mt-1">
          {isAnnual
            ? `billed annually`
            : <>or <span className="font-medium text-gray-500">${annualMonthly}/mo</span> billed annually</>}
        </p>
      </div>
      <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
        <li className="flex items-start gap-2"><CheckMark /><span className="font-medium text-gray-700">{templateCount} custom video templates</span></li>
        <li className="flex items-start gap-2"><CheckMark />{videoCount} videos / month</li>
        <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
        <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
        <li className="flex items-start gap-2"><CheckMark />Priority support</li>
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-60 ${
          highlight ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        {loading ? "Redirecting…" : cta}
      </button>
    </div>
  );
}

function CheckMark() {
  return (
    <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
