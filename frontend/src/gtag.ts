/** Google Ads global site tag (gtag.js). Loads after DOM; blocked by many ad blockers. */
const AW_ID = "AW-18067602823";
const PURCHASE_CONVERSION_LABEL = "GZllCIPyx5ccEIf7pqdD";
const GA4_ID = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_GA4_MEASUREMENT_ID : "") || "";

export function initGoogleAdsGtag(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __b2vGtagInit?: boolean };
  if (w.__b2vGtagInit) return;
  w.__b2vGtagInit = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js reads this queue; must push `arguments`, not a copied array
    window.dataLayer.push(arguments as unknown as never);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(AW_ID)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", AW_ID);
  if (GA4_ID) {
    window.gtag("config", GA4_ID);
  }
}

export function trackGoogleAdsPurchaseConversion(transactionId?: string | null): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
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

export function trackPageView(path: string): void {
  if (!GA4_ID) return;
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    send_to: GA4_ID,
  });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
