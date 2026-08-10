import { useCallback, useState, type ReactNode } from "react";
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
 */

export type LoginGateCopy = {
  /** What the tool will do once they are signed in. */
  headline: string;
  blurb: string;
  bullets: string[];
};

export function ToolLoginPanel({ copy }: { copy: LoginGateCopy }) {
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
        // Stay on this page — the widget re-renders with the tool unlocked.
        login(res.data.access_token, res.data.user);
      } catch {
        setError("Sign-in failed. Please try again.");
        setSigningIn(false);
      }
    },
    [login]
  );

  return (
    <div className="rounded-3xl border border-purple-100 bg-gradient-to-b from-purple-50/60 to-white p-8 text-center sm:p-10">
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
    </div>
  );
}

/**
 * Renders `children` when signed in, the login panel otherwise.
 *
 * `loading` from useAuth matters here: without it the panel flashes for a
 * moment on every page load before the stored session resolves, which reads as
 * being logged out.
 */
export function RequireLogin({ copy, children }: { copy: LoginGateCopy; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-[420px] animate-pulse rounded-3xl border border-gray-200 bg-gray-50" />;
  }
  if (!user) return <ToolLoginPanel copy={copy} />;
  return <>{children}</>;
}
