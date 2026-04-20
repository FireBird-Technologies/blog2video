import api from "./http";

export interface BlastEmailPayload {
  subject: string;
  body: string;
  password: string;
}

export interface CampaignStatus {
  campaign_id: number;
  subject: string;
  status: "pending" | "running" | "done";
  total_users: number;
  sent_count: number;
  failed_count: number;
  already_reached: number;
  remaining: number;
  errors: string[];
  created_at: string | null;
}

export interface CampaignListResponse {
  campaigns: CampaignStatus[];
  total_users: number;
}

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

export const sendNextBatch = (campaignId: number, password: string) =>
  api.post<{ campaign_id: number; status: string }>(
    `/admin/blast-send-next/${campaignId}`,
    { password }
  );
