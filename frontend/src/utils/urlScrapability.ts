// Always non-scrapable — block submission outright (no post/page exception).
export const HARD_BLOCKED_DOMAINS: string[] = [];

// Paywalled sites: allowed but warned, since scrapes often return a truncated/paywall stub.
export const PAYWALL_DOMAINS = ["nytimes.com"];

// Social sites: blocked only on the main page, but a specific post/reference is allowed
// (e.g. linkedin.com/feed/sjbgbreg, instagram.com/p/abc, x.com/user/status/123).
export const SOCIAL_DOMAINS = [
  "x.com",
  "twitter.com",
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
];

// Paths that are still "the main page" even though they aren't bare "/".
const SOCIAL_LANDING_PATHS = ["/feed", "/home", "/login", "/explore"];

// AI-chat share links + Google Docs: allowed but warned, because only PUBLIC shares scrape.
// Each rule is a domain plus the path prefixes that indicate a shared chat/document.
// These shapes change over time — keep them here so they're easy to extend.
const CHAT_SHARE_RULES: { domain: string; pathPrefixes: string[] }[] = [
  { domain: "chatgpt.com", pathPrefixes: ["/share/", "/c/"] },
  { domain: "chat.openai.com", pathPrefixes: ["/share/", "/c/"] },
  { domain: "claude.ai", pathPrefixes: ["/share/", "/chat/"] },
  { domain: "chat.deepseek.com", pathPrefixes: ["/share/", "/s/", "/a/"] },
  { domain: "gemini.google.com", pathPrefixes: ["/share/", "/app/"] },
  { domain: "grok.com", pathPrefixes: ["/share/", "/chat/"] },
  { domain: "x.ai", pathPrefixes: ["/share/"] },
  { domain: "perplexity.ai", pathPrefixes: ["/search/", "/page/"] },
  { domain: "chat.mistral.ai", pathPrefixes: ["/chat/", "/share/"] },
  { domain: "poe.com", pathPrefixes: ["/s/", "/share/"] },
  { domain: "copilot.microsoft.com", pathPrefixes: ["/share/"] },
  {
    domain: "docs.google.com",
    pathPrefixes: ["/document/d/", "/spreadsheets/d/", "/presentation/d/"],
  },
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

export const PUBLIC_SHARE_WARNING =
  "Make sure this chat/document is public — private links can't be scraped.";
export const PAYWALL_WARNING =
  "Paywalled articles may not scrape fully — use a free/gift link if you have one.";
export const MAYBE_UNSCRAPABLE_WARNING =
  "This link might not be scrapable — try a different one if you have it.";

export type UrlScrapability = "ok" | "blocked" | "warn";

export interface UrlClassification {
  kind: UrlScrapability;
  message?: string;
}

/** Parse a possibly scheme-less link into a URL. Returns null if unparseable. */
function parseUrl(s: string): URL | null {
  const trimmed = s.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Parse the hostname from a possibly scheme-less link, stripping a leading "www.". Returns null if unparseable. */
function getHostname(s: string): string | null {
  const url = parseUrl(s);
  return url ? url.hostname.replace(/^www\./, "") : null;
}

/** True if host equals the domain or is a subdomain of it (so "notnytimes.com" is NOT a match). */
function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** True if the path points at the site's main page (root or a known landing path). */
function isMainPage(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, ""); // strip trailing slashes
  return path === "" || SOCIAL_LANDING_PATHS.includes(path);
}

/**
 * Classify a link by how scrapable it is, with an optional message for "warn":
 *  - "blocked": known non-scrapable site, social main page, or adult site — disallow.
 *  - "warn": allowed but flagged (YouTube, or AI-chat/Docs share links — ensure public).
 *  - "ok": no known issue (existing dot/space validation still applies).
 */
export function classifyUrl(s: string): UrlClassification {
  const url = parseUrl(s);
  if (!url) return { kind: "ok" };

  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  if (HARD_BLOCKED_DOMAINS.some((d) => matchesDomain(host, d))) return { kind: "blocked" };
  if (ADULT_KEYWORDS.some((kw) => host.includes(kw))) return { kind: "blocked" };

  // Social: block the main page, allow a specific post/reference (silently).
  if (SOCIAL_DOMAINS.some((d) => matchesDomain(host, d))) {
    return isMainPage(path) ? { kind: "blocked" } : { kind: "ok" };
  }

  // AI-chat shares + Google Docs: warn only when the URL points at a shared chat/doc.
  const chatRule = CHAT_SHARE_RULES.find((r) => matchesDomain(host, r.domain));
  if (chatRule && chatRule.pathPrefixes.some((p) => path.startsWith(p))) {
    return { kind: "warn", message: PUBLIC_SHARE_WARNING };
  }

  if (PAYWALL_DOMAINS.some((d) => matchesDomain(host, d))) {
    return { kind: "warn", message: PAYWALL_WARNING };
  }

  if (WARN_DOMAINS.some((d) => matchesDomain(host, d))) {
    return { kind: "warn", message: MAYBE_UNSCRAPABLE_WARNING };
  }

  return { kind: "ok" };
}

/** Backwards-compatible enum-only classifier. */
export function classifyUrlScrapability(s: string): UrlScrapability {
  return classifyUrl(s).kind;
}

export { getHostname };
