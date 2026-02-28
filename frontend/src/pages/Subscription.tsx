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
  resumeSubscription,
  BillingStatus,
  SubscriptionDetail,
  Invoice,
  DataSummary,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

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
      const res = await createCheckoutSession(cycle || billingCycle);
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error("Failed to start checkout:", err);
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

  const handleCancel = async () => {
    setActionLoading("cancel");
    try {
      await cancelSubscription();
      await refreshUser();
      await loadAll();
      setShowCancelConfirm(false);
    } catch (err) {
      console.error("Failed to cancel:", err);
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

  const isPro = user?.plan === "pro";

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
                    onClick={() => setShowCancelConfirm(true)}
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel subscription?</h3>
            <p className="text-sm text-gray-500 mb-1">
              Your Pro access will remain active until the end of your current billing period
              {subscription?.current_period_end && (
                <> ({formatDate(subscription.current_period_end)})</>
              )}.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              After that, you'll be downgraded to the Free plan. You can resubscribe anytime.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Keep Plan
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading === "cancel"}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "cancel" ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
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
              / {billing?.video_limit ?? 1} videos
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, ((billing?.videos_used ?? 0) / (billing?.video_limit ?? 1)) * 100)}%`,
                backgroundColor:
                  (billing?.videos_used ?? 0) >= (billing?.video_limit ?? 1)
                    ? "#ef4444"
                    : "#7c3aed",
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {billing?.can_create_video
              ? `${(billing?.video_limit ?? 1) - (billing?.videos_used ?? 0)} videos remaining`
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
            {isPro ? "Your Plan" : "Available Plans"}
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Free */}
          <div className={`glass-card p-5 flex flex-col ${!isPro && billing?.plan === "free" ? "ring-2 ring-purple-200" : ""}`}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Free</h3>
              <p className="text-xs text-gray-400 mt-0.5">Try it out</p>
            </div>
            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">$0</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />First video free</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2 text-gray-300"><CrossMark />AI chat editor</li>
              <li className="flex items-start gap-2 text-gray-300"><CrossMark />Remotion Studio</li>
            </ul>
            {!isPro && billing?.plan === "free" ? (
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
              <span className="text-2xl font-bold text-gray-900">$5</span>
              <span className="text-xs text-gray-400 ml-1">/video</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1 text-xs text-gray-500">
              <li className="flex items-start gap-2"><CheckMark />No subscription needed</li>
              <li className="flex items-start gap-2"><CheckMark />AI script generation</li>
              <li className="flex items-start gap-2"><CheckMark />ElevenLabs voiceover</li>
              <li className="flex items-start gap-2"><CheckMark />Render & download MP4</li>
              <li className="flex items-start gap-2"><CheckMark />AI chat editor</li>
              <li className="flex items-start gap-2"><CheckMark />Remotion Studio</li>
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
              disabled={actionLoading === "per_video"}
              className="w-full py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60"
            >
              {actionLoading === "per_video" ? "Redirecting…" : "Buy a video"}
            </button>
          </div>

          {/* Pro */}
          <div className={`glass-card p-5 flex flex-col relative ${isPro ? "ring-2 ring-purple-200" : "ring-2 ring-purple-100"}`}>
            {!isPro && (
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
              <li className="flex items-start gap-2"><CheckMark />AI chat editor</li>
              <li className="flex items-start gap-2"><CheckMark />Remotion Studio</li>
              <li className="flex items-start gap-2"><CheckMark />Priority support</li>
            </ul>
            {isPro ? (
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
              <li className="flex items-start gap-2"><CheckMark />AI chat editor</li>
              <li className="flex items-start gap-2"><CheckMark />Remotion Studio</li>
              <li className="flex items-start gap-2"><CheckMark />Custom integrations</li>
              <li className="flex items-start gap-2"><CheckMark />Dedicated support</li>
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
        </div>
      </section>
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
