import api from "./http";

// Login-gated free SEO tool generators. All calls go through the shared `api`
// axios instance so the Bearer token is auto-attached and 401s are handled
// centrally (see api/http.ts).

/** Generation allowance returned by every tool endpoint. FREE allowances are
 *  lifetime; paid allowances refresh each billing period. */
export interface ToolQuota {
  used: number;
  limit: number;
}

/** Tool keys match TOOL_QUOTAS on the backend User model. */
export type ToolKey =
  | "book_cover"
  | "video_script"
  | "youtube_description"
  | "thumbnail_text";

/** Current allowance for every tool, so a widget can show the remaining count
 *  (and disable itself when exhausted) on load rather than after generating. */
export function fetchToolQuotas() {
  return api.get<{ quotas: Record<ToolKey, ToolQuota> }>("/free-tools/quota");
}

export interface VideoScriptResult extends ToolQuota {
  video_title: string;
  script_markdown: string;
}

export function generateVideoScript(
  topic: string,
  tone: string,
  length: string
) {
  return api.post<VideoScriptResult>("/free-tools/video-script", {
    topic,
    tone,
    length,
  });
}

export interface ThumbnailTextResult extends ToolQuota {
  options: string[];
}

export function generateThumbnailText(topic: string) {
  return api.post<ThumbnailTextResult>("/free-tools/thumbnail-text", { topic });
}

export interface YouTubeDescriptionResult extends ToolQuota {
  description: string;
  tags: string[];
}

export function generateYouTubeDescription(topic: string) {
  return api.post<YouTubeDescriptionResult>("/free-tools/youtube-description", {
    topic,
  });
}

export interface BookCoverResult {
  image_base64: string;
  covers_used: number;
  // Every plan now has a finite allowance; nullable only for older payloads.
  covers_limit: number | null;
}

export function generateBookCover(description: string) {
  // Image generation is slow — allow a long timeout for this call specifically.
  return api.post<BookCoverResult>(
    "/free-tools/book-cover",
    { description },
    { timeout: 120000 }
  );
}
