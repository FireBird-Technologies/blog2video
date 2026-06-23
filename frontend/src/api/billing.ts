import api from "./http";
import {
  BillingStatus,
  ChangePlanPreview,
  ChangePlanResult,
  DataSummary,
  Invoice,
  PlanInfo,
  SubscriptionDetail,
} from "./types";

export type PlanKey = "standard" | "pro";
export type BillingCycle = "monthly" | "annual" | "lifetime";

// ─── Billing API ──────────────────────────────────────────

export type CheckoutPlan = "pro" | "standard";

export const createCheckoutSession = (
  options:
    | {
        plan?: CheckoutPlan;
        billing_cycle?: BillingCycle;
        apply_third_video_offer?: boolean;
      }
    | "monthly"
    | "annual"
    = "monthly"
) => {
  const plan =
    typeof options === "string" ? "pro" : (options?.plan ?? "pro");
  const billing_cycle =
    typeof options === "string" ? options : (options?.billing_cycle ?? "monthly");
  const apply_third_video_offer =
    typeof options === "string" ? false : (options?.apply_third_video_offer ?? false);
  return api.post<{ checkout_url: string }>("/billing/checkout", {
    plan,
    billing_cycle,
    apply_third_video_offer,
  });
};

export const createPerVideoCheckout = (
  options?: number | { projectId?: number; quantity?: number }
) => {
  const projectId =
    typeof options === "number" ? options : options?.projectId;
  const quantity =
    typeof options === "object" && options?.quantity ? options.quantity : 1;
  return api.post<{ checkout_url: string }>("/billing/checkout-per-video", {
    project_id: projectId ?? null,
    quantity,
  });
};

export const createPortalSession = () =>
  api.post<{ portal_url: string }>("/billing/portal");

export const getBillingStatus = () =>
  api.get<BillingStatus>("/billing/status");

export const getSubscriptionDetail = () =>
  api.get<SubscriptionDetail | null>("/billing/subscription");

export const getInvoices = () => api.get<Invoice[]>("/billing/invoices");

export const getDataSummary = () => api.get<DataSummary>("/billing/data-summary");

export const getPlans = () => api.get<PlanInfo[]>("/billing/plans");

export const cancelSubscription = (body?: { declined_retention_offer?: boolean }) =>
  api.post("/billing/cancel", body ?? {});

export const recordRetentionOfferImpression = () =>
  api.post<{ recorded: boolean; shown_count: number; eligible: boolean }>(
    "/billing/retention-offer/impression"
  );

export const acceptRetentionOffer = () =>
  api.post<{ status: string; message: string }>("/billing/retention-offer/accept");

export const resumeSubscription = () => api.post("/billing/resume");

export const previewPlanChange = (plan: PlanKey, billing_cycle: BillingCycle) =>
  api.post<ChangePlanPreview>("/billing/change-plan-preview", {
    plan,
    billing_cycle,
  });

export const changePlan = (plan: PlanKey, billing_cycle: BillingCycle) =>
  api.post<ChangePlanResult>("/billing/change-plan", { plan, billing_cycle });

export const cancelScheduledPlanChange = () =>
  api.post<{ status: string; message: string }>("/billing/cancel-scheduled-change");

