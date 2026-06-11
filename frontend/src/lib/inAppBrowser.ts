// Detect in-app browsers (webviews) and help users escape to a real system
// browser. Google blocks OAuth inside embedded webviews ("disallowed_useragent"
// / "Use secure browsers" policy), so the Google Identity Services button
// silently fails when our site is opened from inside apps like LinkedIn,
// Instagram, or Facebook — most notably on iOS, where every in-app browser is a
// WKWebView. The only fix is to route the user out to their normal browser.
//
// Refs:
// - https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
// - https://github.com/luizcieslak/am-i-inapp-browser

export interface InAppBrowserInfo {
  /** True when we believe we're inside an embedded webview / in-app browser. */
  isInApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  /** Best-guess host app name, when identifiable from the UA. */
  app?: string;
}

function getUA(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

/**
 * Inspect the user agent to determine whether we're running inside an in-app
 * browser (webview) rather than a real, standalone browser.
 */
export function detectInAppBrowser(ua: string = getUA()): InAppBrowserInfo {
  const isIOS = /iPhone|iPod|iPad/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // Apps that advertise themselves in the UA string.
  const namedApps: Array<{ re: RegExp; app: string }> = [
    { re: /FBAN|FBAV|FB_IAB/i, app: "Facebook" },
    { re: /Instagram/i, app: "Instagram" },
    { re: /LinkedInApp|LinkedIn/i, app: "LinkedIn" },
    { re: /\bLine\//i, app: "Line" },
    { re: /Twitter|TwitterAndroid/i, app: "Twitter" },
    { re: /Snapchat/i, app: "Snapchat" },
    { re: /Pinterest/i, app: "Pinterest" },
    { re: /TikTok|musical_ly|BytedanceWebview/i, app: "TikTok" },
    { re: /GSA\//i, app: "Google App" },
  ];

  let app: string | undefined;
  for (const { re, app: name } of namedApps) {
    if (re.test(ua)) {
      app = name;
      break;
    }
  }

  // Heuristics for generic webviews that don't name themselves.
  // iOS: a real browser launched from an app is still a WKWebView; Mobile
  // Safari proper always contains "Safari/". Absence of "Safari/" on iOS (while
  // having a WebKit UA) strongly implies an embedded webview.
  const iosWebview =
    isIOS && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  // Android: ";wv" marks a WebView; some in-app browsers also omit the trailing
  // "Mobile Safari" that real Chrome includes, but ";wv" is the reliable signal.
  const androidWebview = isAndroid && /;\s*wv\)/i.test(ua);

  const isInApp = Boolean(app) || iosWebview || androidWebview;

  return { isInApp, isIOS, isAndroid, app };
}

/**
 * Attempt to reopen the current URL in the system browser.
 *
 * Android: use an `intent://` URL so the OS hands off to Chrome (with a
 * browser_fallback_url for devices without it). Returns true (attempt made).
 *
 * iOS: there is no reliable way to silently force out of a WKWebView, so we
 * return false and let the caller show instructions instead.
 */
export function escapeToSystemBrowser(currentUrl: string = typeof window !== "undefined" ? window.location.href : ""): boolean {
  if (typeof window === "undefined" || !currentUrl) return false;

  const { isAndroid } = detectInAppBrowser();
  if (!isAndroid) return false;

  try {
    const url = new URL(currentUrl);
    // intent:// expects the host + path + query, without the scheme prefix.
    const hostAndPath = `${url.host}${url.pathname}${url.search}${url.hash}`;
    const fallback = encodeURIComponent(currentUrl);
    const intentUrl =
      `intent://${hostAndPath}#Intent;scheme=https;` +
      `package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}

/** Copy a link to the clipboard, with a fallback for older webviews. */
export async function copyLink(
  url: string = typeof window !== "undefined" ? window.location.href : ""
): Promise<boolean> {
  if (!url) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
