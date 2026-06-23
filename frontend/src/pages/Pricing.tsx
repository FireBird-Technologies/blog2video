import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CredentialResponse } from "@react-oauth/google";
import {
  googleLogin,
  createCheckoutSession,
  createPerVideoCheckout,
  createBulkCreditsCheckout,
  getSubscriptionDetail,
  sendEnterpriseContact,
  SubscriptionDetail,
} from "../api/client";
import type { BillingCycle, PlanKey } from "../api/billing";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import AccountDeletedModal from "../components/AccountDeletedModal";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";
import { pricingSchema } from "../seo/schema";
import PerVideoSliderCard from "../components/PerVideoSliderCard";
import LifetimeUrgencyBanner from "../components/LifetimeUrgencyBanner";
import PlanCardCTA from "../components/PlanCardCTA";
import PlanSwitchConfirmModal from "../components/PlanSwitchConfirmModal";
import BillingCycleTabs from "../components/BillingCycleTabs";
import { isPaidSlug, type CurrentSlug } from "../lib/planSwitch";
import {
  STANDARD_MONTHLY_PRICE,
  STANDARD_ANNUAL_MONTHLY_PRICE,
  STANDARD_ANNUAL_TOTAL_PRICE,
  PRO_MONTHLY_PRICE,
  PRO_ANNUAL_MONTHLY_PRICE,
  PRO_ANNUAL_TOTAL_PRICE,
  PRO_COST_PER_VIDEO_MONTHLY,
  PRO_COST_PER_VIDEO_ANNUAL,
  FREE_CUSTOM_TEMPLATE_COUNT,
  STANDARD_CUSTOM_TEMPLATE_COUNT,
  PRO_CUSTOM_TEMPLATE_COUNT,
  pricingFaq,
} from "../content/pricingContent";
// import DiscountCodeBadge from "../components/DiscountCodeBadge";

export default function Pricing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showError } = useErrorModal();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [accountDeletedOpen, setAccountDeletedOpen] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    plan: PlanKey;
    billing_cycle: BillingCycle;
  } | null>(null);
  // Default the monthly/annual toggle to the user's current plan cycle, but only
  // once — after that the user's manual toggling wins.
  const cycleInitRef = useRef(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("b2v_ref_code", ref);
  }, [searchParams]);

  // Fetch subscription detail for logged-in paid users so the CTAs can
  // show Upgrade / Downgrade / Switch correctly instead of generic "Upgrade to X".
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    if (user.plan === "free") {
      setSubscription(null);
      return;
    }
    getSubscriptionDetail()
      .then((res) => {
        setSubscription(res.data);
        if (!cycleInitRef.current && res.data?.plan_slug) {
          cycleInitRef.current = true;
          setBillingCycle(
            res.data.plan_slug.endsWith("annual") ? "annual" : "monthly"
          );
        }
      })
      .catch(() => setSubscription(null));
  }, [user]);

  const refreshSubscription = async () => {
    try {
      const res = await getSubscriptionDetail();
      setSubscription(res.data);
    } catch {
      // ignore
    }
  };

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    const refCode = localStorage.getItem("b2v_ref_code");
    try {
      const res = await googleLogin(response.credential, false, refCode);
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.detail === "account_deleted") {
        setPendingCredential(response.credential);
        setAccountDeletedOpen(true);
      } else {
        showError(getErrorMessage(err, "Authentication failed. Please try again."));
      }
    }
  };

  const handleReactivate = async () => {
    if (!pendingCredential) return;
    setReactivating(true);
    try {
      const res = await googleLogin(pendingCredential, true);
      login(res.data.access_token, res.data.user);
      setAccountDeletedOpen(false);
      setPendingCredential(null);
      navigate("/dashboard");
    } catch (err: any) {
      showError(getErrorMessage(err, "Failed to reactivate account."));
    } finally {
      setReactivating(false);
    }
  };

  const [perVideoLoading, setPerVideoLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const res = await createCheckoutSession({ plan: "pro", billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      console.error("Pro checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setCheckoutLoading(false);
    }
  };

  const [standardCheckoutLoading, setStandardCheckoutLoading] = useState(false);
  const handleStandardUpgrade = async () => {
    if (!user) return;
    setStandardCheckoutLoading(true);
    try {
      const res = await createCheckoutSession({ plan: "standard", billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      console.error("Standard checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setStandardCheckoutLoading(false);
    }
  };

  // One-time lifetime purchase (Standard $1000 / Pro $1600). mode=payment Stripe
  // Checkout — bypasses the upgrade/downgrade switch flow entirely.
  const [lifetimeLoading, setLifetimeLoading] = useState<PlanKey | null>(null);
  const handleLifetimeBuy = async (plan: PlanKey) => {
    if (!user) return;
    setLifetimeLoading(plan);
    try {
      const res = await createCheckoutSession({ plan, billing_cycle: "lifetime" });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      console.error("Lifetime checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setLifetimeLoading(null);
    }
  };

  const handlePerVideo = async (quantity: number = 1) => {
    if (!user) return;
    setPerVideoLoading(true);
    try {
      const res = await createPerVideoCheckout({ quantity });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err: any) {
      console.error("Per-video checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setPerVideoLoading(false);
    }
  };

  // 500-video credit pack ($300, never expires) — shown on the Annual tab.
  const [bulkLoading, setBulkLoading] = useState(false);
  const handleBulkCredits = async () => {
    if (!user) return;
    setBulkLoading(true);
    try {
      const res = await createBulkCreditsCheckout();
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err: any) {
      console.error("Bulk credits checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setBulkLoading(false);
    }
  };

  const isPro = user?.plan === "pro";
  const isStandard = user?.plan === "standard";

  const currentSlug: CurrentSlug = (() => {
    if (subscription?.plan_slug && isPaidSlug(subscription.plan_slug)) {
      return subscription.plan_slug;
    }
    if (user?.plan === "pro") return "pro_monthly";
    if (user?.plan === "standard") return "standard_monthly";
    return "free";
  })();

  const scheduledPending = Boolean(subscription?.scheduled_plan_slug);
  const paymentBlocked =
    subscription?.status === "past_due" ||
    subscription?.status === "requires_action";

  const openSwitchModal = (plan: PlanKey, cycle: BillingCycle) => {
    setPendingSwitch({ plan, billing_cycle: cycle });
  };

  const handlePlanSwitchSuccess = async () => {
    await refreshSubscription();
    // Force a hard reload so the auth context picks up the new user.plan.
    window.location.reload();
  };

  const [serviceModal, setServiceModal] = useState<"designer" | "editing" | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceEmail, setServiceEmail] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState(false);

  const closeServiceModal = () => {
    setServiceModal(null);
    setServiceName("");
    setServiceEmail("");
    setServiceDesc("");
    setServiceSuccess(false);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceLoading(true);
    try {
      await sendEnterpriseContact({
        name: serviceName,
        company: serviceModal === "designer" ? "Designer-Crafted Templates" : "Video Editing Service",
        contact_details: serviceEmail,
        message: serviceDesc,
      });
      setServiceSuccess(true);
      setTimeout(closeServiceModal, 3000);
    } catch (err: any) {
      showError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setServiceLoading(false);
    }
  };

  const monthlyPrice = PRO_MONTHLY_PRICE;
  const annualMonthlyPrice = PRO_ANNUAL_MONTHLY_PRICE;
  const annualTotalPrice = PRO_ANNUAL_TOTAL_PRICE;
  const isAnnual = billingCycle === "annual";
  const isLifetime = billingCycle === "lifetime";

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Pricing"
        description="Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans."
        path="/pricing"
        schema={pricingSchema()}
      />
      <PublicHeader />

      {/* Pricing header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[280px] h-[280px] sm:w-[600px] sm:h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-6 text-center">
          <p className="text-xs font-medium text-purple-600 mb-4 tracking-widest uppercase">
            Pricing
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Start free. Pay per video. Or go Pro for unlimited power.
          </p>
        </div>
      </div>
      
      {/* <div className="flex justify-center">
        <DiscountCodeBadge className="md:hidden" />
      </div> */}

      {/* Billing tabs */}
      <div className="flex items-center justify-center gap-3 py-6">
        <BillingCycleTabs active={billingCycle} onChange={setBillingCycle} />
        {isAnnual && (
          <span className="ml-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
            Save 20%
          </span>
        )}
      </div>

      {isLifetime && (
        <div className="max-w-md mx-auto px-4 -mt-2 mb-2">
          <LifetimeUrgencyBanner />
        </div>
      )}

      {/* Plans */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-8 max-w-[1600px] mx-auto">
          {/* Free */}
          <div className="glass-card p-5 sm:p-7 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Free
              </h3>
              <p className="text-sm text-gray-400">Try it out</p>
            </div>
            <div className="mb-6">
              <span className="text-3xl sm:text-4xl font-bold text-gray-900">$0</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "2 videos free",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                `${FREE_CUSTOM_TEMPLATE_COUNT} custom video template`,
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
              {["Unlimited AI edit & image generation", "Premium voiceover + cloning"].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <XIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                {user.plan === "free" ? "Current plan" : "Downgrade not available"}
              </button>
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="signup_with"
                  width="190"
                />
              </div>
            )}
          </div>

          {/* Pay Per Video */}
          {user ? (
            <PerVideoSliderCard
              variant="full"
              loading={perVideoLoading}
              disabled={false}
              bulkDeal={isLifetime}
              bulkLoading={bulkLoading}
              onBuyBulk={handleBulkCredits}
              onBuy={(quantity) => handlePerVideo(quantity)}
              features={[
                "No subscription required",
                "AI script generation",
                "ElevenLabs voiceover",
                "Render & download MP4",
              ]}
            />
          ) : (
            <PerVideoSliderCard
              variant="full"
              bulkDeal={isLifetime}
              onBuy={() => {}}
              features={[
                "No subscription required",
                "AI script generation",
                "ElevenLabs voiceover",
                "Render & download MP4",
              ]}
              customButton={
                <div className="flex justify-center">
                  <GoogleAuthButton
                    onSuccess={handleGoogleSuccess}
                    onError={() => showError("Google sign-in failed")}
                    text="continue_with"
                    width="190"
                  />
                </div>
              }
            />
          )}

          {/* Standard */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Standard
              </h3>
              <p className="text-sm text-gray-400">
                All features, 30 videos/month
              </p>
            </div>
            <div className="mb-6">
              {isLifetime ? (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$1000</span>
                  <span className="text-sm text-gray-400 ml-1">one-time</span>
                  <p className="text-xs text-gray-400 mt-1">Pay once, yours forever</p>
                </>
              ) : isAnnual ? (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">${STANDARD_ANNUAL_MONTHLY_PRICE}</span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-400 line-through">${STANDARD_MONTHLY_PRICE}/mo</span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">${STANDARD_ANNUAL_TOTAL_PRICE} billed annually</p>
                </>
              ) : (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">${STANDARD_MONTHLY_PRICE}</span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <p className="text-xs text-gray-400 mt-1">or ${STANDARD_ANNUAL_MONTHLY_PRICE}/mo billed annually</p>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "30 videos per month",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                `${STANDARD_CUSTOM_TEMPLATE_COUNT} custom video templates`,
                "Premium voiceover + cloning",
                "Priority support",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              isLifetime ? (
                <button
                  onClick={() => handleLifetimeBuy("standard")}
                  disabled={lifetimeLoading === "standard"}
                  className="w-full py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  {lifetimeLoading === "standard" ? "Redirecting..." : "Buy lifetime"}
                </button>
              ) : (
                <PlanCardCTA
                  tier="standard"
                  currentSlug={currentSlug}
                  billingCycle={billingCycle}
                  scheduledTargetSlug={subscription?.scheduled_plan_slug}
                  scheduledPending={scheduledPending}
                  paymentBlocked={paymentBlocked}
                  onSubscribe={handleStandardUpgrade}
                  onSwitch={openSwitchModal}
                  subscribeLoading={standardCheckoutLoading}
                  variant="full"
                />
              )
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="continue_with"
                  width="190"
                />
              </div>
            )}
          </div>

          {/* Pro */}
          <div className="glass-card p-7 flex flex-col ring-2 ring-purple-200 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                Best value
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Pro
              </h3>
              <p className="text-sm text-gray-400">
                For serious content creators
              </p>
            </div>
            <div className="mb-6">
              {isLifetime ? (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$1600</span>
                  <span className="text-sm text-gray-400 ml-1">one-time</span>
                  <p className="text-xs text-gray-400 mt-1">Pay once, yours forever</p>
                </>
              ) : isAnnual ? (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                    ${annualMonthlyPrice}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-400 line-through">
                      ${monthlyPrice}/mo
                    </span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    ${annualTotalPrice} billed annually
                  </p>
                </>
              ) : (
                <>
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                    ${monthlyPrice}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <p className="text-xs text-gray-400 mt-1">
                    or ${annualMonthlyPrice}/mo billed annually
                  </p>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "100 videos per month",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                `${PRO_CUSTOM_TEMPLATE_COUNT} custom video templates`,
                "Premium voiceover + cloning",
                "Priority support",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              isLifetime ? (
                <button
                  onClick={() => handleLifetimeBuy("pro")}
                  disabled={lifetimeLoading === "pro"}
                  className="w-full py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  {lifetimeLoading === "pro" ? "Redirecting..." : "Buy lifetime"}
                </button>
              ) : (
                <PlanCardCTA
                  tier="pro"
                  currentSlug={currentSlug}
                  billingCycle={billingCycle}
                  scheduledTargetSlug={subscription?.scheduled_plan_slug}
                  scheduledPending={scheduledPending}
                  paymentBlocked={paymentBlocked}
                  onSubscribe={handleUpgrade}
                  onSwitch={openSwitchModal}
                  subscribeLoading={checkoutLoading}
                  variant="full"
                />
              )
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="continue_with"
                  width="190"
                />
              </div>
            )}
          </div>

          {/* Customized Subscription */}
          <div className="glass-card p-5 sm:p-7 flex flex-col border-2 border-purple-300">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Customized
              </h3>
              <p className="text-sm text-gray-400">Enterprise & teams</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">Custom</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Custom video limits",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                "Custom video templates",
                "Premium voiceover + cloning",
                "Custom integrations",
                "Dedicated support",
                "SSO & enterprise security",
                "On-prem deployment available",
                "Custom pricing",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/contact")}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Contact Sales
            </button>
          </div>
        </div>

        {/* Cost breakdown callout */}
        <div className="max-w-md mx-auto mt-8 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            {isLifetime ? (
              <>One-time payment, no recurring fees — keep your monthly video allotment forever.</>
            ) : (
              <>
                Pro works out to just{" "}
                <span className="font-medium text-gray-600">
                  {isAnnual ? PRO_COST_PER_VIDEO_ANNUAL : PRO_COST_PER_VIDEO_MONTHLY}
                </span>{" "}
                per video — 10x cheaper than pay-per-video.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Feature comparison */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-8">
          Compare plans
        </h3>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-4 px-3 sm:px-6 font-medium text-gray-500">
                  Feature
                </th>
                <th className="py-4 px-3 sm:px-6 font-medium text-gray-500 text-center">
                  Free
                </th>
                <th className="py-4 px-3 sm:px-6 font-medium text-gray-500 text-center">
                  Per Video
                </th>
                <th className="py-4 px-3 sm:px-6 font-medium text-gray-600 text-center">
                  Standard
                </th>
                <th className="py-4 px-3 sm:px-6 font-medium text-purple-600 text-center">
                  Pro
                </th>
                <th className="py-4 px-3 sm:px-6 font-medium text-purple-600 text-center">
                  Customized
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Price", free: "$0", perVideo: "$2.80–$4/video", standard: isLifetime ? "$1000 one-time" : isAnnual ? `$${STANDARD_ANNUAL_MONTHLY_PRICE}/mo` : `$${STANDARD_MONTHLY_PRICE}/mo`, pro: isLifetime ? "$1600 one-time" : isAnnual ? `$${PRO_ANNUAL_MONTHLY_PRICE}/mo` : `$${PRO_MONTHLY_PRICE}/mo`, customized: "Custom" },
                { feature: "Videos", free: "2 free", perVideo: "Unlimited", standard: "30/month", pro: "100/month", customized: "Custom" },
                { feature: "AI script generation", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "ElevenLabs voiceover", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Voice selection (4 options)", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Video preview", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Render & download MP4", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Unlimited AI edit & image generation", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "Custom video templates", free: String(FREE_CUSTOM_TEMPLATE_COUNT), perVideo: "—", standard: String(STANDARD_CUSTOM_TEMPLATE_COUNT), pro: String(PRO_CUSTOM_TEMPLATE_COUNT), customized: "Custom" },
                { feature: "Premium voiceover + cloning", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "Music Addition", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "Advanced voiceover settings", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "Priority support", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "On-prem deployment", free: false, perVideo: false, standard: false, pro: false, customized: true },
              ].map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? "bg-gray-50/50" : ""}
                >
                  <td className="py-3.5 px-3 sm:px-6 text-gray-700">
                    {row.feature}
                  </td>
                  <td className="py-3.5 px-3 sm:px-6 text-center">
                    {typeof row.free === "boolean" ? (
                      row.free ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-500">{row.free}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 sm:px-6 text-center">
                    {typeof row.perVideo === "boolean" ? (
                      row.perVideo ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-500">{row.perVideo}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 sm:px-6 text-center">
                    {typeof row.standard === "boolean" ? (
                      row.standard ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-700">{row.standard}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 sm:px-6 text-center">
                    {typeof row.pro === "boolean" ? (
                      row.pro ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="font-medium text-gray-900">
                        {row.pro}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 sm:px-6 text-center">
                    {typeof row.customized === "boolean" ? (
                      row.customized ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="font-medium text-purple-600">
                        {row.customized}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-purple-600 mb-2 tracking-widest uppercase">Services</p>
          <h2 className="text-2xl font-bold text-gray-900">Done for you</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Need something built or made for you? We offer hands-on services for teams that want results without the DIY.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Designer-Crafted Templates */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-5">
              <span className="inline-block px-2.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-full mb-3">
                Designer
              </span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Designer-Crafted Templates</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                We don't just apply brand colors — we design with intention. Each template is crafted around your visual identity: typographic rhythm, spacing ratios, color harmony, and motion that feels considered rather than generated. The result is a video template that looks like it came from a design studio, not a drag-and-drop builder.
              </p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                "Custom-built for your brand system",
                "Typography & color hierarchy",
                "Refined motion & transitions",
                "Consistent with your website or style guide",
                "Delivered as a reusable Blog2Video template",
                "Revisions included",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <span className="text-sm text-gray-400">Pricing on request</span>
            </div>
            <button
              onClick={() => setServiceModal("designer")}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Contact us for info
            </button>
          </div>

          {/* Video Editing Service */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-5">
              <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full mb-3">
                Done For You
              </span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Video Editing Service</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Hand us your blog posts, articles, or PDFs and we'll handle everything — scripting, voiceover selection, visual editing, and delivery. Ideal for teams that want a high-quality video output without spending time inside the tool.
              </p>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                "We turn your content into finished videos",
                "Script writing & editing",
                "Voiceover selection & production",
                "Template selection & customisation",
                "Thumbnail & caption delivery",
                "Turnaround within agreed timeline",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <span className="text-sm text-gray-400">Pricing on request</span>
            </div>
            <button
              onClick={() => setServiceModal("editing")}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-colors"
            >
              Contact us for info
            </button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-8">
          Frequently asked questions
        </h3>
        <div className="space-y-4">
          {pricingFaq.map((faq) => (
            <div key={faq.question} className="glass-card p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                {faq.question}
              </h4>
              <p className="text-sm text-gray-500 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      <PublicFooter />

      <AccountDeletedModal
        open={accountDeletedOpen}
        onClose={() => { setAccountDeletedOpen(false); setPendingCredential(null); }}
        onReactivate={handleReactivate}
        reactivating={reactivating}
      />

      <PlanSwitchConfirmModal
        open={Boolean(pendingSwitch)}
        plan={pendingSwitch?.plan ?? "standard"}
        billingCycle={pendingSwitch?.billing_cycle ?? "monthly"}
        onClose={() => setPendingSwitch(null)}
        onSuccess={handlePlanSwitchSuccess}
      />

      {serviceModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {serviceModal === "designer" ? "Designer-Crafted Templates" : "Video Editing Service"}
              </h2>
              <button onClick={closeServiceModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {serviceSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Message sent!</h3>
                <p className="text-xs text-gray-500">Thank you, you'll hear back from us within 1-2 business days.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  {serviceModal === "designer"
                    ? "Tell us about the brand or company you want templates for and we'll follow up to discuss the project."
                    : "Give us a rough idea of what you need and we'll take it from there."}
                </p>
                <form onSubmit={handleServiceSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={serviceEmail}
                      onChange={(e) => setServiceEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea
                      required
                      value={serviceDesc}
                      onChange={(e) => setServiceDesc(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      placeholder={
                        serviceModal === "designer"
                          ? "Tell us about the brand or company you'd like templates for — name, website, industry, and any relevant context."
                          : "How many videos do you need, and how often? Anything else we should know."
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeServiceModal}
                      className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={serviceLoading}
                      className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60"
                    >
                      {serviceLoading ? "Sending..." : "Send message"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function GreenCheck() {
  return (
    <svg
      className="w-4 h-4 text-purple-500 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function GrayX() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
