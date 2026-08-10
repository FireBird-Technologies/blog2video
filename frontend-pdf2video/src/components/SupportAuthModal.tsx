import { useCallback, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";
import { googleLogin } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import GoogleAuthButton from "./public/GoogleAuthButton";

interface SupportAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export default function SupportAuthModal({
  onClose,
  onSuccess,
  eyebrow = "Blog2Video Support",
  title = "Sign in to continue",
  description = "Sign in so we can help you and keep your conversation saved to your account — free, no credit card required.",
}: SupportAuthModalProps) {
  const { login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setSigningIn(true);
      setError(null);
      try {
        const res = await googleLogin(response.credential, false, localStorage.getItem("b2v_ref_code"));
        localStorage.removeItem("b2v_ref_code");
        login(res.data.access_token, res.data.user);
        onSuccess();
      } catch {
        setError("Sign-in failed. Please try again.");
      } finally {
        setSigningIn(false);
      }
    },
    [login, onSuccess],
  );

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
        <div className="h-1 w-full bg-purple-600" />
        <div className="p-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-600">{eyebrow}</p>
          <h2 className="mb-2 text-lg font-bold leading-tight text-gray-900">{title}</h2>
          <p className="mb-5 text-sm leading-relaxed text-gray-500">{description}</p>

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
              <GoogleAuthButton onSuccess={handleSuccess} onError={() => setError("Sign-in failed. Please try again.")} text="signup_with" width="280" />
            )}
          </div>
          {error && <p className="text-center text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
