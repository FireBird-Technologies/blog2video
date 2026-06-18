// Known sites we can't scrape — block submission outright.
export const BLOCKED_DOMAINS = [
  "x.com",
  "twitter.com",
  "nytimes.com",
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
];

// Broad adult-site heuristic — match these substrings anywhere in the hostname.
export const ADULT_KEYWORDS = [
  "porn",
  "xxx",
  "xvideos",
  "xnxx",
  "onlyfans",
  "redtube",
  "xhamster",
  "adult",
  "nsfw",
  "sex",
];

// Sites that might not be scrapable — warn but still allow.
export const WARN_DOMAINS = ["youtube.com", "youtu.be", "m.youtube.com"];

export type UrlScrapability = "ok" | "blocked" | "warn";

/** Parse the hostname from a possibly scheme-less link, stripping a leading "www.". Returns null if unparseable. */
function getHostname(s: string): string | null {
  const trimmed = s.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True if host equals the domain or is a subdomain of it (so "notnytimes.com" is NOT a match). */
function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Classify a link by how scrapable it is:
 *  - "blocked": known non-scrapable site or adult site — disallow.
 *  - "warn": might not be scrapable (e.g. YouTube) — allow with a warning.
 *  - "ok": no known issue (existing dot/space validation still applies).
 */
export function classifyUrlScrapability(s: string): UrlScrapability {
  const host = getHostname(s);
  if (!host) return "ok";

  if (BLOCKED_DOMAINS.some((d) => matchesDomain(host, d))) return "blocked";
  if (ADULT_KEYWORDS.some((kw) => host.includes(kw))) return "blocked";
  if (WARN_DOMAINS.some((d) => matchesDomain(host, d))) return "warn";

  return "ok";
}
