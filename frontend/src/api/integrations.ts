import api, { BACKEND_URL } from "./http";

// ─── Social publishing (YouTube / X / LinkedIn) ──────────────────────

export type SocialPlatform = "youtube" | "x" | "linkedin";

/**
 * Everything a publish job can target. Ghost, Beehiiv and WordPress are content
 * sources (see ./sources.ts) rather than OAuth social platforms, but their
 * publishes run through the same queue, status polling and banner.
 */
export type PublishPlatform = SocialPlatform | "ghost" | "beehiiv" | "wordpress";

export interface IntegrationsConfig {
  youtube_enabled: boolean;
  x_enabled: boolean;
  linkedin_enabled: boolean;
}

/**
 * The one place a platform's display name lives.
 *
 * Previously each component kept its own map, and the banner's fell back to the
 * raw slug — which is exactly why nobody noticed it had gone stale: "linkedin"
 * in lowercase looks almost right. Keep this exhaustive over SocialPlatform so
 * adding a platform is a compile error rather than a silent wrong label.
 */
const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  ghost: "Ghost",
  beehiiv: "Beehiiv",
  wordpress: "WordPress",
};

export const platformLabel = (platform: string): string =>
  PLATFORM_LABELS[platform as PublishPlatform] ?? platform;

export interface SocialConnection {
  platform: SocialPlatform;
  connected: boolean;
  account_name: string | null;
  account_handle: string | null;
  account_avatar_url: string | null;
  status: string;
  /** False when the grant is missing a scope we need — ask for a reconnect. */
  scopes_ok: boolean;
  /** When the access token dies. Null when the provider did not say. */
  expires_at: string | null;
  /**
   * True when this grant expires shortly AND cannot be refreshed on the user's
   * behalf. LinkedIn is the case that matters: 60-day tokens with partner-gated
   * refresh, so the user has to reconnect by hand. YouTube and X refresh
   * silently and never set this.
   */
  expires_soon: boolean;
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
  platform: PublishPlatform;
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
  /** Ghost/Beehiiv/WordPress: the post the video was added to, and where. */
  target_post_id?: string | null;
  target_mode?: SourceTargetMode | null;
  /** Ghost/WordPress: how the video went in (see SourceDelivery). */
  delivery?: SourceDelivery;
  /** The platform forced a stricter privacy than we asked for. */
  forced_private: boolean;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean;
  created_at: string | null;
  completed_at: string | null;
}

/**
 * Who can see the post. Platform-specific: YouTube uses public/unlisted/private,
 * LinkedIn public ("Anyone") or connections. The server validates per platform,
 * so sending the wrong one is a 400 rather than a silent downgrade.
 */
export type PublishPrivacy = "public" | "unlisted" | "private" | "connections";

/** Where a content-source publish puts the video. "new_draft" never touches a live post. */
export type SourceTargetMode = "top" | "bottom" | "new_draft";

/**
 * How a Ghost/WordPress publish adds the video: upload the MP4, embed our
 * player (no upload cap), or — WordPress only, when neither is allowed — a
 * click-to-watch thumbnail linked to the watch page.
 */
export type SourceDelivery = "video" | "embed" | "link";

export interface PublishRequest {
  platform: PublishPlatform;
  title: string;
  description?: string;
  tags?: string[];
  privacy_status?: PublishPrivacy;
  made_for_kids?: boolean;
  category_id?: string;
  /** "auto" renders only when there is nothing to publish yet. */
  source?: "existing" | "rerender" | "auto";
  resolution?: string;
  /** Content sources. target_post_id defaults to the post the project was imported from. */
  target_post_id?: string;
  target_mode?: SourceTargetMode;
  /** Ghost/WordPress. "embed" skips the render and upload entirely. */
  delivery?: SourceDelivery;
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
