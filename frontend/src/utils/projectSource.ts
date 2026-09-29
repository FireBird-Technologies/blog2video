/**
 * How a project's `blog_url` should be shown. Mirrors
 * backend/app/services/source_urls.py: `upload://`, `ghost://`,
 * `beehiiv://` and `wordpress://` are placeholders, never links.
 */
const PLACEHOLDER_LABELS: [string, string][] = [
  ["upload://", "Uploaded documents"],
  ["ghost://", "Imported from Ghost (draft)"],
  ["beehiiv://", "Imported from Beehiiv (draft)"],
  ["wordpress://", "Imported from WordPress (draft)"],
];

export const isPlaceholderSourceUrl = (url?: string | null): boolean =>
  !!url && PLACEHOLDER_LABELS.some(([prefix]) => url.startsWith(prefix));

/** Human label for a placeholder URL, or null when it's a real link. */
export const placeholderSourceLabel = (url?: string | null): string | null => {
  if (!url) return null;
  const hit = PLACEHOLDER_LABELS.find(([prefix]) => url.startsWith(prefix));
  return hit ? hit[1] : null;
};

/** Host + path, lowercase, no scheme or trailing slash (mirrors backend source_urls.site_key). */
const siteKey = (url?: string | null): string | null => {
  const raw = (url ?? "").trim();
  if (!raw || isPlaceholderSourceUrl(raw)) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
};

/**
 * The project's source post id, if it lives on the site this connection points
 * at — else null. Post ids are only unique per site (WordPress's are small
 * integers), so another connected site's "post 9" is a different post.
 * Mirrors backend source_urls.source_matches_connection.
 */
export const sourcePostIdFor = (
  project: { source_platform?: string | null; source_post_id?: string | null; source_site?: string | null; blog_url?: string | null },
  connection: { platform: string; site_url?: string | null; publication_id?: string | null } | null | undefined
): string | null => {
  if (!connection || !project.source_post_id || project.source_platform !== connection.platform) return null;
  const current = connection.platform === "beehiiv" ? connection.publication_id ?? null : siteKey(connection.site_url);
  if (project.source_site) return project.source_site === current ? project.source_post_id : null;
  // Imported before the site was recorded: Ghost/Beehiiv ids are globally unique;
  // WordPress only if the post's public URL is under the connected site.
  if (connection.platform === "ghost" || connection.platform === "beehiiv") return project.source_post_id;
  const urlKey = siteKey(project.blog_url);
  return current && urlKey && (urlKey === current || urlKey.startsWith(`${current}/`))
    ? project.source_post_id
    : null;
};
