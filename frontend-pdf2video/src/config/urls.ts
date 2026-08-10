/** Where signed-in users land — the main app on blog2video.app in production. */
const DEFAULT_BLOG2VIDEO_URL = "https://blog2video.app";

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

export const BLOG2VIDEO_URL = normalizeOrigin(
  import.meta.env.VITE_BLOG2VIDEO_URL || DEFAULT_BLOG2VIDEO_URL,
);

/** Post-login URL on the main app — JWT handoff only (upload tab via markPdfOrigin on receive). */
export function buildBlog2VideoHandoffUrl(token: string): string {
  return `${BLOG2VIDEO_URL}/dashboard?token=${encodeURIComponent(token)}`;
}
