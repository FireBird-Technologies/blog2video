import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../hooks/useAuth";
import useJustLoggedIn from "../hooks/useJustLoggedIn";
import { isMobileDevice } from "../lib/inAppBrowser";

/**
 * Warns phone/tablet users, once per sign-in, that the app is memory-heavy and
 * is best used on a computer.
 *
 * Video rendering and preview hold a full Remotion runtime plus canvas contexts,
 * which exceeds what phone browsers allow — iOS Safari discards and reloads the
 * tab under memory pressure, so previews stop playing or the page reappears from
 * scratch. Template previews already degrade to static images on small viewports
 * (see the `staticThumb` path), but the editor and player still exceed the
 * ceiling, and until now that failure was completely silent.
 *
 * Fires on every real sign-in but NOT on page reloads — see `useJustLoggedIn`,
 * which owns that distinction so this and the other login-only popups don't race
 * over the underlying session flag.
 *
 * Detection is user-agent based (`isMobileDevice`), deliberately not viewport
 * based: a desktop user who narrows their window must never be told to use a
 * computer.
 */
export default function MobileMemoryWarningPopup() {
  const { user } = useAuth();
  const justLoggedIn = useJustLoggedIn();

  const [show, setShow] = useState(false);
  // Once dismissed, stay dismissed for this page — a dep re-firing (e.g. the
  // `user` object changing identity after a profile refresh) must not re-open it.
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!user || !justLoggedIn) return;
    if (dismissedRef.current) return;
    if (!isMobileDevice()) return;
    setShow(true);
  }, [user, justLoggedIn]);

  const close = useCallback(() => {
    dismissedRef.current = true;
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, close]);

  if (!show) return null;

  return ReactDOM.createPortal(
    // Above the other login-time popups (z-[120]) so it can't open behind one.
    <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-memory-warning-title"
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m0 3.5h.007M10.34 3.94l-7.6 13.2A1.5 1.5 0 004.04 19.5h15.92a1.5 1.5 0 001.3-2.36l-7.6-13.2a1.5 1.5 0 00-2.6 0z"
                />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <h2
                id="mobile-memory-warning-title"
                className="text-base font-semibold text-gray-900"
              >
                Optimal experience on a computer
              </h2>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                This app is memory-heavy — rendering and previewing video pushes past
                what most phone browsers allow. On a phone, previews may not play and
                the page can reload unexpectedly.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-5 w-full py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
