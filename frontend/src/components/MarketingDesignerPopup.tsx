import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useJustLoggedIn from "../hooks/useJustLoggedIn";

/**
 * Global watcher that pops a one-time "what's new" modal on login, announcing
 * the latest product updates. The CTA hands off to the custom-template creator
 * on the templates tab.
 *
 * Shown on every real login (fresh sign-in / logout→login) but NOT on page reloads.
 * The `useJustLoggedIn` hook owns that distinction (and the reading/consuming of
 * the underlying session flag), so several login-only surfaces can coexist
 * without racing each other over who deletes it first.
 *
 * To announce a new update, edit the UPDATE const below — it is the only thing
 * that should need to change.
 */
const UPDATE = {
  titleLines: ["Custom templates,", "leveled up"],
  intro: "We've rebuilt custom templates end to end, with sharper generation and full control over every scene.",
  points: [
    "Refined generation, consistent with your brand",
    "Every scene is now AI editable",
    "Choose your font family and adjust sizes",
    "Regenerate any scene layout with a prompt",
  ],
  cta: "Try the new custom templates →",
  ariaLabel: "What's new: custom templates",
} as const;

export default function MarketingDesignerPopup() {
  const { user } = useAuth();
  const justLoggedIn = useJustLoggedIn();
  const navigate = useNavigate();

  const [show, setShow] = useState(false);
  // Once dismissed, stay dismissed for this page — a dep re-firing (e.g. the
  // `user` object changing identity after refreshUser on Dashboard) must not
  // re-open the popup.
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    // Only fire on a real login event, not on session-restore/reload.
    if (!justLoggedIn) return;
    if (dismissedRef.current) return;

    setShow(true);
  }, [user, justLoggedIn]);

  const close = useCallback(() => {
    dismissedRef.current = true;
    setShow(false);
  }, []);

  // The templates page owns the quota branch: ?openCustomCreator=1 runs its
  // openCreator(), which opens the creator — or the limit/upgrade modal when the
  // user is out of slots. Don't duplicate that check here.
  // Close first: this popup is a z-[120] portal and would otherwise cover the
  // modal it just opened.
  const goToCustomTemplates = useCallback(() => {
    close();
    navigate("/dashboard?tab=templates&openCustomCreator=1");
  }, [close, navigate]);

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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} aria-hidden />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={UPDATE.ariaLabel}
      >
        {/* "What's new" tag sits on plain white, above the heading */}
        <div className="px-7 pt-6 pb-4">
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-purple-700">
            What's new
          </span>

          <h2 className="mt-3 text-2xl font-bold leading-tight text-gray-900">
            {UPDATE.titleLines.map((line, i) => (
              <span key={line}>
                {line}
                {i < UPDATE.titleLines.length - 1 && <br />}
              </span>
            ))}
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 pb-6">
          <p className="text-sm text-gray-500 leading-relaxed">{UPDATE.intro}</p>

          <ul className="mt-4 space-y-2.5">
            {UPDATE.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {point}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={goToCustomTemplates}
            className="mt-6 w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 rounded-xl shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
          >
            {UPDATE.cta}
          </button>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
