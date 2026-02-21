import api from "./http";
import {
  BillingStatus,
  DataSummary,
  Invoice,
  PlanInfo,
  SubscriptionDetail,
} from "./types";

// ─── Billing API ──────────────────────────────────────────

export const createCheckoutSession = (
  billingCycle: "monthly" | "annual" = "monthly"
) =>
  api.post<{ checkout_url: string }>("/billing/checkout", {
    billing_cycle: billingCycle,
  });

export const createPerVideoCheckout = (projectId?: number) =>
  api.post<{ checkout_url: string }>("/billing/checkout-per-video", {
    project_id: projectId ?? null,
  });

export const createPortalSession = () =>
  api.post<{ portal_url: string }>("/billing/portal");

export const getBillingStatus = () =>
  api.get<BillingStatus>("/billing/status");

export const getSubscriptionDetail = () =>
  api.get<SubscriptionDetail | null>("/billing/subscription");

export const getInvoices = () => api.get<Invoice[]>("/billing/invoices");

export const getDataSummary = () => api.get<DataSummary>("/billing/data-summary");

export const getPlans = () => api.get<PlanInfo[]>("/billing/plans");

export const cancelSubscription = () => api.post("/billing/cancel");

export const resumeSubscription = () => api.post("/billing/resume");

