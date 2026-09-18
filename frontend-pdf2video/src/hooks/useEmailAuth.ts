import { useCallback, useState } from "react";

import {
  emailLogin,
  emailRegisterResend,
  emailRegisterStart,
  emailRegisterVerify,
  forgotPasswordCheck,
  forgotPasswordComplete,
  forgotPasswordStart,
  type UserInfo,
} from "../api/client";
import { parseLoginError, type LoginError } from "./useSocialLogin";
import { getErrorMessage } from "../contexts/ErrorModalContext";

/**
 * Built-in email + password sign-in, as a staged flow inside the login modal.
 *
 * Mirrors useSocialLogin's contract (the same onSuccess handoff, the same
 * LoginError shape, the same held-credential reactivation retry) so the modal
 * can treat both paths identically and the 409 wrong-provider recovery works
 * the same whichever one produced it.
 *
 * As in useSocialLogin, success hands the raw JWT back to the caller rather
 * than logging in locally: this deployment has no dashboard, so most sign-ins
 * pass the token to blog2video.app instead.
 */

/** Seconds between code resends; matches RESEND_COOLDOWN_SECONDS server-side. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Which of the two intents the user picked on the first step.
 *
 * It only changes wording and which request the password step fires — it is NOT
 * a security boundary. Signing up with an address that already exists still
 * returns 409, and logging in with one that doesn't still returns the same
 * ambiguous 401, so picking the "wrong" one costs a click, never information.
 */
export type EmailMode = "login" | "signup";

export type EmailStage =
  // `email` carries the address too, so stepping back (or being routed back by
  // an error) never makes the user retype what they already entered.
  | { name: "email"; mode: EmailMode; email: string }
  /**
   * `switchedFromSignup` marks the one transition the user did not ask for:
   * they submitted a SIGNUP and the address turned out to already exist, so we
   * flipped them to the sign-in form. The form reads it to clear the carried-over
   * password and keep the "account already exists" notice up.
   *
   * Without it the signup password sat in a login box under a "Sign in" button,
   * so the next submit either said "email and password don't match" (burying the
   * real reason) or — when the two passwords happened to match — silently signed
   * them in, which is not what anyone clicking "Sign up" asked for.
   */
  | { name: "password"; email: string; mode: EmailMode; switchedFromSignup?: boolean }
  | { name: "otp"; email: string; resendAt: number }
  | { name: "forgot_email"; email: string }
  | { name: "forgot_code"; email: string; resendAt: number }
  | { name: "forgot_password"; email: string; code: string };

interface UseEmailAuthOptions {
  /** Receives the fresh JWT and user on success, exactly as useSocialLogin does. */
  onSuccess: (token: string, user: UserInfo) => void;
  /** Which intent the surface opens in. Defaults to "signup": most people
   *  reaching a sign-in surface from a CTA are new, and an existing user is one
   *  click from the "Already have an account? Sign in" toggle. */
  initialMode?: EmailMode;
}

function resendAtFrom(resendIn?: number): number {
  return Date.now() + (resendIn ?? RESEND_COOLDOWN_SECONDS) * 1000;
}

export function useEmailAuth({
  onSuccess,
  initialMode = "signup",
}: UseEmailAuthOptions) {
  const [stage, setStage] = useState<EmailStage>({ name: "email", mode: initialMode, email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  /**
   * What the account-deleted prompt should retry, held exactly as useSocialLogin
   * holds the provider token.
   *
   * Two shapes, because a deleted account can be met on two different steps and
   * they are reactivated by different requests:
   *   login  — the typed credential; retried as emailLogin(?reactivate=true).
   *   forgot — the address alone; retried as forgotPasswordStart(?reactivate=true).
   * The forgot case has no password to hold by definition, which is why it can't
   * reuse the login retry — that was the bug: `reactivate` bailed on a null
   * `pending` and the confirm button did nothing.
   */
  type PendingReactivation =
    | { via: "login"; email: string; password: string }
    | { via: "forgot"; email: string };
  const [pending, setPending] = useState<PendingReactivation | null>(null);
  /** True while the in-flight request is a reactivation rather than a sign-in.
   *  `busy` alone can't distinguish them, and the two need different wording. */
  const [reactivating, setReactivating] = useState(false);

  const finish = useCallback(
    (token: string, user: UserInfo) => {
      localStorage.removeItem("b2v_ref_code");
      onSuccess(token, user);
    },
    [onSuccess]
  );

  /** Switch between "Log in" and "Sign up" on the first step. */
  const setMode = useCallback((mode: EmailMode) => {
    setError(null);
    setStage((s) =>
      s.name === "email"
        ? { name: "email", mode, email: s.email }
        : s.name === "password"
          ? { name: "password", email: s.email, mode }
          : s
    );
  }, []);

  /** Step 1: an address was entered. We never probe whether it exists — that
   *  would be an account-existence oracle with no other purpose — so both modes
   *  go to the password step and the request's outcome disambiguates. */
  const submitEmail = useCallback((email: string, mode: EmailMode) => {
    setError(null);
    setStage({ name: "password", email: email.trim().toLowerCase(), mode });
  }, []);

  /** Keep the stage's address in step with the field as the user types, so any
   *  error that routes them elsewhere still has it. */
  const setEmailValue = useCallback((email: string) => {
    setStage((s) => (s.name === "email" ? { ...s, email } : s));
  }, []);

  /**
   * "This address already has a password account" — however it was phrased.
   *
   * The backend says this two ways: `email_already_registered` when signup finds
   * a live account, and a `wrong_provider` 409 naming "email" when the account
   * is found by the shared identity check. They mean the same thing to the user,
   * and every path that can raise either must route to the SAME place, or they
   * end up reading "sign in with your password" on a screen that has no password
   * field — and, worse, an empty email box they must retype.
   */
  const isExistingEmailAccount = (parsed: LoginError) =>
    parsed.kind === "email_already_registered" ||
    (parsed.kind === "wrong_provider" && parsed.provider === "email");

  /** Step 2. In login mode this signs in; in signup mode it requests a code.
   *  Either way a mismatch between the mode and reality is recoverable in one
   *  click — the errors below flip the user to the other mode rather than
   *  dead-ending them. */
  const submitPassword = useCallback(
    async (email: string, password: string, mode: EmailMode) => {
      setBusy(true);
      setError(null);
      try {
        if (mode === "signup") {
          const res = await emailRegisterStart(email, password);
          setStage({ name: "otp", email, resendAt: resendAtFrom(res.data.resend_in) });
          setBusy(false);
          return;
        }
        const res = await emailLogin(email, password);
        finish(res.data.access_token, res.data.user);
      } catch (err) {
        const parsed = parseLoginError(err);
        // Only a LOGIN can offer reactivation. The signup endpoint answers
        // `email_already_registered` for a deleted account rather than 403, so
        // this should be unreachable in signup mode — but the mode gate stays as
        // defence in depth: holding a freshly-typed signup password as the
        // credential for an existing account would let the confirm button sign
        // someone in with a password that account never had.
        if (parsed.kind === "account_deleted" && mode === "login") {
          setPending({ via: "login", email, password });
        }
        // Signed up with an address that already exists -> they meant to log in.
        // Flagged as an involuntary switch so the form drops the signup password
        // instead of offering it for one-click sign-in under a new label.
        if (isExistingEmailAccount(parsed)) {
          setStage({ name: "password", email, mode: "login", switchedFromSignup: true });
        }
        setError(parsed);
        setBusy(false);
      }
    },
    [finish]
  );

  const submitCode = useCallback(
    async (email: string, code: string) => {
      setBusy(true);
      setError(null);
      try {
        const refCode = localStorage.getItem("b2v_ref_code");
        const res = await emailRegisterVerify(email, code, refCode);
        finish(res.data.access_token, res.data.user);
      } catch (err) {
        const parsed = parseLoginError(err);
        // A burned code can't be retried — send them back to start over.
        if (parsed.kind === "code_burned") setStage({ name: "password", email, mode: "signup" });
        // Someone registered this address while the code was in flight, so the
        // pending signup is moot — hand them the sign-in form for it.
        else if (isExistingEmailAccount(parsed)) {
          setStage({ name: "password", email, mode: "login", switchedFromSignup: true });
        }
        setError(parsed);
        setBusy(false);
      }
    },
    [finish]
  );

  const resendCode = useCallback(async (email: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await emailRegisterResend(email);
      setStage({ name: "otp", email, resendAt: resendAtFrom(res.data.resend_in) });
      setBusy(false);
    } catch (err) {
      const parsed = parseLoginError(err);
      // Cooldown: keep the user on the code step, just re-arm the timer.
      if (parsed.kind === "resend_cooldown") {
        setStage({ name: "otp", email, resendAt: resendAtFrom(parsed.retryAfter) });
      } else if (isExistingEmailAccount(parsed)) {
        setStage({ name: "password", email, mode: "login", switchedFromSignup: true });
      }
      setError(parsed);
      setBusy(false);
    }
  }, []);

  // ─── Forgot password ──────────────────────────────────────────────────

  const startForgot = useCallback((email: string) => {
    setError(null);
    setStage({ name: "forgot_email", email });
  }, []);

  /** Ask for a reset code. `confirmReactivate` revives a soft-deleted account
   *  first; it still only emails a code, so this never signs anyone in. */
  const requestResetCode = useCallback(async (email: string, confirmReactivate = false) => {
    setBusy(true);
    if (confirmReactivate) setReactivating(true);
    setError(null);
    try {
      const res = await forgotPasswordStart(email, confirmReactivate);
      setPending(null);
      setStage({ name: "forgot_code", email, resendAt: resendAtFrom(res.data.resend_in) });
      setBusy(false);
      setReactivating(false);
    } catch (err) {
      const parsed = parseLoginError(err);
      // Deleted account: hold the address so the confirm dialog can retry this
      // same request with ?reactivate=true. There is no password to hold here —
      // the user is on this path precisely because they don't have it.
      if (parsed.kind === "account_deleted") setPending({ via: "forgot", email });
      setError(parsed);
      setBusy(false);
      setReactivating(false);
    }
  }, []);

  /** The code is carried forward, not verified separately: checking it in its
   *  own round trip would consume it and leave nothing to authorize the change. */
  const submitResetCode = useCallback(async (email: string, code: string) => {
    setBusy(true);
    setError(null);
    try {
      // Validate up front so a wrong code is rejected HERE rather than walking
      // the user through choosing a new password and only failing on submit.
      // This does not spend the code — forgot/complete still consumes it, since
      // that is what authorizes the actual password change.
      await forgotPasswordCheck(email, code);
      setStage({ name: "forgot_password", email, code });
      setBusy(false);
    } catch (err) {
      const parsed = parseLoginError(err);
      // A burned or expired code can't be retried — send them back to request
      // a fresh one instead of leaving them on a dead input.
      if (parsed.kind === "code_burned" || parsed.kind === "code_expired") {
        setStage({ name: "forgot_email", email });
      }
      setError(parsed);
      setBusy(false);
    }
  }, []);

  const completeReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await forgotPasswordComplete(email, code, newPassword);
        finish(res.data.access_token, res.data.user);
      } catch (err) {
        const parsed = parseLoginError(err);
        // The code was rejected, so go back and let them re-enter it.
        if (
          parsed.kind === "code_invalid" ||
          parsed.kind === "code_expired" ||
          parsed.kind === "code_burned"
        ) {
          setStage({ name: "forgot_code", email, resendAt: 0 });
        }
        setError(parsed);
        setBusy(false);
      }
    },
    [finish]
  );

  /**
   * Confirm reactivation of a soft-deleted account, by whichever route met it.
   *
   * From the login step the held password reactivates and signs in directly.
   * From the forgot-password step there is no password, so it reactivates and
   * emails a reset code instead — the user lands on the code step and only
   * reaches a session after setting a new one, which is the whole point: a
   * confirmation click must not itself be a way into an account whose password
   * the clicker doesn't know.
   */
  const reactivate = useCallback(async () => {
    if (!pending) return;
    if (pending.via === "forgot") {
      await requestResetCode(pending.email, true);
      return;
    }
    setBusy(true);
    setReactivating(true);
    setError(null);
    try {
      const res = await emailLogin(pending.email, pending.password, true);
      setPending(null);
      finish(res.data.access_token, res.data.user);
    } catch (err) {
      setError({
        kind: "generic",
        message: getErrorMessage(err, "Failed to reactivate account."),
      });
      setBusy(false);
      setReactivating(false);
    }
  }, [pending, finish, requestResetCode]);

  /** One step back, preserving the address so it needn't be retyped. */
  const back = useCallback(() => {
    setError(null);
    setPending(null);
    setStage((s) => {
      switch (s.name) {
        case "password":
          return { name: "email", mode: s.mode, email: s.email };
        case "otp":
          return { name: "password", email: s.email, mode: "signup" };
        case "forgot_email":
          return { name: "password", email: s.email, mode: "login" };
        case "forgot_code":
          return { name: "forgot_email", email: s.email };
        case "forgot_password":
          return { name: "forgot_code", email: s.email, resendAt: 0 };
        default:
          return s;
      }
    });
  }, []);

  /** Dismiss the current error without leaving the step or losing what was typed.
   *  Used by the reactivation prompt's Cancel, which must not restart the flow. */
  const dismissError = useCallback(() => {
    setError(null);
    setPending(null);
    setReactivating(false);
  }, []);

  const reset = useCallback(() => {
    setReactivating(false);
    setStage({ name: "email", mode: initialMode, email: "" });
    setError(null);
    setPending(null);
    setBusy(false);
  }, [initialMode]);

  return {
    stage,
    busy,
    error,
    setMode,
    setEmailValue,
    submitEmail,
    submitPassword,
    submitCode,
    resendCode,
    startForgot,
    requestResetCode,
    submitResetCode,
    completeReset,
    reactivate,
    reactivating,
    dismissError,
    back,
    reset,
  };
}
