import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../hooks/useAuth";
import DesignerTemplateRequestModal from "./DesignerTemplateRequestModal";

/**
 * Global watcher that pops a one-time marketing modal for paid (Pro/Standard) users
 * on login, advertising that the design team builds custom designer templates
 * reflecting their brand on request. The CTA hands off to the existing
 * DesignerTemplateRequestModal form.
 *
 * Shown on every real login (fresh sign-in / logout→login) but NOT on page reloads.
 * `login()` in useAuth sets the `b2v_just_logged_in` flag; a reload restores the
 * session via setUser without calling login(), so the flag is absent and the popup
 * stays closed. We consume the flag on show so it fires exactly once per login.
 */
const JUST_LOGGED_IN_KEY = "b2v_just_logged_in";

const PERKS = [
  "Our in-house design team crafts a bespoke template around your fonts, logo, colors & brand",
  "Save $500+ in editing costs on every video — one template, endless polished results",
  "Showcase your unique brand — great for building a personal brand",
  "Dozens of satisfied clients in finance, technology and insurance",
] as const;

export default function MarketingDesignerPopup() {
  const { user } = useAuth();

  const [show, setShow] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Only fire on a real login event, not on session-restore/reload.
    if (sessionStorage.getItem(JUST_LOGGED_IN_KEY) !== "1") return;

    const isPaid = user.plan === "pro" || user.plan === "standard";
    // Consume the flag regardless of plan so a free→paid change within the same
    // tab session doesn't surface it on a later reload.
    sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
    if (!isPaid) return;

    setShow(true);
  }, [user]);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show]);

  if (!show) {
    // Still allow the request form to close cleanly if it was open.
    return requestOpen ? (
      <DesignerTemplateRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    ) : null;
  }

  return (
    <>
      {ReactDOM.createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShow(false)} aria-hidden />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Designer templates for your brand"
          >
            {/* Gradient hero header */}
            <div className="relative bg-gradient-to-br from-purple-600 to-violet-600 px-7 pt-7 pb-6 text-white overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
              <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/10 blur-2xl" aria-hidden />

              <button
                type="button"
                onClick={() => setShow(false)}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white/15 text-white/90 hover:bg-white/25 transition-colors"
                aria-label="Close"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="mt-3 text-2xl font-bold leading-tight drop-shadow-sm">
                Designer templates,<br />built for your brand
              </h2>
              <p className="mt-2 text-sm text-white/90 leading-relaxed">
                Our design team crafts custom templates that reflect <span className="font-semibold">your</span> brand
                — made on request, just for you.
              </p>
            </div>

            {/* Perks */}
            <div className="px-7 pt-5 pb-6">
              <ul className="space-y-2.5">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="mt-6 w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 rounded-xl shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
              >
                Request designer template →
              </button>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="mt-2 w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <DesignerTemplateRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </>
  );
}
