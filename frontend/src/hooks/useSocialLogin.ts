import { useCallback, useState } from "react";
import type { CredentialResponse } from "@react-oauth/google";

import { googleLogin } from "../api/client";
import {
  AUTH_PROVIDER_LABELS,
  MIN_PASSWORD_LENGTH,
  type AuthProvider,
} from "../api/types";
import { useAuth } from "./useAuth";
import { usePostLoginRedirect } from "./usePostLoginRedirect";
import { getErrorMessage } from "../contexts/ErrorModalContext";

/**
 * The single sign-in flow for every provider and every call site.
 *
 * Before this hook, ~11 components each re-implemented credential → API →
 * login() → redirect with their own error handling, and only three of them
 * understood the `account_deleted` response. Centralizing it means a new
 * provider or a new failure mode is handled once.
 *
 * Google is the only social provider (Apple and Microsoft were removed), but
 * the shape stays general: parseLoginError below is shared with the email +
 * password flow, which is the other half of every error case here.
 */

/** What the UI should show; anything unmapped falls through to `message`. */
export type LoginErrorKind =
  | "wrong_provider"
  | "account_deleted"
  // Email + password
  | "email_already_registered"
  | "invalid_credentials"
  | "password_policy"
  | "code_invalid"
  | "code_expired"
  | "code_burned"
  | "resend_cooldown"
  | "rate_limited"
  | "generic";

export interface LoginError {
  kind: LoginErrorKind;
  message: string;
  /** For "wrong_provider": the provider that actually owns this email. */
  provider?: AuthProvider;
  providerLabel?: string;
  /** For "wrong_provider": that account is soft-deleted, so word it as reactivation. */
  deleted?: boolean;
  /** For "code_invalid": guesses left before the code is burned. */
  attemptsRemaining?: number;
  /** For 429s: seconds until the caller may retry. */
  retryAfter?: number;
}

interface WrongProviderDetail {
  code: string;
  provider: AuthProvider;
  provider_label: string;
  deleted: boolean;
}

/**
 * Maps a backend auth error onto what the UI should show.
 *
 * Exported because email/password auth shares it. A second copy would drift on
 * the 409 shape and silently break the one-click provider switch, which is the
 * whole reason the backend sends a machine-readable body.
 */
export function parseLoginError(err: unknown): LoginError {
  const res = (err as {
    response?: {
      status?: number;
      data?: { detail?: unknown };
      headers?: Record<string, string>;
    };
  })?.response;
  const status = res?.status;
  const detail = res?.data?.detail;
  const retryAfter = Number(res?.headers?.["retry-after"]) || undefined;

  // 409: the email belongs to the other provider. The body names it so we can
  // offer a one-click switch rather than making the user guess.
  if (status === 409 && detail && typeof detail === "object") {
    const d = detail as Partial<WrongProviderDetail>;
    if (d.code === "wrong_auth_provider" && d.provider) {
      // The backend always sends provider_label; the map is a defensive
      // fallback that must name the right provider, never a two-way guess.
      const label = d.provider_label ?? AUTH_PROVIDER_LABELS[d.provider] ?? d.provider;
      const isEmail = d.provider === "email";
      return {
        kind: "wrong_provider",
        provider: d.provider,
        providerLabel: label,
        deleted: Boolean(d.deleted),
        message: d.deleted
          ? isEmail
            ? "Your account is registered with an email and password. Sign in below to reactivate it."
            : `Your account is registered with ${label}. Sign in with ${label} to reactivate it.`
          : isEmail
            ? "You already have an account with this email. Sign in with your email to continue."
            : `You already have an account with ${label}. Sign in with ${label} to continue.`,
      };
    }
    if (d.code === "email_already_registered") {
      return {
        kind: "email_already_registered",
        message: "You already have an account with this email. Sign in instead.",
      };
    }
  }

  if (status === 403 && detail === "account_deleted") {
    return { kind: "account_deleted", message: "This account was deleted." };
  }

  // ─── Email + password ──────────────────────────────────────────────────
  if (status === 401 && detail === "invalid_credentials") {
    return {
      kind: "invalid_credentials",
      // Deliberately ambiguous, mirroring the backend: this is the same response
      // for a wrong password and an address with no account.
      message: "That email and password don't match.",
    };
  }

  if (
    status === 422 &&
    typeof detail === "string" &&
    (detail.startsWith("password_too_") || detail.startsWith("password_needs_"))
  ) {
    const messages: Record<string, string> = {
      password_too_short: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      password_too_long: "That password is too long.",
      password_needs_uppercase: "Password must include a capital letter.",
      password_needs_special: "Password must include a special character.",
    };
    return {
      kind: "password_policy",
      message: messages[detail] ?? "That password doesn't meet the requirements.",
    };
  }

  if (status === 400 && detail && typeof detail === "object") {
    const d = detail as { code?: string; attempts_remaining?: number };
    if (d.code === "code_invalid") {
      const left = d.attempts_remaining;
      return {
        kind: "code_invalid",
        attemptsRemaining: left,
        message:
          left === undefined
            ? "That code isn't right."
            : `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`,
      };
    }
  }

  if (status === 400 && detail === "code_invalid") {
    return { kind: "code_invalid", message: "That code isn't right." };
  }

  if (status === 400 && detail === "code_expired") {
    return { kind: "code_expired", message: "That code has expired. Request a new one." };
  }

  if (status === 429 && detail === "code_attempts_exceeded") {
    return {
      kind: "code_burned",
      message: "Too many incorrect codes. Start again to get a new one.",
    };
  }

  if (status === 429 && detail === "resend_too_soon") {
    return {
      kind: "resend_cooldown",
      retryAfter,
      message: `Please wait ${retryAfter ?? 60}s before requesting another code.`,
    };
  }

  if (status === 429 && detail === "too_many_attempts") {
    const mins = retryAfter ? Math.max(1, Math.ceil(retryAfter / 60)) : null;
    return {
      kind: "rate_limited",
      retryAfter,
      message: mins
        ? `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`
        : "Too many attempts. Please try again later.",
    };
  }

  if (status === 400 && detail === "no_pending_registration") {
    return {
      kind: "generic",
      message: "That registration expired. Please start again.",
    };
  }

  if (status === 502 && detail === "email_send_failed") {
    return {
      kind: "generic",
      message: "We couldn't send the email just now. Please try again in a moment.",
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
  /** True while the in-flight request is a reactivation rather than a first
   *  sign-in, so the UI can say which one it is. */
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  /** Held so the account-deleted prompt can retry the same credential. */
  const [pending, setPending] = useState<{ credential: string } | null>(null);

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
          setPending({ credential: response.credential });
        }
        setError(parsed);
        setSigningIn(false);
      }
    },
    [finish]
  );

  /** Confirm reactivation of a soft-deleted account, reusing the held credential. */
  const reactivate = useCallback(async () => {
    if (!pending) return;
    setSigningIn(true);
    setReactivating(true);
    setError(null);
    try {
      const res = await googleLogin(pending.credential, true);
      setPending(null);
      await finish(res.data.access_token, res.data.user);
    } catch (err) {
      setError({
        kind: "generic",
        message: getErrorMessage(err, "Failed to reactivate account."),
      });
      setSigningIn(false);
      setReactivating(false);
    }
  }, [pending, finish]);

  /** Dismiss the current error without clearing the in-flight sign-in state. */
  const dismissError = useCallback(() => {
    setError(null);
    setPending(null);
    setReactivating(false);
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setPending(null);
    setSigningIn(false);
    setReactivating(false);
  }, []);

  return {
    signInWithGoogle,
    signingIn,
    error,
    reactivate,
    reactivating,
    dismissError,
    reset,
    /** Google sign-in failed inside GIS, before any token reached us. */
    onGoogleError: useCallback(
      () => setError({ kind: "generic", message: "Google sign-in failed" }),
      []
    ),
  };
}
