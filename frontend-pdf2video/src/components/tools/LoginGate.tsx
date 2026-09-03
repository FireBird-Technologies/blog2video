import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CredentialResponse } from "@react-oauth/google";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

/**
 * Login gate for the PDF tools.
 *
 * NOTE ON THIS DEPLOYMENT: everywhere else on pdf2vid.com, signing in
 * immediately hands the JWT to blog2video.app and leaves (see
 * PdfLanding.handleGoogleSuccess) — this domain holds no session because it has
 * no app. The tools are the exception: their work runs against
 * /api/free-tools/* on the shared backend, which needs a bearer token on *this*
 * origin. So here we call `login()` and stay put.
 *
 * That is a deliberate divergence, not an oversight. If you are adding a new
 * page that signs users in, the redirect flow is still the default; only pages
 * that call the API themselves should use this.
 *
 * WHERE THE GATE SITS: the tool itself is always visible — a visitor can read
 * the controls and see what they are about to get. Sign-in is demanded at the
 * first action that needs the backend, which is the upload. That is also the
 * only moment we can *resume*: a dropped file is held in memory across the
 * sign-in and processed the second it succeeds, so nobody has to find their
 * file twice.
 */

export type LoginGateCopy = {
  /** What the tool will do once they are signed in. */
  headline: string;
  blurb: string;
  bullets: string[];
};

interface ToolAuthValue {
  /** A resolved session exists — the backend calls will carry a token. */
  signedIn: boolean;
  /** The stored session is still being restored; don't gate on `signedIn` yet. */
  loading: boolean;
  /**
   * Run `action` now if signed in; otherwise open the sign-in modal and run it
   * once sign-in succeeds. Returns true when it ran synchronously.
   *
   * Set `meta.pendingFile` when `action` will process a file the visitor has
   * already handed over — the modal says so, which is the difference between
   * "sign in" and "sign in, your upload is waiting".
   */
  requireAuth: (action?: () => void, meta?: { pendingFile?: boolean }) => boolean;
}

const ToolAuthContext = createContext<ToolAuthValue>({
  signedIn: false,
  loading: false,
  requireAuth: () => false,
});

export function useToolAuth() {
  return useContext(ToolAuthContext);
}

function AuthPanelBody({
  copy,
  onSignedIn,
}: {
  copy: LoginGateCopy;
  onSignedIn: () => void;
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
        // Stay on this page — `login()` writes the token to localStorage
        // synchronously, so the resumed upload can call the API right away.
        login(res.data.access_token, res.data.user);
        onSignedIn();
      } catch {
        setError("Sign-in failed. Please try again.");
        setSigningIn(false);
      }
    },
    [login, onSignedIn]
  );

  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white">
        <svg
          className="h-6 w-6 text-purple-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </div>

      <h2 className="mx-auto mt-5 max-w-lg text-2xl font-semibold text-gray-900">
        {copy.headline}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-500">{copy.blurb}</p>

      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {copy.bullets.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-purple-100 bg-purple-50 text-xs font-bold text-purple-600">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex justify-center">
        {signingIn ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
            Signing you in…
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

      {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}
      <p className="mt-4 text-xs text-gray-400">
        Free account, no card. Your document is processed to produce your result and is not
        stored.
      </p>
    </>
  );
}

/**
 * The sign-in step, shown over the tool once the visitor tries to upload.
 *
 * Their file is already waiting behind this — closing without signing in is a
 * dead end for that upload, so the dismiss affordance is deliberately quiet
 * while still being there (Escape, the backdrop, and the ✕).
 */
function ToolAuthModal({
  copy,
  onSignedIn,
  onClose,
  hasPendingFile,
}: {
  copy: LoginGateCopy;
  onSignedIn: () => void;
  onClose: () => void;
  hasPendingFile: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.headline}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(17,17,27,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-2xl">
        <div className="h-1 w-full bg-purple-600" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-5 text-gray-300 transition hover:text-gray-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-gradient-to-b from-purple-50/60 to-white p-8 text-center sm:p-10">
          <AuthPanelBody copy={copy} onSignedIn={onSignedIn} />
          {hasPendingFile ? (
            <p className="mt-3 text-xs font-medium text-purple-600">
              Your file is ready — it starts processing the moment you&apos;re in.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps a tool widget so any part of it can demand sign-in on demand.
 *
 * The widget renders for everyone; `useToolAuth().requireAuth(action)` is what
 * actually stops an unauthenticated visitor, and it carries `action` across the
 * sign-in so the interrupted step finishes on its own.
 */
export function ToolAuthProvider({ copy, children }: { copy: LoginGateCopy; children: ReactNode }) {
  const { user, loading } = useAuth();
  const [gate, setGate] = useState<{ open: boolean; hasFile: boolean }>({
    open: false,
    hasFile: false,
  });
  const pending = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action?: () => void, meta?: { pendingFile?: boolean }) => {
      if (user) {
        action?.();
        return true;
      }
      pending.current = action ?? null;
      setGate({ open: true, hasFile: Boolean(meta?.pendingFile) });
      return false;
    },
    [user]
  );

  const handleSignedIn = useCallback(() => {
    setGate({ open: false, hasFile: false });
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const handleClose = useCallback(() => {
    pending.current = null;
    setGate({ open: false, hasFile: false });
  }, []);

  return (
    <ToolAuthContext.Provider value={{ signedIn: Boolean(user), loading, requireAuth }}>
      {children}
      {gate.open && !user ? (
        <ToolAuthModal
          copy={copy}
          onSignedIn={handleSignedIn}
          onClose={handleClose}
          hasPendingFile={gate.hasFile}
        />
      ) : null}
    </ToolAuthContext.Provider>
  );
}
