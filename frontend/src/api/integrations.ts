import api, { BACKEND_URL } from "./http";

// ─── Social publishing (YouTube / X) ──────────────────────

export type SocialPlatform = "youtube" | "x";

export interface IntegrationsConfig {
  youtube_enabled: boolean;
  x_enabled: boolean;
}

export interface SocialConnection {
  platform: SocialPlatform;
  connected: boolean;
  account_name: string | null;
  account_handle: string | null;
  account_avatar_url: string | null;
  status: string;
  /** False when the grant is missing a scope we need — ask for a reconnect. */
  scopes_ok: boolean;
}

export type PublishJobStatus =
  | "pending_render"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface PublishJob {
  id: number;
  platform: SocialPlatform;
  status: PublishJobStatus;
  /** 0..1 */
  progress: number;
  uploaded_bytes: number;
  total_bytes: number;
  title: string;
  /** Echoed back so a re-upload can prefill from the previous attempt. */
  description: string | null;
  tags: string[];
  privacy_status: string;
  source: string;
  post_id: string | null;
  post_url: string | null;
  /** The platform forced a stricter privacy than we asked for. */
  forced_private: boolean;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean;
  created_at: string | null;
  completed_at: string | null;
}

export interface PublishRequest {
  platform: SocialPlatform;
  title: string;
  description?: string;
  tags?: string[];
  privacy_status?: "public" | "unlisted" | "private";
  made_for_kids?: boolean;
  category_id?: string;
  /** "auto" renders only when there is nothing to publish yet. */
  source?: "existing" | "rerender" | "auto";
  resolution?: string;
}

export interface PublishResponse {
  job: PublishJob;
  render_started: boolean;
  render_run_id: string | null;
}

/** Jobs that are still going, so the UI knows to keep polling. */
export const isPublishJobActive = (job: PublishJob): boolean =>
  job.status === "pending_render" ||
  job.status === "queued" ||
  job.status === "running";

/**
 * Origin the OAuth popup posts its result from — the BACKEND, since the
 * callback page is served by the API. The popup's own `postMessage` target is
 * the frontend origin; this is the other half of that pair, and the value a
 * `message` listener must check `event.origin` against.
 */
export const oauthMessageOrigin = (): string => {
  try {
    return new URL(BACKEND_URL || window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const getIntegrationsConfig = () =>
  api.get<IntegrationsConfig>("/integrations/config");

export const getSocialConnections = () =>
  api.get<{ connections: SocialConnection[] }>("/integrations/connections");

export const getSocialConnectUrl = (platform: SocialPlatform) =>
  api.get<{ authorize_url: string }>(`/integrations/${platform}/connect-url`);

export const disconnectSocialAccount = (platform: SocialPlatform) =>
  api.delete<{ detail: string }>(`/integrations/${platform}`);

export const publishProject = (projectId: number, payload: PublishRequest) =>
  api.post<PublishResponse>(
    `/integrations/projects/${projectId}/publish`,
    payload
  );

export const getPublishStatus = (projectId: number) =>
  api.get<{ jobs: PublishJob[] }>(
    `/integrations/projects/${projectId}/publish-status`
  );

export const cancelPublishJob = (projectId: number, jobId: number) =>
  api.post<{ detail: string; status: string }>(
    `/integrations/projects/${projectId}/publish/${jobId}/cancel`
  );

export const retryPublishJob = (projectId: number, jobId: number) =>
  api.post<PublishJob>(
    `/integrations/projects/${projectId}/publish/${jobId}/retry`
  );
