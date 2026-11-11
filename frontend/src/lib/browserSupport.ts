// The Blog2Video extension is a Chrome Web Store extension, so it only installs
// in desktop Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, ...).
// Safari and Firefox can't install it, and mobile browsers don't support
// extensions at all.

export type ExtensionBrowserId = "chrome" | "edge" | "opera" | "brave" | "vivaldi";

export interface ExtensionBrowser {
  id: ExtensionBrowserId;
  /** Display name used in the button: "Add to {name}". */
  name: string;
  /** Official logo in /public. */
  logo: string;
}

const BROWSERS: Record<ExtensionBrowserId, ExtensionBrowser> = {
  chrome: { id: "chrome", name: "Chrome", logo: "/browser-logos/chrome.svg" },
  edge: { id: "edge", name: "Edge", logo: "/browser-logos/edge.svg" },
  opera: { id: "opera", name: "Opera", logo: "/browser-logos/opera.svg" },
  brave: { id: "brave", name: "Brave", logo: "/browser-logos/brave.svg" },
  vivaldi: { id: "vivaldi", name: "Vivaldi", logo: "/browser-logos/vivaldi.svg" },
};

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { brands?: { brand: string }[]; mobile?: boolean };
  brave?: { isBrave?: () => Promise<boolean> };
}

/**
 * Which extension-capable browser is this? Returns null for Safari, Firefox and
 * every mobile browser. Brave hides itself from the UA, so a sync call reports
 * it as Chrome; use `detectBraveAsync` to upgrade that answer.
 */
export function detectExtensionBrowser(): ExtensionBrowser | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorWithUAData;
  const ua = nav.userAgent || "";

  // Mobile (incl. Chrome on iOS "CriOS" / Android) can't install extensions.
  if (nav.userAgentData?.mobile) return null;
  if (/Android|iPhone|iPad|iPod|CriOS|EdgiOS|FxiOS|OPT\//i.test(ua)) return null;

  // Firefox and Safari: never.
  if (/Firefox\//i.test(ua)) return null;

  const brands = nav.userAgentData?.brands ?? [];
  const hasBrand = (re: RegExp) => brands.some((b) => re.test(b.brand));

  // Prefer UA Client Hints (every Chromium browser reports "Chromium"), then
  // fall back to the classic UA, where every Chromium browser keeps "Chrome/".
  const isChromium = brands.length
    ? hasBrand(/Chromium/i)
    : /Chrome\/|Chromium\//i.test(ua);
  if (!isChromium) return null;

  if (/OPR\//.test(ua) || hasBrand(/^Opera/i)) return BROWSERS.opera;
  if (/Edg\//.test(ua) || hasBrand(/Microsoft Edge/i)) return BROWSERS.edge;
  if (/Vivaldi\//.test(ua) || hasBrand(/Vivaldi/i)) return BROWSERS.vivaldi;
  if (hasBrand(/^Brave/i)) return BROWSERS.brave;
  // Arc and other Chromium forks are indistinguishable from Chrome.
  return BROWSERS.chrome;
}

/** Brave only identifies itself through this async API. */
export async function detectBraveAsync(): Promise<boolean> {
  try {
    return Boolean(await (navigator as NavigatorWithUAData).brave?.isBrave?.());
  } catch {
    return false;
  }
}

export function supportsChromeExtensions(): boolean {
  return detectExtensionBrowser() !== null;
}
