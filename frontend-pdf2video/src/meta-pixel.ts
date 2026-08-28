/**
 * Meta Pixel (browser-side fbq() calls). The base snippet that loads fbq and
 * fires the initial PageView lives in index.html, guarded on a non-empty
 * VITE_META_PIXEL_ID the same way index.html guards the GA4 snippet on
 * VITE_GA4_MEASUREMENT_ID — see the comment block there.
 *
 * Every event fired here has a server-side twin sent via the backend's
 * app/services/meta_capi.py, sharing the same eventID, so Meta's 48h dedup
 * window merges browser + server into one counted conversion instead of two.
 * See docs/meta-pixel-rollout-plan.md for the full event map.
 */
const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const PIXEL_ID = env?.VITE_META_PIXEL_ID || "";
const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export function isMetaPixelConfigured(): boolean {
  return Boolean(PIXEL_ID) && typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Fire a Meta Pixel event. `eventId` MUST match the event_id used by the
 * paired backend send_capi_event() call for the same real-world event, or
 * Meta will count the browser and server events as two separate conversions.
 */
export function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  eventId?: string
): void {
  if (!isMetaPixelConfigured()) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info("[MetaPixel] Skipped (not configured):", eventName, params);
    }
    return;
  }

  const options = eventId ? { eventID: eventId } : undefined;
  if (options) {
    window.fbq!("track", eventName, params, options);
  } else {
    window.fbq!("track", eventName, params);
  }

  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[MetaPixel] Fired", eventName, params, options);
  }
}

/** SPA route-change PageView — mirrors trackPageView in gtag.ts. */
export function trackMetaPageView(): void {
  if (!isMetaPixelConfigured()) return;
  window.fbq!("track", "PageView");
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
