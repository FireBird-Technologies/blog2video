import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  getBillingStatus,
  getSubscriptionDetail,
  getInvoices,
  getDataSummary,
  createCheckoutSession,
  createPerVideoCheckout,
  createPortalSession,
  cancelSubscription,
  acceptRetentionOffer,
  resumeSubscription,
  deleteAccount,
  BillingStatus,
  SubscriptionDetail,
  Invoice,
  DataSummary,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

export default function Subscription() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRetentionOfferInCancel, setShowRetentionOfferInCancel] = useState(false);
  const [retentionSuccessMessage, setRetentionSuccessMessage] = useState<string | null>(null);
  const [retentionErrorMessage, setRetentionErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const { showError } = useErrorModal();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [billingRes, subRes, invoicesRes, dataRes] = await Promise.all([
        getBillingStatus(),
        getSubscriptionDetail(),
        getInvoices(),
        getDataSummary(),
      ]);
      setBilling(billingRes.data);
      setSubscription(subRes.data);
      setInvoices(invoicesRes.data);
      setDataSummary(dataRes.data);
    } catch (err) {
      console.error("Failed to load billing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (cycle?: "monthly" | "annual") => {
    setActionLoading("upgrade");
    try {
      const res = await createCheckoutSession({ plan: "pro", billing_cycle: cycle || billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setActionLoading(null);
    }
  };

  const handleStandardUpgrade = async () => {
    setActionLoading("standard");
    try {
      const res = await createCheckoutSession({ plan: "standard", billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error("Failed to start Standard checkout:", err);
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading("portal");
    try {
      const res = await createPortalSession();
      window.location.href = res.data.portal_url;
    } catch (err) {
      console.error("Failed to open portal:", err);
      setActionLoading(null);
    }
  };

  const openCancelConfirmModal = async () => {
    setRetentionSuccessMessage(null);
    setRetentionErrorMessage(null);
    const shouldShowRetention = !!subscription?.retention_offer_eligible;
    setShowRetentionOfferInCancel(shouldShowRetention);
    setShowCancelConfirm(true);
  };

  const closeCancelConfirmModal = () => {
    setShowCancelConfirm(false);
    setShowRetentionOfferInCancel(false);
    setRetentionSuccessMessage(null);
    setRetentionErrorMessage(null);
  };

  const handleCancel = async (declinedRetentionOffer = false) => {
    setActionLoading("cancel");
    try {
      await cancelSubscription(
        declinedRetentionOffer ? { declined_retention_offer: true } : undefined
      );
      await refreshUser();
      await loadAll();
      closeCancelConfirmModal();
    } catch (err) {
      console.error("Failed to cancel:", err);
      setRetentionErrorMessage(
        getErrorMessage(err, "We couldn't cancel your subscription. Please try again.")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRetentionOffer = async () => {
    setActionLoading("retention-accept");
    setRetentionErrorMessage(null);
    try {
      const res = await acceptRetentionOffer();
      await refreshUser();
      await loadAll();
      setRetentionSuccessMessage(
        res.data.message?.trim() ||
          "Thank you for staying. You have been given 30% off on your next voucher."
      );
      window.setTimeout(() => {
        closeCancelConfirmModal();
      }, 2500);
    } catch (err) {
      console.error("Failed to apply retention offer:", err);
      setRetentionErrorMessage(
        getErrorMessage(err, "We couldn't apply the discount. Please try again.")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try {
      await resumeSubscription();
      await refreshUser();
      await loadAll();
    } catch (err) {
      console.error("Failed to resume:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      await logout();
      navigate("/");
    } catch (err) {
      showError(getErrorMessage(err, "Failed to delete account."));
      throw err;
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatCurrency = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);

  const isPro = user?.plan === "pro" || user?.plan === "standard";
  const isStandard = user?.plan === "standard";
  const isPaid = isPro;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-gray-400 hover:text-gray-900 transition-colors mb-4 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage your plan, view invoices, and check your data usage.
        </p>
      </div>

      {/* Current plan */}
      <section className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Current Plan
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 capitalize">
                {billing?.plan || "Free"}
              </span>
              {isPro && (
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-600 text-xs font-medium rounded-full">
                  Active
                </span>
              )}
              {subscription?.status === "past_due" && (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                  Payment Failed
                </span>
              )}
              {subscription?.status === "requires_action" && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
                  Action Required
                </span>
              )}
            </div>
            {subscription?.current_period_end && (
              <p className="text-xs text-gray-400 mt-2">
                {subscription.canceled_at
                  ? `Cancels on ${formatDate(subscription.current_period_end)}`
                  : `Renews on ${formatDate(subscription.current_period_end)}`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {isPro ? (
              <>
                <button
                  onClick={handleManageBilling}
                  disabled={actionLoading === "portal"}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60"
                >
                  {actionLoading === "portal" ? "Opening..." : "Billing Portal"}
                </button>
                {subscription?.canceled_at ? (
                  <button
                    onClick={handleResume}
                    disabled={actionLoading === "resume"}
                    className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {actionLoading === "resume" ? "Resuming..." : "Resume Subscription"}
                  </button>
                ) : (
                  <button
                    onClick={openCancelConfirmModal}
                    className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Cancel Plan
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => handleUpgrade()}
                disabled={actionLoading === "upgrade"}
                className="px-5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "upgrade" ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>

        {/* Payment action required banner */}
        {subscription?.status === "requires_action" && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Your bank requires additional verification (3D Secure). Please{" "}
              <button
                onClick={handleManageBilling}
                className="font-medium underline hover:no-underline"
              >
                complete verification
              </button>{" "}
              to keep your subscription active.
            </p>
          </div>
        )}

        {/* Past due banner */}
        {subscription?.status === "past_due" && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Your last payment failed. Please{" "}
              <button
                onClick={handleManageBilling}
                className="font-medium underline hover:no-underline"
              >
                update your payment method
              </button>{" "}
              to avoid losing access.
            </p>
          </div>
        )}
      </section>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={closeCancelConfirmModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {retentionSuccessMessage ? (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Success</h3>
                <p className="text-sm text-gray-600 max-w-sm">{retentionSuccessMessage}</p>
              </div>
            ) : (
              <>
                {showRetentionOfferInCancel ? (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel subscription?</h3>
                    <p className="text-sm text-gray-500 mb-1">
                      Your Pro access will remain active until the end of your current billing period
                      {subscription?.current_period_end && (
                        <> ({formatDate(subscription.current_period_end)})</>
                      )}.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Before you go, we can offer 30% off your next billing period if you keep your
                      subscription active.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel subscription?</h3>
                    <p className="text-sm text-gray-500 mb-1">
                      Your Pro access will remain active until the end of your current billing period
                      {subscription?.current_period_end && (
                        <> ({formatDate(subscription.current_period_end)})</>
                      )}.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      After that, you'll be downgraded to the Free plan. You can resubscribe anytime.
                    </p>
                  </>
                )}
                {retentionErrorMessage && (
                  <div
                    className="mb-4 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
                    role="alert"
                  >
                    {retentionErrorMessage}
                  </div>
                )}
              </>
            )}
            {!retentionSuccessMessage && (
              <div className="flex gap-3 justify-end">
              {showRetentionOfferInCancel && (
                <button
                  onClick={handleAcceptRetentionOffer}
                  disabled={
                    actionLoading === "retention-accept" ||
                    actionLoading === "cancel" ||
                    !!retentionSuccessMessage
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {actionLoading === "retention-accept"
                    ? "Applying..."
                    : "Keep Plan With 30% Discount"}
                </button>
              )}
              <button
                onClick={() => handleCancel(showRetentionOfferInCancel)}
                disabled={actionLoading === "cancel" || !!retentionSuccessMessage}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "cancel" ? "Cancelling..." : "Yes, Cancel"}
              </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Usage & data */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Video usage */}
        <section className="glass-card p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Video Usage
          </h2>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-bold text-gray-900">
              {billing?.videos_used ?? 0}
            </span>
            <span className="text-sm text-gray-400 pb-1">
              / {billing?.video_limit ?? 3} videos
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, ((billing?.videos_used ?? 0) / (billing?.video_limit ?? 3)) * 100)}%`,
              backgroundColor:
                  (billing?.videos_used ?? 0) >= (billing?.video_limit ?? 3)
                    ? "#ef4444"
                    : "#7c3aed",
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {billing?.can_create_video
              ? `${(billing?.video_limit ?? 3) - (billing?.videos_used ?? 0)} videos remaining`
              : "Video limit reached"}
          </p>
        </section>

        {/* Account data */}
        <section className="glass-card p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Your Data
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total Projects</span>
              <span className="text-sm font-medium text-gray-900">
                {dataSummary?.total_projects ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Videos Rendered</span>
              <span className="text-sm font-medium text-gray-900">
                {dataSummary?.total_videos_rendered ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total Assets</span>
              <span className="text-sm font-medium text-gray-900">
                {dataSummary?.total_assets ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Member Since</span>
              <span className="text-sm font-medium text-gray-900">
                {dataSummary?.account_created
                  ? formatDate(dataSummary.account_created)
                  : "--"}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Available Plans */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            {isPaid ? "Your Plan" : "Available Plans"}
          </h2>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${billingCycle === "monthly" ? "text-gray-900" : "text-gray-400"}`}>
              Monthly
            </span>
            <button
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Free */}
          <div className={`glass-card p-5 flex flex-col ${!isPaid && billing?.plan === "free" ? "ring-2 ring-purple-200" : ""}`}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Free</h3>
              <p className="text-xs text-gray-400 mt-0.5">Try it out</p>
            </div>
            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">$0</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />3 videos free</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2"><CheckMark />Custom video templates</li>
              <li className="flex items-start gap-2 text-gray-300"><CrossMark />Unlimited AI edit & image generation</li>
              <li className="flex items-start gap-2 text-gray-300"><CrossMark />Premium voiceover + cloning</li>
            </ul>
            {!isPaid && billing?.plan === "free" ? (
              <div className="py-2 text-center text-xs font-medium text-purple-500 bg-purple-50 rounded-lg">
                Current plan
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-gray-400">--</div>
            )}
          </div>

          {/* Per Video */}
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
              onClick={async () => {
                setActionLoading("per_video");
                try {
                  const res = await createPerVideoCheckout();
                  if (res.data.checkout_url) window.location.href = res.data.checkout_url;
                } catch (err) {
                  console.error("Per-video checkout error:", err);
                } finally {
                  setActionLoading(null);
                }
              }}
              disabled={actionLoading === "per_video" || isPaid}
              className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
            >
              {actionLoading === "per_video" ? "Redirecting…" : "Buy a video"}
            </button>
          </div>

          {/* Standard */}
          <div className={`glass-card p-5 flex flex-col ${isStandard ? "ring-2 ring-purple-200" : ""}`}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Standard</h3>
              <p className="text-xs text-gray-400 mt-0.5">30 videos/month</p>
            </div>
            <div className="mb-4">
              {billingCycle === "annual" ? (
                <>
                  <span className="text-2xl font-bold text-gray-900">$20</span>
                  <span className="text-xs text-gray-400 ml-1">/month</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-gray-400 line-through">$25/mo</span>
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">$240 billed annually</p>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-gray-900">$25</span>
                  <span className="text-xs text-gray-400 ml-1">/month</span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    or <span className="font-medium text-gray-500">$20/mo</span> billed annually
                  </p>
                </>
              )}
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />30 videos / month</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
              <li className="flex items-start gap-2"><CheckMark />Custom video templates</li>
              <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
              <li className="flex items-start gap-2"><CheckMark />Priority support</li>
            </ul>
            {isStandard ? (
              <div className="py-2 text-center text-xs font-medium text-purple-500 bg-purple-50 rounded-lg">
                Current plan
              </div>
            ) : isPro ? (
              <div className="py-2 text-center text-xs text-gray-400">You're on Pro</div>
            ) : (
              <button
                onClick={handleStandardUpgrade}
                disabled={actionLoading === "standard"}
                className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "standard" ? "Redirecting..." : "Upgrade to Standard"}
              </button>
            )}
          </div>

          {/* Pro */}
          <div className={`glass-card p-5 flex flex-col relative ${user?.plan === "pro" ? "ring-2 ring-purple-200" : "ring-2 ring-purple-100"}`}>
            {!isPaid && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded-full">
                  Best value
                </span>
              </div>
            )}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Pro</h3>
              <p className="text-xs text-gray-400 mt-0.5">For serious creators</p>
            </div>
            <div className="mb-4">
              {billingCycle === "annual" ? (
                <>
                  <span className="text-2xl font-bold text-gray-900">$40</span>
                  <span className="text-xs text-gray-400 ml-1">/month</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-gray-400 line-through">$50/mo</span>
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">$480 billed annually</p>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-gray-900">$50</span>
                  <span className="text-xs text-gray-400 ml-1">/month</span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    or <span className="font-medium text-gray-500">$40/mo</span> billed annually
                  </p>
                </>
              )}
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />100 videos / month</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
              <li className="flex items-start gap-2"><CheckMark />Custom video templates</li>
              <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
              <li className="flex items-start gap-2"><CheckMark />Priority support</li>
            </ul>
            {user?.plan === "pro" ? (
              <div className="py-2 text-center text-xs font-medium text-purple-500 bg-purple-50 rounded-lg">
                Current plan
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade()}
                disabled={actionLoading === "upgrade"}
                className="w-full py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "upgrade" ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            )}
          </div>

          {/* Customized Subscription */}
          <div className="glass-card p-5 flex flex-col border-2 border-purple-300">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Customized</h3>
              <p className="text-xs text-gray-400 mt-0.5">Enterprise & teams</p>
            </div>
            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">Custom</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />Custom video limits</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2"><CheckMark />Unlimited AI edit & image generation</li>
              <li className="flex items-start gap-2"><CheckMark />Custom video templates</li>
              <li className="flex items-start gap-2"><CheckMark />Premium voiceover + cloning</li>
              <li className="flex items-start gap-2"><CheckMark />Custom integrations</li>
              <li className="flex items-start gap-2"><CheckMark />Dedicated support</li>
              <li className="flex items-start gap-2"><CheckMark />On-prem deployment available</li>
              <li className="flex items-start gap-2"><CheckMark />Custom pricing</li>
            </ul>
            <button
              onClick={() => navigate("/contact")}
              className="w-full py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Contact Sales
            </button>
          </div>
        </div>

        {/* Cost comparison */}
        <p className="text-center text-[11px] text-gray-400 mt-3">
          Pro works out to just <span className="font-medium text-gray-500">{billingCycle === "annual" ? "$0.40" : "$0.50"}</span> per video — 10x cheaper than pay-per-video.
        </p>
      </section>

      {/* Invoices */}
      <section className="glass-card p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Invoice History
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {inv.number || inv.id.slice(0, 20)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(inv.created)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="text-sm font-medium text-gray-900 min-w-[60px] text-right">
                    {formatCurrency(inv.amount_paid || inv.amount_due, inv.currency)}
                  </span>
                  <div className="flex gap-1">
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                        title="View invoice"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    {inv.invoice_pdf && (
                      <a
                        href={inv.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="glass-card p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Account
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <span className="px-2.5 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
              Active
            </span>
          </div>
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Data retention: {isPro ? "30 days" : "24 hours"} after last activity
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isPro
                  ? "Your files are kept for 30 days. Upgrade extends retention automatically."
                  : "Free tier data is cleaned up after 24 hours. Upgrade to Pro for 30-day retention."}
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-red-100">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Delete my account
            </button>
          </div>
        </div>
      </section>

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete your account?"
        warningMessage="Deleting your account will permanently remove all your data and cancel any active subscription. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteAccount}
      />
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

function CrossMark() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    paid: "bg-green-50 text-green-600",
    open: "bg-amber-50 text-amber-600",
    draft: "bg-gray-50 text-gray-500",
    uncollectible: "bg-red-50 text-red-600",
    void: "bg-gray-50 text-gray-400",
  };

  const label = status || "unknown";
  const cls = styles[label] || "bg-gray-50 text-gray-500";

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${cls}`}>
      {label}
    </span>
  );
}
