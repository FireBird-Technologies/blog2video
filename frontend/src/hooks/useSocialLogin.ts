import { useCallback, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";

import { appleLogin, googleLogin, microsoftLogin } from "../api/client";
import type { AuthProvider } from "../api/types";
import { useAuth } from "./useAuth";
import { usePostLoginRedirect } from "./usePostLoginRedirect";
import { AppleSignInCancelled, signInWithApple } from "../lib/appleSignIn";
import { MicrosoftSignInCancelled, signInWithMicrosoft } from "../lib/microsoftSignIn";
import { getErrorMessage } from "../contexts/ErrorModalContext";

/**
 * The single sign-in flow for every provider and every call site.
 *
 * Before this hook, ~11 components each re-implemented credential → API →
 * login() → redirect with their own error handling, and only three of them
 * understood the `account_deleted` response. Centralizing it means a new
 * provider or a new failure mode is handled once.
 */

/** What the UI should show; anything unmapped falls through to `message`. */
export type LoginErrorKind =
  | "wrong_provider"
  | "account_deleted"
  | "apple_private_email"
  | "microsoft_no_email"
  | "generic";

export interface LoginError {
  kind: LoginErrorKind;
  message: string;
  /** For "wrong_provider": the provider that actually owns this email. */
  provider?: AuthProvider;
  providerLabel?: string;
  /** For "wrong_provider": that account is soft-deleted, so word it as reactivation. */
  deleted?: boolean;
}

interface WrongProviderDetail {
  code: string;
  provider: AuthProvider;
  provider_label: string;
  deleted: boolean;
}

function parseLoginError(err: unknown): LoginError {
  const res = (err as { response?: { status?: number; data?: { detail?: unknown } } })
    ?.response;
  const status = res?.status;
  const detail = res?.data?.detail;

  // 409: the email belongs to the other provider. The body names it so we can
  // offer a one-click switch rather than making the user guess.
  if (status === 409 && detail && typeof detail === "object") {
    const d = detail as Partial<WrongProviderDetail>;
    if (d.code === "wrong_auth_provider" && d.provider) {
      // The backend always sends provider_label; the map is a defensive
      // fallback that must name the right provider, never a two-way guess.
      const label =
        d.provider_label ??
        ({ google: "Google", apple: "Apple", microsoft: "Microsoft" }[d.provider] ?? d.provider);
      return {
        kind: "wrong_provider",
        provider: d.provider,
        providerLabel: label,
        deleted: Boolean(d.deleted),
        message: d.deleted
          ? `Your account is registered with ${label}. Sign in with ${label} to reactivate it.`
          : `You already have an account with ${label}. Sign in with ${label} to continue.`,
      };
    }
  }

  if (status === 403 && detail === "account_deleted") {
    return { kind: "account_deleted", message: "This account was deleted." };
  }

  if (status === 400 && detail === "apple_private_email") {
    return {
      kind: "apple_private_email",
      message:
        "Please share your email to continue. Choose your Apple email instead of “Hide My Email” when signing in.",
    };
  }

  if (status === 400 && detail === "microsoft_no_email") {
    return {
      kind: "microsoft_no_email",
      message:
        "Your Microsoft account didn't share an email address. Add one to your Microsoft account, or sign in another way.",
    };
  }

  return {
    kind: "generic",
    message: getErrorMessage(err, "Authentication failed. Please try again."),
  };
}

interface UseSocialLoginOptions {
  /**
   * Runs on every successful sign-in, whichever path follows — the modal uses
   * it to close itself, so it must not be conflated with skipping the redirect.
   */
  onSuccess?: () => void;
  /**
   * Suppresses the default post-login redirect, for in-place gates (a tool, the
   * support widget) that unlock where the user already is rather than
   * navigating away.
   */
  skipRedirect?: boolean;
}

export function useSocialLogin({
  onSuccess,
  skipRedirect = false,
}: UseSocialLoginOptions = {}) {
  const { login } = useAuth();
  const redirectAfterLogin = usePostLoginRedirect();

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  /** Held so the account-deleted prompt can retry the same credential. */
  const [pending, setPending] = useState<
    | { provider: "google"; credential: string }
    | { provider: "apple"; identityToken: string }
    | { provider: "microsoft"; idToken: string }
    | null
  >(null);

  const finish = useCallback(
    async (token: string, user: Parameters<typeof login>[1]) => {
      localStorage.removeItem("b2v_ref_code");
      login(token, user);
      // Always notify (the modal closes itself here); redirect unless the call
      // site handles landing the user somewhere itself.
      onSuccess?.();
      if (!skipRedirect) await redirectAfterLogin();
    },
    [login, redirectAfterLogin, onSuccess, skipRedirect]
  );

  const signInWithGoogle = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setSigningIn(true);
      setError(null);
      const refCode = localStorage.getItem("b2v_ref_code");
      try {
        const res = await googleLogin(response.credential, false, refCode);
        await finish(res.data.access_token, res.data.user);
      } catch (err) {
        const parsed = parseLoginError(err);
        if (parsed.kind === "account_deleted") {
          setPending({ provider: "google", credential: response.credential });
        }
        setError(parsed);
        setSigningIn(false);
      }
    },
    [finish]
  );

  const startAppleSignIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    const refCode = localStorage.getItem("b2v_ref_code");

    // Obtain the token first, so the exchange below can hold on to it for a
    // possible reactivation retry.
    let identityToken: string;
    let appleUser: Awaited<ReturnType<typeof signInWithApple>>["user"];
    try {
      ({ identityToken, user: appleUser } = await signInWithApple());
    } catch (err) {
      // Closing the popup is a deliberate action, not an error to report.
      if (err instanceof AppleSignInCancelled) {
        setSigningIn(false);
        return;
      }
      setError({
        kind: "generic",
        message: getErrorMessage(err, "Apple sign-in failed. Please try again."),
      });
      setSigningIn(false);
      return;
    }

    try {
      const res = await appleLogin(identityToken, appleUser, false, refCode);
      await finish(res.data.access_token, res.data.user);
    } catch (err) {
      const parsed = parseLoginError(err);
      if (parsed.kind === "account_deleted") {
        setPending({ provider: "apple", identityToken });
      }
      setError(parsed);
      setSigningIn(false);
    }
  }, [finish]);

  const startMicrosoftSignIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    const refCode = localStorage.getItem("b2v_ref_code");

    // Obtain the token first, so the exchange below can hold on to it for a
    // possible reactivation retry.
    let idToken: string;
    try {
      ({ idToken } = await signInWithMicrosoft());
    } catch (err) {
      // Closing the popup is a deliberate action, not an error to report.
      if (err instanceof MicrosoftSignInCancelled) {
        setSigningIn(false);
        return;
      }
      setError({
        kind: "generic",
        message: getErrorMessage(err, "Microsoft sign-in failed. Please try again."),
      });
      setSigningIn(false);
      return;
    }

    try {
      const res = await microsoftLogin(idToken, false, refCode);
      await finish(res.data.access_token, res.data.user);
    } catch (err) {
      const parsed = parseLoginError(err);
      if (parsed.kind === "account_deleted") {
        setPending({ provider: "microsoft", idToken });
      }
      setError(parsed);
      setSigningIn(false);
    }
  }, [finish]);

  /** Confirm reactivation of a soft-deleted account, reusing the held credential. */
  const reactivate = useCallback(async () => {
    if (!pending) return;
    setSigningIn(true);
    setError(null);
    try {
      let res;
      if (pending.provider === "google") {
        res = await googleLogin(pending.credential, true);
      } else if (pending.provider === "apple") {
        res = await appleLogin(pending.identityToken, null, true);
      } else {
        res = await microsoftLogin(pending.idToken, true);
      }
      setPending(null);
      await finish(res.data.access_token, res.data.user);
    } catch (err) {
      setError({
        kind: "generic",
        message: getErrorMessage(err, "Failed to reactivate account."),
      });
      setSigningIn(false);
    }
  }, [pending, finish]);

  const reset = useCallback(() => {
    setError(null);
    setPending(null);
    setSigningIn(false);
  }, []);

  return {
    signInWithGoogle,
    signInWithApple: startAppleSignIn,
    signInWithMicrosoft: startMicrosoftSignIn,
    signingIn,
    error,
    reactivate,
    reset,
    /** Google sign-in failed inside GIS, before any token reached us. */
    onGoogleError: useCallback(
      () => setError({ kind: "generic", message: "Google sign-in failed" }),
      []
    ),
  };
}
