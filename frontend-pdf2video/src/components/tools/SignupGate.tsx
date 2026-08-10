import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import type { CredentialResponse } from "@react-oauth/google";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import { buildBlog2VideoHandoffUrl } from "../../config/urls";

/**
 * Soft signup gate for the free tools.
 *
 * Every tool on this domain is fully usable while signed out: upload, extract,
 * script, summary, runtime, download — all of it runs in the browser and none
 * of it costs us anything. The gate sits on exactly one action, the one that
 * needs our renderer and our models: turning the result into an actual video.
 *
 * Unlike ../../../frontend's version of this component, there is no local
 * session to fall back into. pdf2vid.com has no dashboard, so a successful
 * sign-in leaves this domain immediately, carrying the JWT to
 * blog2video.app/dashboard as a one-time URL param — the same handoff
 * PdfLanding uses. That is also why there's no "replay the pending action"
 * path here: the action the visitor wanted happens on the other side.
 */

export type SignupGateCopy = {
  /** Small uppercase label above the headline, e.g. "Free PDF tool". */
  eyebrow: string;
  /** Modal headline — say what unlocks, not "sign up". */
  headline: string;
  /** One sentence on what the gated action produces. */
  blurb: string;
  /** Three-ish concrete things included with the free account. */
  bullets: string[];
};

function SignupGateModal({ copy, onClose }: { copy: SignupGateCopy; onClose: () => void }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !signingIn) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, signingIn]);

  const handleSuccess = useCallback(async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    setError(null);
    try {
      const res = await googleLogin(
        response.credential,
        false,
        localStorage.getItem("b2v_ref_code")
      );
      localStorage.removeItem("b2v_ref_code");
      // Navigating away, so the spinner deliberately stays up.
      window.location.href = buildBlog2VideoHandoffUrl(res.data.access_token);
    } catch {
      setError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }, []);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!signingIn) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.headline}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl"
      >
        <div className="h-1 w-full bg-purple-600" />
        <div className="p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-purple-50">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">
                {copy.eyebrow}
              </p>
              <h2 className="text-lg font-bold leading-tight text-gray-900">{copy.headline}</h2>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-gray-500">{copy.blurb}</p>

          <ul className="mb-6 space-y-2">
            {copy.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-purple-100 bg-purple-50 text-xs font-bold text-purple-600">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mb-5 border-t border-gray-100" />

          <div className="mb-3 flex justify-center">
            {signingIn ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="h-4 w-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Taking you to your workspace…
              </div>
            ) : (
              <GoogleAuthButton
                onSuccess={handleSuccess}
                onError={() => setError("Sign-in failed. Please try again.")}
                text="signup_with"
                width="320"
              />
            )}
          </div>
          {error ? <p className="mb-2 text-center text-xs text-red-500">{error}</p> : null}
          <p className="text-center text-xs text-gray-400">
            Free account, no card. You land on the upload step with your document ready to go.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * `requireAuth()` opens the gate. Render `gateModal` anywhere inside the widget.
 *
 * There is no `isAuthed` here on purpose: this deployment never holds a
 * session, so from a tool's point of view every visitor is signed out.
 */
export function useSignupGate(copy: SignupGateCopy) {
  const [open, setOpen] = useState(false);

  return {
    requireAuth: useCallback(() => setOpen(true), []),
    gateModal: open ? <SignupGateModal copy={copy} onClose={() => setOpen(false)} /> : null,
  };
}

/** Inline note under a gated button, so the prompt is never a surprise. */
export function GateHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
      <span className="mt-0.5 text-purple-500">●</span>
      <span>{children}</span>
    </p>
  );
}
