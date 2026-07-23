import api from "./http";

// Login-gated free SEO tool generators. All calls go through the shared `api`
// axios instance so the Bearer token is auto-attached and 401s are handled
// centrally (see api/http.ts).

export interface VideoScriptResult {
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

export interface ThumbnailTextResult {
  options: string[];
}

export function generateThumbnailText(topic: string) {
  return api.post<ThumbnailTextResult>("/free-tools/thumbnail-text", { topic });
}

export interface YouTubeDescriptionResult {
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
  covers_limit: number | null; // null = unlimited
}

export function generateBookCover(description: string) {
  // Image generation is slow — allow a long timeout for this call specifically.
  return api.post<BookCoverResult>(
    "/free-tools/book-cover",
    { description },
    { timeout: 120000 }
  );
}
