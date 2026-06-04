import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  changePlan,
  createPortalSession,
  previewPlanChange,
} from "../api/client";
import type { BillingCycle, PlanKey } from "../api/billing";
import type { ChangePlanPreview } from "../api/types";

const PLAN_NAMES: Record<string, string> = {
  standard_monthly: "Standard Monthly",
  standard_annual: "Standard Annual",
  pro_monthly: "Pro Monthly",
  pro_annual: "Pro Annual",
};

function fmt(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  open: boolean;
  plan: PlanKey;
  billingCycle: BillingCycle;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function PlanSwitchConfirmModal({
  open,
  plan,
  billingCycle,
  onClose,
  onSuccess,
}: Props) {
  const [preview, setPreview] = useState<ChangePlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
    setLoadingPreview(true);
    previewPlanChange(plan, billingCycle)
      .then((res) => {
        if (!cancelled) setPreview(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail =
          err?.response?.data?.detail ||
          err?.message ||
          "Couldn't load price preview. Please try again.";
        setPreviewError(detail);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, plan, billingCycle]);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await changePlan(plan, billingCycle);
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as {
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Plan change failed";
      if (status === 402) {
        try {
          const portal = await createPortalSession();
          window.location.href = portal.data.portal_url;
          return;
        } catch {
          setSubmitError(
            "Your card needs verification. Please open the billing portal to update payment.",
          );
        }
      } else {
        setSubmitError(detail);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const direction = preview?.direction;
  const targetName = preview ? PLAN_NAMES[preview.target_plan_slug] : "";
  const currentName = preview ? PLAN_NAMES[preview.current_plan_slug] : "";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={submitting ? undefined : onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loadingPreview && (
          <div className="py-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}

        {!loadingPreview && previewError && (
          <div className="py-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Couldn't load preview
            </h3>
            <p className="text-sm text-gray-500">{previewError}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!loadingPreview && preview && direction === "upgrade" && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Upgrade to {targetName}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              You'll be charged{" "}
              <span className="font-semibold text-gray-900">
                {fmt(preview.amount_due_today_cents, preview.currency)}
              </span>{" "}
              today.
            </p>
            {preview.proration_credit_cents > 0 && (
              <p className="text-sm text-gray-500 mb-3">
                We're applying a{" "}
                <span className="font-medium text-gray-700">
                  {fmt(preview.proration_credit_cents, preview.currency)}
                </span>{" "}
                credit for the remaining days on your current {currentName} plan.
              </p>
            )}
            <p className="text-xs text-gray-400 mb-5">
              Your new {targetName} billing period starts today.
            </p>
          </>
        )}

        {!loadingPreview && preview && direction === "downgrade" && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Switch to {targetName}
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              <span className="font-semibold text-green-700">No charge today.</span>{" "}
              Your {currentName} plan stays active until{" "}
              <span className="font-medium text-gray-900">
                {fmtDate(preview.effective_date_iso)}
              </span>
              .
            </p>
            <p className="text-sm text-gray-500 mb-3">
              On that date you'll switch to {targetName} and be charged{" "}
              <span className="font-medium text-gray-700">
                {fmt(preview.target_plan_price_cents, preview.currency)}
              </span>
              .
            </p>
            <p className="text-xs text-gray-400 mb-5">
              You can cancel this scheduled change anytime before then.
            </p>
          </>
        )}

        {!loadingPreview && preview && submitError && (
          <div className="mb-4 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
            {submitError}
          </div>
        )}

        {!loadingPreview && preview && (
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60"
            >
              {submitting ? "Processing…" : "Confirm"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
