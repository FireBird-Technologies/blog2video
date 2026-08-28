import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

const CONSENT_KEY = "b2v_cookie_consent";

interface ConsentBannerProps {
  /** True once useAuth() resolves a logged-in user. Logging in already
   *  implies consent per the Privacy Policy's Cookies section, so a signed-in
   *  visitor is auto-consented silently and never shown the banner at all —
   *  it only appears for anonymous, logged-out visitors. */
  isLoggedIn: boolean;
}

/**
 * Gates GA4/Google Ads/Meta Pixel behind opt-in consent. Applied to every
 * logged-out visitor, not just EU/UK — simplest way to satisfy GDPR/ePrivacy's
 * opt-in requirement without geo-detection, and a strict superset of what
 * CCPA's lighter opt-out requirement needs.
 *
 * index.html's GA4/Meta Pixel snippets read the same "b2v_cookie_consent"
 * localStorage key and no-op unless it's exactly "accepted" — see the
 * comment block above those scripts.
 *
 * Only "accepted" is persisted. Declining does NOT write anything to
 * localStorage — it only dismisses the banner for the current page view, so
 * it reappears on the next visit/login until the user actually accepts.
 */
export default function ConsentBanner({ isLoggedIn }: ConsentBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let existing: string | null = null;
    try {
      existing = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      /* localStorage unavailable (private mode, blocked) — treat as unanswered */
    }

    if (isLoggedIn) {
      // Logged in = already consented (see Privacy Policy, Cookies section).
      // Persist silently so tracking scripts stay enabled on future anonymous
      // visits from this same browser too, and never show the banner.
      if (existing !== "accepted") {
        try {
          window.localStorage.setItem(CONSENT_KEY, "accepted");
        } catch {
          /* ignore — worst case tracking waits for the next reload */
        }
      }
      setShow(false);
      return;
    }

    if (existing !== "accepted") setShow(true);
  }, [isLoggedIn]);

  const answer = (value: "accepted" | "declined") => {
    if (value === "accepted") {
      try {
        window.localStorage.setItem(CONSENT_KEY, value);
      } catch {
        /* ignore — worst case the banner reappears next load */
      }
      // Scripts checked consent once, at initial page load, before the user
      // could have answered — reload so index.html's gated snippets run now.
      window.location.reload();
      return;
    }
    // Decline: dismiss for this page view only. Nothing persisted, so the
    // banner shows again on the next visit/login.
    setShow(false);
  };

  if (!show) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[130] bg-white border-t border-gray-200 px-4 py-3 sm:px-8 sm:py-3.5"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-gray-500 leading-relaxed flex-1">
          We use cookies to enhance your experience and analyze our website
          traffic. By clicking "Accept All", you consent to our use of
          cookies.{" "}
          <a href="/privacy" className="text-purple-600 hover:underline">
            Learn more
          </a>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => answer("declined")}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={() => answer("accepted")}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
