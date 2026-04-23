import api from "./http";

export interface BlastEmailPayload {
  subject: string;
  body: string;
  password: string;
  user_filter?: "all" | "free" | "paid";
  limit?: number;
  offset?: number;
}

export interface CampaignStatus {
  campaign_id: number;
  subject: string;
  body?: string;
  status: "pending" | "running" | "done";
  total_users: number;
  sent_count: number;
  failed_count: number;
  errors: string[];
  created_at: string | null;
}

export interface CampaignListResponse {
  campaigns: CampaignStatus[];
  total_users: number;
}

export interface PreviewUser {
  id: number;
  email: string;
  name: string;
  plan: "free" | "standard" | "pro";
}

export interface PreviewUsersResponse {
  total: number;
  offset: number;
  limit: number;
  users: PreviewUser[];
}

export const previewUsers = (params: {
  password: string;
  user_filter?: string;
  limit?: number;
  offset?: number;
}) =>
  api.get<PreviewUsersResponse>("/admin/preview-users", { params });

export const sendBlastEmail = (payload: BlastEmailPayload) =>
  api.post<{ campaign_id: number; total_users: number; status: string }>(
    "/admin/send-blast-email",
    payload
  );

export const getCampaignStatus = (campaignId: number, password: string) =>
  api.get<CampaignStatus>(`/admin/blast-status/${campaignId}`, {
    params: { password },
  });

export const listCampaigns = (password: string) =>
  api.get<CampaignListResponse>("/admin/blast-campaigns", {
    params: { password },
  });

export const deleteCampaign = (campaignId: number, password: string) =>
  api.delete<{ deleted: number }>(`/admin/blast-campaigns/${campaignId}`, {
    params: { password },
  });

