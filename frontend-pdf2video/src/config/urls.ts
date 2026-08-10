/** Where signed-in users land — the main app on blog2video.app in production. */
const DEFAULT_BLOG2VIDEO_URL = "https://blog2video.app";

/** BlogHub — the newsletter/blog directory in the same family of properties. */
const DEFAULT_BLOGHUB_URL = "https://bloghub.app";

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

export const BLOG2VIDEO_URL = normalizeOrigin(
  import.meta.env.VITE_BLOG2VIDEO_URL || DEFAULT_BLOG2VIDEO_URL,
);

export const BLOGHUB_URL = normalizeOrigin(
  import.meta.env.VITE_BLOGHUB_URL || DEFAULT_BLOGHUB_URL,
);

/** Post-login URL on the main app — JWT handoff only (upload tab via markPdfOrigin on receive). */
export function buildBlog2VideoHandoffUrl(token: string): string {
  return `${BLOG2VIDEO_URL}/dashboard?token=${encodeURIComponent(token)}`;
}

/**
 * Outbound links to the sibling properties, UTM-tagged so GA on the receiving
 * domain can attribute the referral (Acquisition → Traffic acquisition, then
 * break down by utm_content to see which surface here sent the visitor).
 *
 * Kept in one place because these are the only three domains that link to each
 * other: pdf2vid.com (documents in), blog2video.app (URLs in, and the app
 * itself), and bloghub.app (the directory that feeds both).
 */
function withUtm(base: string, path: string, content: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: "pdf2vid",
    utm_medium: "referral",
    utm_campaign: campaign,
    utm_content: content,
  });
  const normalizedPath = path && path !== "/" ? path : "";
  return `${base}${normalizedPath}?${params.toString()}`;
}

/** Link to blog2video.app — `content` names the surface, e.g. "footer", "tool_gate". */
export function blog2videoUrl(content: string, path = "/"): string {
  return withUtm(BLOG2VIDEO_URL, path, content, "blog2video");
}

/** Link to bloghub.app — `content` names the surface, e.g. "footer", "blog_body". */
export function bloghubUrl(content: string, path = "/"): string {
  return withUtm(BLOGHUB_URL, path, content, "bloghub");
}
