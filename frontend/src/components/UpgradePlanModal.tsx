import { useState } from "react";
import ReactDOM from "react-dom";
import {
  createCheckoutSession,
  createPerVideoCheckout,
  createCustomTemplateCheckout,
} from "../api/client";
import {
  STANDARD_MONTHLY_PRICE,
  STANDARD_ANNUAL_MONTHLY_PRICE,
  STANDARD_ANNUAL_TOTAL_PRICE,
  PRO_MONTHLY_PRICE,
  PRO_ANNUAL_MONTHLY_PRICE,
  PRO_ANNUAL_TOTAL_PRICE,
  STANDARD_CUSTOM_TEMPLATE_COUNT,
  PRO_CUSTOM_TEMPLATE_COUNT,
} from "../content/pricingContent";
import { useAuth } from "../hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, per-video checkout will use this project for context */
  projectId?: number;
  /** Optional custom heading (default: "Update to a paid plan") */
  title?: string;
  /** Optional custom subtext below the heading */
  subtitle?: string;
  /**
   * "video" (default) keeps the existing upgrade flow. "custom_template" pushes
   * subscriptions first (all 3 plan cards stay visible for everyone) and adds a
   * $5 one-off "extra slot" purchase at the bottom.
   */
  mode?: "video" | "custom_template";
  /**
   * When true, hide the per-video "Buy a video" card and show only the
   * subscription plans (Standard + Pro). Used where per-video isn't a valid
   * unlock — e.g. a free user choosing a custom template at video-creation time.
   */
  subscriptionsOnly?: boolean;
}

export default function UpgradePlanModal({
  open,
  onClose,
  projectId,
  title: titleProp,
  subtitle: subtitleProp,
  mode = "video",
  subscriptionsOnly = false,
}: Props) {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  if (!open) return null;

  const isCustomTemplate = mode === "custom_template";

  const handleCheckout = async (plan: "per_video" | "standard" | "pro") => {
    if (!user) {
      window.location.href = "/pricing";
      return;
    }
    setLoadingPlan(plan);
    try {
      if (plan === "per_video") {
        const res = await createPerVideoCheckout(projectId);
        if (res.data.checkout_url) window.location.href = res.data.checkout_url;
      } else {
        const res = await createCheckoutSession({
          plan: plan as "standard" | "pro",
          billing_cycle: billingCycle,
        });
        window.location.href = res.data.checkout_url;
      }
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
      const res = await createCustomTemplateCheckout();
      if (res.data.checkout_url) window.location.href = res.data.checkout_url;
    } catch {
      setLoadingPlan(null);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
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
            {titleProp ?? "Update to a paid plan"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {subtitleProp ?? "Unlock AI image generation and more. Choose a plan below."}
          </p>

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
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className={`grid grid-cols-1 gap-4 ${subscriptionsOnly ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {/* Per Video — same bullets as Subscription */}
            {!subscriptionsOnly && (
            <div className="glass-card p-5 flex flex-col">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Per Video</h3>
                <p className="text-xs text-gray-400 mt-0.5">Pay as you go</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold text-gray-900">$3</span>
                <span className="text-xs text-gray-400 ml-1">/video</span>
              </div>
              <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
                <li className="flex items-start gap-2"><CheckMark />No subscription needed</li>
                <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
                <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
                <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
                <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
                <li className="flex items-start gap-2"><CheckMark />Custom video templates</li>
                <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
              </ul>
              <button
                onClick={() => handleCheckout("per_video")}
                disabled={!!loadingPlan}
                className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingPlan === "per_video" ? "Redirecting…" : "Buy a video"}
              </button>
            </div>
            )}

            {/* Standard — same bullets as Subscription */}
            <div className="glass-card p-5 flex flex-col">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Standard</h3>
                <p className="text-xs text-gray-400 mt-0.5">30 videos/month</p>
              </div>
              <div className="mb-4">
                {billingCycle === "annual" ? (
                  <>
                    <span className="text-2xl font-bold text-gray-900">${STANDARD_ANNUAL_MONTHLY_PRICE}</span>
                    <span className="text-xs text-gray-400 ml-1">/month</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-gray-400 line-through">${STANDARD_MONTHLY_PRICE}/mo</span>
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                        Save 20%
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">${STANDARD_ANNUAL_TOTAL_PRICE} billed annually</p>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">${STANDARD_MONTHLY_PRICE}</span>
                    <span className="text-xs text-gray-400 ml-1">/month</span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      or <span className="font-medium text-gray-500">${STANDARD_ANNUAL_MONTHLY_PRICE}/mo</span> billed annually
                    </p>
                  </>
                )}
              </div>
              <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
                <li className="flex items-start gap-2"><CheckMark />30 videos / month</li>
                <li className="flex items-start gap-2"><CheckMark />{STANDARD_CUSTOM_TEMPLATE_COUNT} custom video templates</li>
                <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
                <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
                <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
                <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
                <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
                <li className="flex items-start gap-2"><CheckMark />Priority support</li>
              </ul>
              <button
                onClick={() => handleCheckout("standard")}
                disabled={!!loadingPlan}
                className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingPlan === "standard" ? "Redirecting…" : "Upgrade to Standard"}
              </button>
            </div>

            {/* Pro — same bullets as Subscription */}
            <div className="glass-card p-5 flex flex-col relative ring-2 ring-purple-100">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded-full">
                  Best value
                </span>
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Pro</h3>
                <p className="text-xs text-gray-400 mt-0.5">For serious creators</p>
              </div>
              <div className="mb-4">
                {billingCycle === "annual" ? (
                  <>
                    <span className="text-2xl font-bold text-gray-900">${PRO_ANNUAL_MONTHLY_PRICE}</span>
                    <span className="text-xs text-gray-400 ml-1">/month</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-gray-400 line-through">${PRO_MONTHLY_PRICE}/mo</span>
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                        Save 20%
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">${PRO_ANNUAL_TOTAL_PRICE} billed annually</p>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">${PRO_MONTHLY_PRICE}</span>
                    <span className="text-xs text-gray-400 ml-1">/month</span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      or <span className="font-medium text-gray-500">${PRO_ANNUAL_MONTHLY_PRICE}/mo</span> billed annually
                    </p>
                  </>
                )}
              </div>
              <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
                <li className="flex items-start gap-2"><CheckMark />100 videos / month</li>
                <li className="flex items-start gap-2"><CheckMark />{PRO_CUSTOM_TEMPLATE_COUNT} custom video templates</li>
                <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
                <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
                <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
                <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
                <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
                <li className="flex items-start gap-2"><CheckMark />Priority support</li>
              </ul>
              <button
                onClick={() => handleCheckout("pro")}
                disabled={!!loadingPlan}
                className="w-full py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingPlan === "pro" ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            </div>
          </div>

          {/* One-off extra custom-template slot — subscriptions are the primary
              push, but a single $5 slot stays available to everyone. */}
          {isCustomTemplate && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Just need one more template?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Buy a custom template — one-time $5, no subscription.
                </p>
              </div>
              <button
                onClick={handleExtraSlot}
                disabled={!!loadingPlan}
                className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingPlan === "extra_slot" ? "Redirecting…" : "Buy a custom template — $5"}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex-shrink-0 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-purple-600 transition-colors"
          >
            Maybe later
          </button>
          {/* Share B2V disabled
          <a
            href="/survey"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-all relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            Share B2V to get 5 videos free
          </a> */}
        </div>
      </div>
    </div>,
    document.body
  );
}

function CheckMark() {
  return (
    <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
