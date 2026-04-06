/** Google Ads global site tag (gtag.js). Loads after DOM; blocked by many ad blockers. */
const AW_ID = "AW-18067602823";

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
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
