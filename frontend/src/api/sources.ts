import api from "./http";
import type { BulkProjectItem } from "./client";

// ─── Content sources (Ghost / Beehiiv / WordPress) ───────────────────
//
// The user connects once, then imports posts — drafts and paywalled posts
// included — straight into projects. Ghost and Beehiiv use an API key;
// WordPress uses an application password (self-hosted) or an OAuth popup
// (WordPress.com). Credentials are stored encrypted server-side and never
// come back to the client.

export type ContentSourcePlatform = "ghost" | "beehiiv" | "wordpress";

export const CONTENT_SOURCE_LABELS: Record<ContentSourcePlatform, string> = {
  ghost: "Ghost",
  beehiiv: "Beehiiv",
  wordpress: "WordPress",
};

/** Platforms shown in the Integrations UI (every content source). */
export type IntegrationPlatform = ContentSourcePlatform;

/** How a WordPress connection authenticates. */
export type WordPressAuthKind = "app_password" | "wpcom_oauth";

export const INTEGRATION_PLATFORMS: IntegrationPlatform[] = ["ghost", "beehiiv", "wordpress"];

export const INTEGRATION_LABELS: Record<IntegrationPlatform, string> = CONTENT_SOURCE_LABELS;

/** Icon-only crops of the official logos the landing page uses (those files are
 *  full wordmarks, which would repeat the name shown next to the icon). */
export const INTEGRATION_LOGOS: Record<IntegrationPlatform, string> = {
  ghost: "/ghost-icon.webp",
  beehiiv: "/beehiiv-icon.svg",
  wordpress: "/wordpress-icon-mono.svg",
};

export interface ContentSourcesConfig {
  /** False when the server can't store keys securely — hide connect UI. */
  enabled: boolean;
  platforms: ContentSourcePlatform[];
  /** False when the WordPress.com OAuth app isn't configured on the server. */
  wordpress_com_enabled?: boolean;
}

export interface ContentSourceConnection {
  platform: ContentSourcePlatform;
  connected: boolean;
  /** "active" | "revoked" | "error". Anything but active needs a reconnect. */
  status: string;
  account_name: string | null;
  account_avatar_url: string | null;
  site_url: string | null;
  publication_id: string | null;
  /** WordPress only: self-hosted (application password) or WordPress.com. */
  auth_kind?: WordPressAuthKind | null;
  /** WordPress self-hosted only: the WordPress username. */
  username?: string | null;
  connected_at: string | null;
}

/** What a WordPress connection can put into a post (returned on connect). */
export interface WordPressCapabilities {
  can_upload_video: boolean;
  can_upload_images: boolean;
  can_embed: boolean;
  can_edit_others?: boolean;
  upload_limit_bytes?: number | null;
  reason?: string | null;
}

export interface BeehiivPublication {
  id: string;
  name: string;
}

export type ConnectSourceResponse =
  | { connection: ContentSourceConnection }
  | { needs_publication: BeehiivPublication[] };

export interface SourcePost {
  id: string;
  title: string;
  status: "published" | "draft" | "scheduled" | "pending" | "private" | string;
  published_at: string | null;
  updated_at: string | null;
  feature_image: string | null;
  /** Public URL — only for published posts. */
  url: string | null;
  /** Members-only / premium. */
  paid: boolean;
  excerpt: string | null;
}

export interface SourcePostsPage {
  posts: SourcePost[];
  page: number;
  pages: number;
  total: number | null;
  has_more: boolean;
}

/** Same settings as a bulk item, minus the URL (the post supplies it). */
export type SourceImportSettings = Omit<BulkProjectItem, "blog_url"> & {
  bgm_track_id?: string | null;
  bgm_volume?: number;
};

export interface SourceImportResponse {
  project_ids: number[];
  failed: { post_id: string; error_code: string; message: string }[];
}

export interface NewsletterSnippet {
  html: string;
  thumbnail_url: string;
  watch_url: string;
}

export const isSourceConnectionUsable = (c?: ContentSourceConnection | null) =>
  !!c && c.connected && c.status === "active";

export const getContentSourcesConfig = () =>
  api.get<ContentSourcesConfig>("/sources/config");

export const getContentSourceConnections = () =>
  api.get<{ connections: ContentSourceConnection[] }>("/sources/connections");

export const connectContentSource = (
  platform: ContentSourcePlatform,
  payload: { api_key: string; site_url?: string; publication_id?: string }
) => api.post<ConnectSourceResponse>(`/sources/${platform}/connect`, payload);

/** Self-hosted WordPress: site URL + username + application password. */
export const connectWordPress = (payload: { site_url: string; username: string; app_password: string }) =>
  api.post<{ connection: ContentSourceConnection; capabilities: WordPressCapabilities }>(
    "/sources/wordpress/connect",
    { site_url: payload.site_url, username: payload.username, api_key: payload.app_password }
  );

/** WordPress.com: the consent URL to open in a popup. */
export const getWordPressComConnectUrl = () =>
  api.get<{ authorize_url: string }>("/sources/wordpress/connect-url");

export const disconnectContentSource = (platform: ContentSourcePlatform) =>
  api.delete<{ ok: boolean }>(`/sources/${platform}`);

export const listSourcePosts = (
  platform: ContentSourcePlatform,
  params: { page?: number; search?: string } = {}
) =>
  api.get<SourcePostsPage>(`/sources/${platform}/posts`, {
    params: { page: params.page ?? 1, search: params.search || undefined },
  });

export const importSourcePosts = (
  platform: ContentSourcePlatform,
  postIds: string[],
  settings: SourceImportSettings,
  /** Mark the projects as bulk even when postIds has one entry (split multi-post import). */
  bulk = false
) =>
  api.post<SourceImportResponse>(`/sources/${platform}/import`, {
    ...settings,
    post_ids: postIds,
    ...(bulk ? { bulk: true } : {}),
  });

/** How a video goes into a post when uploading it isn't possible. */
export type SourceFallback = "embed" | "link";

/**
 * How a Ghost/WordPress publish should put the video in, given the site's
 * plan, the user's role and the upload cap. For Beehiiv (always a thumbnail)
 * it only says whether the plan may write posts at all.
 */
export interface PublishCheck {
  /**
   * "video": upload the MP4. "embed": our player in an HTML block. "link": a
   * click-to-watch thumbnail. "ask": over a known upload cap — offer `fallback`.
   */
  recommended: "video" | "embed" | "link" | "ask";
  fallback: SourceFallback;
  /** Per-file upload cap in bytes; null when unknown. */
  limit_bytes: number | null;
  /** The rendered MP4's size; null before the first render. */
  video_bytes: number | null;
  /** Why the video can't be uploaded (WordPress plan/role), when it can't. */
  reason?: string | null;
  /** Beehiiv: the plan can't write posts (only Max/Enterprise can). */
  plan_required?: boolean;
}

/** Platforms that choose between uploading, embedding and a thumbnail. */
export const supportsPublishCheck = (p: IntegrationPlatform): p is "ghost" | "wordpress" =>
  p === "ghost" || p === "wordpress";

export const getPublishCheck = (platform: "ghost" | "wordpress" | "beehiiv", projectId: number) =>
  api.get<PublishCheck>(`/sources/${platform}/publish-check`, { params: { project_id: projectId } });

export const getNewsletterSnippet = (projectId: number) =>
  api.get<NewsletterSnippet>(`/sources/projects/${projectId}/newsletter-snippet`);

/** The machine-readable `error_code` of a sources/publish API error, if any. */
export const sourceErrorCode = (err: unknown): string | null => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === "object") {
    const code = (detail as { error_code?: unknown }).error_code;
    if (typeof code === "string") return code;
  }
  return null;
};

/** Pull the human message out of a sources/publish API error. */
export const sourceErrorMessage = (err: unknown, fallback: string): string => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const d = detail as { message?: string };
    if (d.message) return d.message;
  }
  return fallback;
};
