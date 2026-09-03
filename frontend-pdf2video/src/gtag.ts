/**
 * Google Ads global site tag (gtag.js). Loads after DOM; blocked by many ad blockers.
 *
 * The GA4 property is NOT configured here — index.html installs it from
 * %VITE_GA4_MEASUREMENT_ID% so it is present in the prerendered SEO pages too.
 * This module only adds the Ads tag on top of that shared gtag queue.
 */
const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const AW_ID = env?.VITE_GOOGLE_ADS_ID || "";
const PURCHASE_CONVERSION_LABEL = env?.VITE_GOOGLE_ADS_PURCHASE_LABEL || "";

export function initGoogleAdsGtag(): void {
  if (typeof window === "undefined") return;
  if (!AW_ID) return;
  const w = window as Window & { __b2vGtagInit?: boolean };
  if (w.__b2vGtagInit) return;
  w.__b2vGtagInit = true;

  window.dataLayer = window.dataLayer ?? [];
  // Reuse the queue shim index.html already installed. Reassigning it here would
  // drop the GA4 config that ran before this module loaded.
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // gtag.js reads this queue; must push `arguments`, not a copied array
      window.dataLayer.push(arguments as unknown as never);
    };
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(AW_ID)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", AW_ID);
}

export function trackGoogleAdsPurchaseConversion(transactionId?: string | null): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  if (!AW_ID || !PURCHASE_CONVERSION_LABEL) return;
  const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

  const tx = (transactionId || "").trim();
  if (!tx) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info("[AdsConversion] Skipped: missing transaction_id");
    }
    return;
  }

  const dedupeKey = `ads_conversion_${tx}`;
  try {
    if (window.sessionStorage.getItem(dedupeKey)) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.info("[AdsConversion] Skipped duplicate:", tx);
      }
      return;
    }
  } catch {
    // Ignore storage failures and still attempt track.
  }

  window.gtag("event", "conversion", {
    send_to: `${AW_ID}/${PURCHASE_CONVERSION_LABEL}`,
    transaction_id: tx,
  });
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[AdsConversion] Fired", {
      send_to: `${AW_ID}/${PURCHASE_CONVERSION_LABEL}`,
      transaction_id: tx,
    });
  }

  try {
    window.sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // Ignore storage failures.
  }
}

/**
 * SPA route-change page_view. No `send_to`, so it lands on whichever GA4
 * property index.html configured — the id lives in env, not in this bundle.
 */
export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
  });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
