import { useCallback, useRef, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../../hooks/useAuth";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";

// ─── Soft signup gate ────────────────────────────────────────────────────────
// Free tools are fully explorable while signed out: every input, option, and
// live preview works for anonymous visitors. Only the one action that costs us
// something (an AI generation, a saved export) is gated — pressing it opens this
// modal, and the pending action replays automatically once sign-in completes.
//
// This replaces the older hard gate, which hid the whole widget behind a login
// panel and gave visitors nothing to evaluate before committing an email.

export type SignupGateCopy = {
  /** Small uppercase label above the headline, e.g. "Free video tool". */
  eyebrow: string;
  /** Modal headline — say what unlocks, not "sign up". */
  headline: string;
  /** One sentence on what the gated action produces. */
  blurb: string;
  /** Three-ish concrete things included with the free account. */
  bullets: string[];
};

function SignupGateModal({
  copy,
  onClose,
  onSuccess,
}: {
  copy: SignupGateCopy;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(
    async (response: CredentialResponse) => {
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
        login(res.data.access_token, res.data.user, { createdNewUser: res.data.created_new_user, metaEventId: res.data.meta_event_id });
        onSuccess();
      } catch {
        setError("Sign-in failed. Please try again.");
      } finally {
        setSigningIn(false);
      }
    },
    [login, onSuccess]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
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
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
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
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-purple-100 bg-purple-50 text-xs font-bold text-purple-600">
                  ✓
                </span>
                {item}
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
                Signing in…
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
            Your settings are kept — we run the action right after you sign in.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrap a tool's one paid/authenticated action.
 *
 * `requireAuth(action)` runs `action` immediately when signed in; otherwise it
 * parks the action, opens the signup modal, and replays it once login lands.
 * Render `gateModal` anywhere inside the widget.
 */
export function useSignupGate(copy: SignupGateCopy) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (user) {
        action();
        return;
      }
      pendingRef.current = action;
      setOpen(true);
    },
    [user]
  );

  const close = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    const action = pendingRef.current;
    pendingRef.current = null;
    // Defer a tick so the auth context (and the stored bearer token the axios
    // interceptor reads) has settled before the action fires its request.
    if (action) window.setTimeout(action, 0);
  }, []);

  return {
    isAuthed: Boolean(user),
    requireAuth,
    gateModal: open ? (
      <SignupGateModal copy={copy} onClose={close} onSuccess={handleSuccess} />
    ) : null,
  };
}

/**
 * Small inline note under a gated button, shown only to signed-out visitors, so
 * the signup prompt is never a surprise when they press the button.
 */
export function GateHint({ isAuthed, children }: { isAuthed: boolean; children: React.ReactNode }) {
  if (isAuthed) return null;
  return (
    <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
      <span className="mt-0.5 text-purple-500">●</span>
      <span>{children}</span>
    </p>
  );
}
