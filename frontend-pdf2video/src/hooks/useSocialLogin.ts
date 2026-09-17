import { useCallback, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";

import { appleLogin, googleLogin, microsoftLogin, type UserInfo } from "../api/client";
import { AppleSignInCancelled, signInWithApple } from "../lib/appleSignIn";
import { MicrosoftSignInCancelled, signInWithMicrosoft } from "../lib/microsoftSignIn";
import { getErrorMessage } from "../contexts/ErrorModalContext";

/**
 * The single sign-in flow for every provider and every call site.
 *
 * Unlike the blog2video app, this deployment has no dashboard of its own: most
 * sign-ins hand the JWT to blog2video.app as a one-time URL param. So success
 * hands back the raw token rather than performing a redirect itself.
 */

export type AuthProviderId = "google" | "apple" | "microsoft";

export type LoginErrorKind =
  | "wrong_provider"
  | "account_deleted"
  | "apple_private_email"
  | "microsoft_no_email"
  | "generic";

export interface LoginError {
  kind: LoginErrorKind;
  message: string;
  provider?: AuthProviderId;
  providerLabel?: string;
  deleted?: boolean;
}

interface WrongProviderDetail {
  code: string;
  provider: AuthProviderId;
  provider_label: string;
  deleted: boolean;
}

function parseLoginError(err: unknown): LoginError {
  const res = (err as { response?: { status?: number; data?: { detail?: unknown } } })
    ?.response;
  const status = res?.status;
  const detail = res?.data?.detail;

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
  /** Receives the fresh JWT and user on success. */
  onSuccess: (token: string, user: UserInfo) => void;
}

export function useSocialLogin({ onSuccess }: UseSocialLoginOptions) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, setPending] = useState<
    | { provider: "google"; credential: string }
    | { provider: "apple"; identityToken: string }
    | { provider: "microsoft"; idToken: string }
    | null
  >(null);

  const finish = useCallback(
    (token: string, user: UserInfo) => {
      localStorage.removeItem("b2v_ref_code");
      onSuccess(token, user);
    },
    [onSuccess]
  );

  const signInWithGoogle = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setSigningIn(true);
      setError(null);
      const refCode = localStorage.getItem("b2v_ref_code");
      try {
        const res = await googleLogin(response.credential, false, refCode);
        finish(res.data.access_token, res.data.user);
        // Deliberately stay in the signing-in state: the page is navigating
        // away, and clearing it would flash the idle button mid-redirect.
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

    let identityToken: string;
    let appleUser: Awaited<ReturnType<typeof signInWithApple>>["user"];
    try {
      ({ identityToken, user: appleUser } = await signInWithApple());
    } catch (err) {
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
      finish(res.data.access_token, res.data.user);
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
      finish(res.data.access_token, res.data.user);
    } catch (err) {
      const parsed = parseLoginError(err);
      if (parsed.kind === "account_deleted") {
        setPending({ provider: "microsoft", idToken });
      }
      setError(parsed);
      setSigningIn(false);
    }
  }, [finish]);

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
      finish(res.data.access_token, res.data.user);
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
    onGoogleError: useCallback(
      () => setError({ kind: "generic", message: "Google sign-in failed" }),
      []
    ),
  };
}
