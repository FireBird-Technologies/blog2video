/**
 * Brand resolution.
 *
 * One Vite build serves two marketing brands from the same SPA: blog2video
 * (URL in, video out) and pdf2video (document in, video out). Everything past
 * the landing page — auth, dashboard, pipeline, pricing — is shared, so the
 * brand only decides which landing page renders at "/" and which domain the SEO
 * tags point at.
 *
 * This is a Vite SPA, not Next.js: there is no middleware to branch on the
 * request host. Resolution is therefore build-time (VITE_BRAND, which the
 * prerender step in scripts/build-seo.ts runs under) with a runtime hostname
 * fallback so a single deployment attached to both domains still does the right
 * thing in the browser.
 */

import { useSyncExternalStore } from "react";

export type BrandId = "blog2video" | "pdf2video";

export interface Brand {
  id: BrandId;
  siteName: string;
  siteUrl: string;
  defaultOgImage: string;
  /** Wordmark shown in the landing nav's square badge. */
  logoText: string;
  /** Lowercase wordmark for use inside running prose ("already use blog2video"). */
  wordmark: string;
  /** Which BlogUrlForm step-1 tab this brand's users should land on. */
  defaultFormMode: "url" | "upload";
}

const BRANDS: Record<BrandId, Brand> = {
  blog2video: {
    id: "blog2video",
    siteName: "Blog2Video",
    siteUrl: "https://blog2video.app",
    defaultOgImage: "https://blog2video.app/og-image-v2.png",
    logoText: "B2V",
    wordmark: "blog2video",
    defaultFormMode: "url",
  },
  pdf2video: {
    id: "pdf2video",
    siteName: "PDF2Video",
    // Live domain is pdf2vid.app; the brand id keeps the longer "pdf2video".
    siteUrl: "https://pdf2vid.app",
    // Falls back to the Blog2Video card until a pdf2video-specific OG image
    // lands in public/. Swap the filename here once it exists.
    defaultOgImage: "https://pdf2vid.app/og-image-v2.png",
    logoText: "P2V",
    wordmark: "PDF2Video",
    defaultFormMode: "upload",
  },
};

const BRAND_OVERRIDE_KEY = "b2v_brand_override";
/** Session-scoped brand, so navigating off the pdf2video landing keeps its identity. */
const BRAND_SESSION_KEY = "b2v_brand_session";

function isBrandId(value: string | undefined | null): value is BrandId {
  return value === "blog2video" || value === "pdf2video";
}

/**
 * Precedence: explicit build env → dev-only ?brand= / stored override →
 * hostname → blog2video. The fallback matters: every existing deployment and
 * local dev session must keep behaving exactly as it did before this file
 * existed.
 */
function resolveBrand(): Brand {
  // Vite inlines import.meta.env at build time; the prerender script runs under
  // plain Node via tsx, where it is undefined and the value lives in process.env
  // instead. Both are checked, or the pdf2video build would silently prerender
  // blog2video URLs.
  const viteBrand = import.meta.env?.VITE_BRAND as string | undefined;
  if (isBrandId(viteBrand)) return BRANDS[viteBrand];

  const nodeBrand =
    typeof globalThis !== "undefined" && "process" in globalThis
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
          ?.VITE_BRAND
      : undefined;
  if (isBrandId(nodeBrand)) return BRANDS[nodeBrand];

  // Node (the prerender script) has no window — stop here rather than throwing.
  if (typeof window === "undefined") return BRANDS.blog2video;

  // Dev-only escape hatch so both brands are testable on localhost:5173 without
  // editing /etc/hosts. Persisted so it survives the OAuth round trip.
  if (import.meta.env?.DEV) {
    try {
      const param = new URLSearchParams(window.location.search).get("brand");
      // ?brand=reset clears the override — without an explicit way out, a single
      // ?brand=pdf2video would pin every later localhost page to pdf2video.
      if (param === "reset") {
        localStorage.removeItem(BRAND_OVERRIDE_KEY);
        return BRANDS.blog2video;
      }
      if (isBrandId(param)) {
        localStorage.setItem(BRAND_OVERRIDE_KEY, param);
        return BRANDS[param];
      }
      const stored = localStorage.getItem(BRAND_OVERRIDE_KEY);
      if (isBrandId(stored)) return BRANDS[stored];
    } catch {
      // Private-mode localStorage can throw; fall through to hostname.
    }
  }

  if (window.location.hostname.includes("pdf2video")) return BRANDS.pdf2video;

  // Sticky session brand: a visitor who landed on the pdf2video page (including
  // via /pdf2video on the blog2video domain) keeps that identity while browsing
  // shared public pages — Blogs, Pricing, Help. Without this the navbar and
  // footer would flip back to Blog2Video on the first click off the landing page.
  try {
    const session = sessionStorage.getItem(BRAND_SESSION_KEY);
    if (isBrandId(session)) return BRANDS[session];
  } catch {
    // sessionStorage unavailable (private mode) — fall through.
  }

  return BRANDS.blog2video;
}

export const brand = resolveBrand();

export const isPdfBrand = brand.id === "pdf2video";

/* ───────────────────────── session brand ───────────────────────── */

const brandListeners = new Set<() => void>();
let sessionBrand: Brand = brand;

/**
 * Pin the brand for the rest of this tab's session.
 *
 * PdfLanding calls this on mount so shared public pages (Blogs, Pricing, Help)
 * keep the pdf2video identity when navigated to. It is session-scoped rather
 * than persistent: closing the tab returns to host-based resolution, so a user
 * who later visits blog2video.app directly is not stuck on the wrong brand.
 */
export function setSessionBrand(id: BrandId): void {
  try {
    sessionStorage.setItem(BRAND_SESSION_KEY, id);
  } catch {
    // Non-fatal: the in-memory value below still drives this page load.
  }
  if (sessionBrand.id === id) return;
  sessionBrand = BRANDS[id];
  brandListeners.forEach((fn) => fn());
}

export function getSessionBrand(): Brand {
  return sessionBrand;
}

export function subscribeBrand(fn: () => void): () => void {
  brandListeners.add(fn);
  return () => brandListeners.delete(fn);
}

/**
 * The active brand, re-rendering when the session brand changes. Use this in
 * shared chrome (header, footer) rather than the `brand` constant, which is
 * captured once at module load and cannot react to setSessionBrand.
 */
export function useBrand(): Brand {
  return useSyncExternalStore(subscribeBrand, getSessionBrand, getSessionBrand);
}

/** The other brand, for the reciprocal footer cross-link. */
export const otherBrand = isPdfBrand ? BRANDS.blog2video : BRANDS.pdf2video;

/* ─────────────────────────── favicon ─────────────────────────── */

/**
 * Rounded purple tile with the brand's badge text, matching the nav logo.
 *
 * Generated as an inline SVG rather than a file so a new brand needs no new
 * asset. blog2video keeps its existing /b2b.png — this only swaps the icon for
 * brands that have no artwork of their own.
 */
function faviconDataUri(text: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#9333ea"/><text x="32" y="33" font-family="Inter,Helvetica,Arial,sans-serif" font-size="${text.length > 3 ? 20 : 24}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Favicon href for a brand — a real file for blog2video, synthesized otherwise. */
export function brandFaviconHref(b: Brand = getSessionBrand()): string {
  return b.id === "blog2video" ? "/b2b.png" : faviconDataUri(b.logoText);
}

/**
 * Point the tab icon at the active brand. Safe to call on every render — it
 * no-ops when the href already matches.
 */
export function applyFavicon(b: Brand = getSessionBrand()): void {
  if (typeof document === "undefined") return;
  const href = brandFaviconHref(b);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") === href) return;
  link.setAttribute("type", b.id === "blog2video" ? "image/png" : "image/svg+xml");
  link.setAttribute("href", href);
}

/**
 * Look up a brand explicitly, ignoring host/env resolution.
 *
 * Needed by pages that render one brand's content while served from the other's
 * domain — PdfLanding is reachable at /pdf2video on blog2video.app, and its
 * shared sections must not fall back to the ambient brand there.
 */
export function getBrand(id: BrandId): Brand {
  return BRANDS[id];
}

/** The opposite brand, for reciprocal cross-links. */
export function counterpartOf(id: BrandId): Brand {
  return id === "pdf2video" ? BRANDS.blog2video : BRANDS.pdf2video;
}

/* ─────────────────────────── signup origin ─────────────────────────── */

const ORIGIN_KEY = "b2v_signup_origin";

/**
 * Remember that this user arrived through pdf2video, so the dashboard's
 * BlogUrlForm defaults to the Upload tab instead of Link.
 *
 * Called on PdfLanding mount rather than only at login — a visitor who browses
 * the marketing page, signs in, and lands on the dashboard should get the
 * document-first form even though the sign-in itself carries no brand.
 *
 * NOTE: localStorage is per-origin. This only survives into the dashboard when
 * the app is served on the pdf2video domain itself (both domains pointed at the
 * same deployment, no cross-origin redirect). If pdf2video ever redirects to
 * blog2video.app for the app shell, this flag will not be readable there and
 * origin needs to move to the user record instead.
 */
export function markPdfOrigin(): void {
  try {
    localStorage.setItem(ORIGIN_KEY, "pdf2video");
  } catch {
    // Ignore — a lost preference is not worth breaking the page over.
  }
}

export function cameFromPdf2Video(): boolean {
  try {
    return localStorage.getItem(ORIGIN_KEY) === "pdf2video";
  } catch {
    return false;
  }
}

/** Step-1 tab the create-project form should open on for this user. */
export function preferredFormMode(): "url" | "upload" | undefined {
  return cameFromPdf2Video() ? "upload" : undefined;
}
