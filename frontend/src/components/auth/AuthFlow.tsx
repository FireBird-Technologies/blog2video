import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { GoogleLogin } from "@react-oauth/google";

import { useSocialLogin, type LoginError } from "../../hooks/useSocialLogin";
import { useEmailAuth } from "../../hooks/useEmailAuth";
import { PASSWORD_RULES, passwordMeetsPolicy } from "../../api/types";
import {
  copyLink,
  detectInAppBrowser,
  escapeToSystemBrowser,
} from "../../lib/inAppBrowser";

export interface LoginModalCopy {
  title?: string;
  subtitle?: string;
}

interface LoginModalProps extends LoginModalCopy {
  open: boolean;
  onClose: () => void;
  /** Runs on a successful sign-in; the provider uses it to close the modal. */
  onSuccess?: () => void;
  /** Suppresses the default post-login redirect (see LoginModalContext). */
  skipRedirect?: boolean;
}

/** Fallback copy when a call site supplies none. Keyed to the opening mode so a
 *  surface that defaults to the sign-up form is not headed "Sign in". */
const DEFAULT_COPY = {
  login: {
    title: "Sign in to Blog2Video",
    subtitle: "Choose how you'd like to continue.",
  },
  signup: {
    title: "Create your Blog2Video account",
    subtitle: "Choose how you'd like to get started.",
  },
} as const;

/**
 * Per-stage heading. The first stage keeps whatever copy the call site passed —
 * the ~11 CTAs that open this modal each set their own — while the later stages
 * describe the step the user is actually on.
 */
const STAGE_COPY: Record<string, { title: string; subtitle: string } | undefined> = {
  otp: {
    title: "Check your email",
    subtitle: "We sent you a 6-digit code. Enter it below to finish signing up.",
  },
  forgot_email: {
    title: "Reset your password",
    subtitle: "We'll email you a code to set a new password.",
  },
  forgot_code: { title: "Check your email", subtitle: "Enter the 6-digit code we sent you." },
  forgot_password: { title: "Choose a new password", subtitle: "Pick something you'll remember." },
};

/**
 * Errors that belong under a specific input rather than in the modal's banner.
 *
 * These are all "what you typed was wrong" — the message is only useful next to
 * the field you retype. The banner is reserved for errors about the modal as a
 * whole, which is also why account_deleted is excluded: it carries a Reactivate
 * button that needs the box to read as one unit.
 */
const FIELD_LEVEL_ERRORS = new Set<LoginError["kind"]>([
  "invalid_credentials",
  "password_policy",
  "code_invalid",
  "code_expired",
  "code_burned",
  "resend_cooldown",
]);

const isFieldLevelError = (e: LoginError | null) =>
  e !== null && FIELD_LEVEL_ERRORS.has(e.kind);

/**
 * "This address already has a password account", in either of the two shapes the
 * backend sends it. Mirrors isExistingEmailAccount in useEmailAuth — both must
 * agree, or the hook would route the user to the sign-in form while the banner
 * kept claiming something else.
 */
const isExistingAccountError = (e: LoginError | null) =>
  e !== null &&
  (e.kind === "email_already_registered" ||
    (e.kind === "wrong_provider" && e.provider === "email"));

/** Inline validation message: red text, no box, sits under its field. */
function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-left text-xs text-red-600">{children}</p>;
}

/**
 * Width of the sign-in column, shared by the provider rows, the divider and
 * every stage form. Set once per render by the variant: the page has a wider
 * card to fill, the modal keeps its original 300px. A module-level value rather
 * than a prop because EmailAuthForm/CodeForm would otherwise have to forward it
 * through every stage purely to change one number.
 */
let COLUMN_WIDTH_CLASS = "w-[300px]";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100";
const PRIMARY_BUTTON_CLASS =
  "w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The sign-in surface itself — everything inside the modal's box.
 *
 * Extracted so the dialog (LoginModal) and the full page (AuthPage) render the
 * SAME flow rather than two copies. A fork here would drift exactly the way a
 * second copy of parseLoginError would: one surface would quietly stop handling
 * a 409, a burned code, or the reactivation prompt.
 *
 * `variant` only affects chrome-adjacent details (heading size, the terms
 * footer); every behaviour — staging, error placement, provider narrowing — is
 * identical on both.
 */
export interface AuthFlowProps extends LoginModalCopy {
  /** False while a modal is closed, so the reset effect does not run. */
  active?: boolean;
  variant?: "modal" | "page";
  /** Opening intent. Defaults to "signup" so every surface that does not say
   *  otherwise (the modal, the in-place tool gates) opens on the sign-up form;
   *  /signin passes "login" explicitly. */
  mode?: "login" | "signup";
  onSuccess?: () => void;
  skipRedirect?: boolean;
  /** Modal only: renders the back chevron beside the heading. */
  onClose?: () => void;
}

export default function AuthFlow({
  active = true,
  variant = "modal",
  mode = "signup",
  onSuccess,
  skipRedirect,
  title,
  subtitle,
}: AuthFlowProps) {
  const {
    signInWithGoogle,
    onGoogleError,
    signingIn,
    error,
    reactivate,
    reactivating,
    dismissError,
    reset,
  } = useSocialLogin({ onSuccess, skipRedirect });

  const emailAuth = useEmailAuth({ onSuccess, skipRedirect, initialMode: mode });

  // Keyed to the LIVE stage mode, not the mount-time prop: the "Already have an
  // account? Sign in" toggle flips stage.mode, and a heading frozen at mount
  // would keep saying "Create your account" over a sign-in form.
  const activeMode =
    "mode" in emailAuth.stage ? emailAuth.stage.mode : mode;
  const fallback = DEFAULT_COPY[activeMode];
  const resolvedTitle = title ?? fallback.title;
  const resolvedSubtitle = subtitle ?? fallback.subtitle;

  // Only consult the UA once the modal opens; the result never changes for a
  // given page load, but this keeps the check out of the render path.
  const [inApp, setInApp] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const resetEmail = emailAuth.reset;
  useEffect(() => {
    if (!active) return;
    setInApp(detectInAppBrowser().isInApp);
    setShowInstructions(false);
    setCopied(false);
    reset();
    resetEmail();
  }, [active, reset, resetEmail]);

  // Either path can be mid-flight; the modal must stay inert for both.
  const busy = signingIn || emailAuth.busy;

  /* Which hook failed MOST RECENTLY.
   *
   * Two independent error states feed one banner, and the surface lets a user
   * move between them without leaving it: a Google attempt rejected because the
   * address is an email account, then an email attempt rejected because a
   * different address is a Google account. This used to be `error ??
   * emailAuth.error`, which is not "whichever hook just failed" but "the social
   * hook wins if it EVER failed" — the social error is never cleared by the
   * email flow (the hooks are isolated; useEmailAuth can only clear its own),
   * so the first rejection masked every later one. The banner kept naming the
   * wrong provider, and `onlyProvider` below inherited the same stale value, so
   * the UI also failed to narrow to the provider that would actually work.
   *
   * Tracked by REFERENCE, not by value: parseLoginError builds a fresh object
   * on every call, so a repeat of the same failure still registers as new. */
  const [lastErrorSource, setLastErrorSource] = useState<"social" | "email" | null>(null);
  const prevErrors = useRef<{ social: LoginError | null; email: LoginError | null }>({
    social: null,
    email: null,
  });
  const emailError = emailAuth.error;
  useEffect(() => {
    const prev = prevErrors.current;
    prevErrors.current = { social: error, email: emailError };
    // A newly-set error claims the banner. Checked independently so that a
    // render where one is set while the other is cleared still resolves.
    if (error !== prev.social && error !== null) setLastErrorSource("social");
    else if (emailError !== prev.email && emailError !== null) setLastErrorSource("email");
    else if (error === null && emailError === null) setLastErrorSource(null);
  }, [error, emailError]);

  /** The error the UI should speak for: the most recent one, with the other as
   *  a fallback so clearing one never blanks a banner the other still owns. */
  const activeError =
    lastErrorSource === "email" ? (emailError ?? error) : (error ?? emailError);

  // A soft-deleted account asks for confirmation in its own dialog rather than
  // offering a button inside the error banner — see ReactivateConfirm.
  // Three routes, because reactivating from the forgot-password step reactivates
  // WITHOUT signing in — it emails a reset code instead — so it needs its own
  // confirm copy and its own retry.
  // Never on the SIGNUP form: reactivation is a decision about an account you
  // are signing in to, and "Reactivate your account?" over "Create your account"
  // reads as a non-sequitur. The backend already answers signup with
  // `email_already_registered` for a deleted account, so this is belt and
  // braces — and it also guarantees the dialog is only rendered where a pending
  // retry exists, since useEmailAuth holds one only in login mode. A dialog
  // whose confirm button silently does nothing is worse than no dialog.
  const emailStageIsSignupPassword =
    emailAuth.stage.name === "password" && emailAuth.stage.mode === "signup";
  //
  // Routed off the SAME most-recent-error rule as the banner. It used to check
  // emailAuth.error first and fall back to the social one — the exact opposite
  // precedence — so the dialog and the banner could disagree about which hook
  // had won and describe two different accounts at once.
  const deletedIsFromEmailHook =
    activeError === emailError && emailError?.kind === "account_deleted";
  const deletedError =
    deletedIsFromEmailHook && !emailStageIsSignupPassword
      ? emailAuth.stage.name === "forgot_email" || emailAuth.stage.name === "forgot_code"
        ? ("forgot" as const)
        : ("email" as const)
      : activeError === error && error?.kind === "account_deleted"
        ? ("social" as const)
        : null;
  // The email form is showing its own persistent "already registered" notice,
  // so the banner must not duplicate it. See the render site below.
  const switchedToLoginNotice =
    emailAuth.stage.name === "password" &&
    emailAuth.stage.switchedFromSignup === true;

  /* A social sign-in rejected because the address is an email+password account
     ("Your account is registered with an email and password. Sign in below").
     The email flow is the way forward, so switch it to the SIGN-IN form — the
     surface otherwise sat on the sign-up form, telling the user to sign in
     below while showing them a registration form and an empty address box.

     useEmailAuth already does this for its own failures (recoverToLogin), but a
     Google rejection comes from useSocialLogin, which knows nothing about the
     email stage machine. AuthFlow is the only place that sees both.

     Note it can only flip the mode, not prefill the address: the social error
     carries no email — that lives inside the provider token. */
  const setEmailMode = emailAuth.setMode;
  const socialWrongProviderIsEmail =
    error?.kind === "wrong_provider" && error.provider === "email";
  /* Fire ONCE per rejection, not on every render while the error is up.
     Keying this on the live stage mode made it a lock instead of a correction:
     the error lives in useSocialLogin, so emailAuth.setMode cannot clear it, and
     every attempt to switch back to "Sign up" was immediately undone by this
     effect on the next render — the toggle looked dead. The ref lets us steer
     the user once and then leave the choice to them. */
  const correctedForWrongProvider = useRef(false);
  useEffect(() => {
    if (!socialWrongProviderIsEmail) {
      correctedForWrongProvider.current = false;
      return;
    }
    if (!correctedForWrongProvider.current) {
      correctedForWrongProvider.current = true;
      setEmailMode("login");
    }
  }, [socialWrongProviderIsEmail, setEmailMode]);

  const handleEscape = useCallback(() => {
    // Android can hand off to Chrome; iOS cannot, so fall back to instructions.
    if (!escapeToSystemBrowser(window.location.href)) setShowInstructions(true);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyLink(window.location.href);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }, []);

  /* After a wrong-provider rejection we know exactly which provider owns the
     email, so offer only that one — recovery becomes a single click instead of
     another guess between several buttons.

     "email" is deliberately NOT a narrowing. The narrowing exists to reduce a
     row of social buttons down to the one that works; when the answer is our own
     email/password provider there is nothing to reduce — that form is already
     the screen. Treating it as one suppressed the back chevron and the stage
     heading, which is how the user ended up on a dead-end screen with an empty
     address box and no way out. */
  const onlyProvider =
    activeError?.kind === "wrong_provider" && activeError.provider !== "email"
      ? activeError.provider
      : null;

  const stage = emailAuth.stage;
  // Past the first step the user is inside a flow, so provider buttons are just
  // noise — EXCEPT after a wrong-provider rejection, where the named provider is
  // the only way forward and hiding it would strand the user on an error they
  // cannot act on.
  const midEmailFlow = stage.name !== "email" && onlyProvider === null;
  // The email form hides for the mirror-image reason: once we know the account
  // belongs to a social provider, a password is not a way in. (onlyProvider is
  // never "email" — see above — so a narrowing always means "hide this form".)
  const showEmailForm = onlyProvider === null;
  // The password step reads differently depending on intent, so it is resolved
  // here rather than from the static map.
  const stageCopy =
    onlyProvider !== null
      ? undefined
      : stage.name === "password"
        ? stage.mode === "signup"
          ? { title: "Create your account", subtitle: "Choose a password to finish signing up." }
          : { title: "Enter your password", subtitle: "Sign in with your email and password." }
        : STAGE_COPY[stage.name];

  // One list so adding a provider back is a single entry. Google is the only
  // social provider now (Apple and Microsoft were removed), but the list shape
  // is what drives the divider, the narrowing below and the row layout, so it
  // stays a list rather than a hardcoded button.
  const providers = [
    {
      id: "google",
      enabled: true,
      render: () => (
        /* GIS renders a Google-hosted iframe, so it must mount only once this
           container is laid out — i.e. after the modal is open. */
        <GoogleLogin
          onSuccess={signInWithGoogle}
          onError={onGoogleError}
          size="large"
          shape="pill"
          text="continue_with"
          theme="outline"
          width="300"
        />
      ),
    },
  ].filter(
    (p) =>
      p.enabled &&
      !midEmailFlow &&
      (onlyProvider === null || onlyProvider === p.id)
  );

  const isPage = variant === "page";
  COLUMN_WIDTH_CLASS = isPage ? "w-[340px]" : "w-[300px]";

  return (
    <>
        {/* After a wrong-provider rejection the stage heading ("Enter your
            password") contradicts what is on screen, so fall back to the
            call site's own copy. */}
        <div className={`relative flex items-center gap-2 ${isPage ? "justify-center" : ""}`}>
          {midEmailFlow && (
            <button
              type="button"
              onClick={emailAuth.back}
              disabled={busy}
              aria-label="Back"
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2
            id={isPage ? "auth-page-title" : "login-modal-title"}
            className={`font-semibold text-gray-900 ${isPage ? "text-2xl" : "text-lg"}`}
          >
            {stageCopy?.title ?? resolvedTitle}
          </h2>
        </div>
        <p className={`mt-1 text-sm text-gray-600 ${isPage ? "text-center" : ""}`}>
          {stageCopy?.subtitle ?? resolvedSubtitle}
        </p>

        <div className="mt-6">
          {/* The spinner REPLACES the body only for social sign-in. Swapping the
              email form out would unmount it, and remounting resets its field
              state — so a rejected password would come back to an empty box and
              the user could not act on the error they were just shown. During an
              email request the form stays mounted and disables itself instead. */}
          {signingIn ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-purple-600" />
              <p className="text-sm text-gray-600">
                {reactivating ? "Reactivating your account…" : "Signing you in…"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* In-app browsers block OAuth popups, so the provider buttons are
                  useless there — but email/password needs no popup and works
                  fine, so the escape notice now sits ABOVE the email form
                  rather than replacing every way in. */}
              {inApp && (
                <InAppEscape
                  showInstructions={showInstructions}
                  copied={copied}
                  onEscape={handleEscape}
                  onCopy={handleCopy}
                />
              )}

              {/* Field-level failures render under the field they belong to, so
                  the message sits where the user is looking and where the fix
                  is. Only errors that are about the whole modal — the wrong
                  provider, a deleted account and its Reactivate button — stay up
                  here as a banner.

                  "Already registered" is excluded while the form is showing its
                  own persistent notice for it: the banner would say the same
                  thing twice, and would then vanish on the next submit while the
                  inline one (the accurate, lasting explanation) remains. */}
              {activeError &&
                !isFieldLevelError(activeError) &&
                activeError.kind !== "account_deleted" &&
                !(switchedToLoginNotice && isExistingAccountError(activeError)) && (
                  <LoginErrorNotice error={activeError} />
                )}

              {/* One fixed-width row per provider. Google Identity Services
                  renders its own iframe and does not honour `width` exactly, so
                  the row — not the button — defines the box; our own buttons
                  stretch to fill it and GIS is centred inside it. That keeps all
                  three the same width even though one is not ours to style. */}
              {!inApp &&
                providers.map((p) => (
                  <div key={p.id} className={`flex ${COLUMN_WIDTH_CLASS} max-w-full justify-center`}>
                    {p.render()}
                  </div>
                ))}

              {showEmailForm && (
                <>
                  {!inApp && !midEmailFlow && providers.length > 0 && (
                    <div className={`flex ${COLUMN_WIDTH_CLASS} max-w-full items-center gap-3 py-1`}>
                      <span className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs uppercase tracking-wide text-gray-400">
                        or
                      </span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}
                  <EmailAuthForm
                    auth={emailAuth}
                    busy={emailAuth.busy}
                    onDismissSocialError={dismissError}
                  />
                </>
              )}
            </div>
          )}
        </div>

      {!inApp && (
        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-600">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      )}

      {/* Asks the one question the 403 raises. The email flow holds the typed
          credential for the retry; the social flow holds the provider token. */}
      {deletedError && (
        <ReactivateConfirm
          busy={busy}
          body={
            deletedError === "forgot"
              ? "Your account was deleted. Reactivating will email you a code so you can set a new password and sign in."
              : "Your account was deleted. Do you want to proceed with reactivating?"
          }
          onConfirm={deletedError === "social" ? reactivate : emailAuth.reactivate}
          onCancel={deletedError === "social" ? dismissError : emailAuth.dismissError}
        />
      )}
    </>
  );
}

/**
 * The staged email + password form.
 *
 * Every stage is a plain controlled form — no zod, no react-hook-form, matching
 * the rest of the app (see ContactModal). The address is never probed for
 * existence before the password step: an "is this registered?" endpoint would be
 * an enumeration oracle with no other purpose, so instead everyone reaches the
 * password step and the sign-in result disambiguates.
 */
function EmailAuthForm({
  auth,
  busy,
  onDismissSocialError,
}: {
  auth: ReturnType<typeof useEmailAuth>;
  busy: boolean;
  /** Clears useSocialLogin's error, which auth.setMode cannot reach. */
  onDismissSocialError?: () => void;
}) {
  const { stage } = auth;
  // The address lives on the stage, not in local state: an error can route the
  // user between stages, and a remount would wipe a local copy — which is how
  // they ended up staring at an empty box under "sign in with your password".
  const email = stage.name === "email" ? stage.email : "";
  const setEmail = auth.setEmailValue;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Clear the step-local fields on a stage CHANGE, so a code typed for a burned
  // attempt doesn't linger into the next step. Deliberately keyed on the stage
  // name only: a failed request leaves the stage unchanged, so the password the
  // user just typed survives for them to correct or to register with.
  const stageName = stage.name;
  useEffect(() => {
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    if (stageName === "email" || stageName === "password") setPassword("");
  }, [stageName]);

  // The signup -> sign-in flip is the one transition that does NOT change
  // stage.name, so the effect above cannot catch it and the password the user
  // chose for a NEW account would stay in the box under a "Sign in" button.
  // Submitting that is either a confusing "email and password don't match" that
  // buries the real reason, or — if the two happen to match — an unrequested
  // sign-in. Clear it and make them type the password for the account that
  // actually exists.
  const switchedFromSignup =
    stage.name === "password" && stage.switchedFromSignup === true;
  useEffect(() => {
    if (switchedFromSignup) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [switchedFromSignup]);

  const stageEmail = "email" in stage ? stage.email : "";

  switch (stage.name) {
    case "email": {
      const signup = stage.mode === "signup";
      return (
        <form
          className={`${COLUMN_WIDTH_CLASS} max-w-full space-y-3`}
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) auth.submitEmail(email, stage.mode);
          }}
        >
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Email address"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className={PRIMARY_BUTTON_CLASS}
          >
            {/* Both modes read "Continue": this step only collects the address,
                and the mode is already stated by the toggle below. The specific
                verb belongs on the next step, where the action actually happens. */}
            Continue
          </button>
          {/* Both intents are offered up front. The mode only decides which
              request the next step fires — getting it wrong is recoverable in
              one click, so this is a convenience, not a gate. */}
          <p className="pt-1 text-center text-sm text-gray-500">
            {signup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                // Clear BOTH hooks' errors. auth.setMode only clears the email
                // hook's; a social wrong-provider rejection lives in the other
                // one, and leaving it up would keep the banner, keep the
                // provider list narrowed, and keep the back chevron hidden on a
                // screen the user has deliberately moved away from.
                onDismissSocialError?.();
                auth.setMode(signup ? "login" : "signup");
              }}
              className="font-medium text-purple-600 underline hover:text-purple-700"
            >
              {signup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </form>
      );
    }

    case "password": {
      const signup = stage.mode === "signup";
      // Only complain about a mismatch once they've actually started the second
      // field — flagging one they haven't reached yet reads as an error.
      const mismatch = signup && confirmPassword.length > 0 && confirmPassword !== password;
      // Deliberately NOT gated on the password policy or the confirm match.
      //
      // The live checklist and the mismatch hint already guide someone writing a
      // real new password. But when the address ALREADY has an account, none of
      // that is the point: blocking submit means the request is never made, so
      // the one thing the user needs to hear — "this account exists, sign in" —
      // can never be said, and pressing the button appears to do nothing. Let it
      // through and let the server answer; a genuine policy violation comes back
      // as a 422 and renders inline under the field, which is the same place the
      // checklist already points.
      const canSubmit = !busy && Boolean(password);
      return (
        <form
          className={`${COLUMN_WIDTH_CLASS} max-w-full space-y-3`}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) auth.submitPassword(stageEmail, password, stage.mode);
          }}
        >
          <p className="truncate text-sm text-gray-500">{stageEmail}</p>
          {/* Why the form changed under them. The error banner cannot carry this:
              it is cleared by the next submit, so the moment they try the password
              the reason they were moved here disappears — and if that submit fails
              it is replaced by "email and password don't match", which explains
              nothing. This is part of the form, so it stays until they leave. */}
          {switchedFromSignup && (
            <p className="text-left text-xs leading-relaxed text-amber-600">
              This email already has an account. Enter its password to sign in, or{" "}
              <button
                type="button"
                onClick={() => auth.startForgot(stageEmail)}
                className="font-medium underline hover:text-amber-700"
              >
                reset your password
              </button>
              .
            </p>
          )}
          <PasswordInput
            id="login-password"
            label="Password"
            placeholder={signup ? "Choose a password" : "Enter your password"}
            value={password}
            onChange={setPassword}
            autoComplete={signup ? "new-password" : "current-password"}
            autoFocus
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            invalid={isFieldLevelError(auth.error)}
          />
          {/* A rejected credential belongs here, beneath the box the user has to
              retype — not in a banner above the heading. */}
          {isFieldLevelError(auth.error) && <FieldError>{auth.error?.message}</FieldError>}
          {signup && (
            <>
              <PasswordInput
                id="login-password-confirm"
                label="Confirm password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                invalid={mismatch}
              />
              {mismatch && <FieldError>Passwords don&apos;t match.</FieldError>}
              {/* A live checklist rather than a sentence: with three rules, being
                  told what was wrong only after submitting is the frustrating
                  version of this. */}
              <ul className="space-y-0.5 pt-0.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 text-xs ${
                        ok ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      <span aria-hidden>{ok ? "✓" : "○"}</span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <button type="submit" disabled={!canSubmit} className={PRIMARY_BUTTON_CLASS}>
            {/* A reactivation runs through the same login request, so `busy`
                alone would mislabel it "Signing in…" while the confirm dialog
                above says "Reactivating…". */}
            {busy
              ? auth.reactivating
                ? "Reactivating…"
                : signup
                  ? "Sending code…"
                  : "Signing in…"
              : signup
                ? "Sign up"
                : "Sign in"}
          </button>
          {/* No mode toggle here: the intent was chosen on step one and the back
              chevron returns there, so repeating the choice is noise. Forgot
              password stays — it's a different action, not a restatement. */}
          {!signup && (
            <button
              type="button"
              onClick={() => auth.startForgot(stageEmail)}
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              Forgot password?
            </button>
          )}
        </form>
      );
    }

    case "otp":
      return (
        <CodeForm
          email={stageEmail}
          code={code}
          setCode={setCode}
          resendAt={stage.resendAt}
          busy={busy}
          error={auth.error}
          onSubmit={() => auth.submitCode(stageEmail, code)}
          onResend={() => auth.resendCode(stageEmail)}
        />
      );

    case "forgot_email":
      return (
        <form
          className={`${COLUMN_WIDTH_CLASS} max-w-full space-y-3`}
          onSubmit={(e) => {
            e.preventDefault();
            if (stageEmail) auth.requestResetCode(stageEmail);
          }}
        >
          <p className="truncate text-sm text-gray-500">{stageEmail}</p>
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
            {busy ? "Sending…" : "Email me a reset code"}
          </button>
        </form>
      );

    case "forgot_code":
      return (
        <CodeForm
          email={stageEmail}
          code={code}
          setCode={setCode}
          resendAt={stage.resendAt}
          busy={busy}
          error={auth.error}
          submitLabel="Continue"
          onSubmit={() => auth.submitResetCode(stageEmail, code)}
          onResend={() => auth.requestResetCode(stageEmail)}
        />
      );

    case "forgot_password": {
      // Setting a password, so it gets the same rules and the same confirmation
      // as signup — the server enforces them here either way.
      const resetMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
      const resetOk =
        !busy && passwordMeetsPolicy(newPassword) && confirmPassword === newPassword;
      return (
        <form
          className={`${COLUMN_WIDTH_CLASS} max-w-full space-y-3`}
          onSubmit={(e) => {
            e.preventDefault();
            if (resetOk) auth.completeReset(stageEmail, stage.code, newPassword);
          }}
        >
          <PasswordInput
            id="reset-password"
            label="New password"
            placeholder="Choose a new password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            autoFocus
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            invalid={isFieldLevelError(auth.error)}
          />
          {isFieldLevelError(auth.error) && <FieldError>{auth.error?.message}</FieldError>}
          <PasswordInput
            id="reset-password-confirm"
            label="Confirm new password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            invalid={resetMismatch}
          />
          {resetMismatch && <FieldError>Passwords don&apos;t match.</FieldError>}
          <ul className="space-y-0.5 pt-0.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(newPassword);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    ok ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  <span aria-hidden>{ok ? "✓" : "○"}</span>
                  {rule.label}
                </li>
              );
            })}
          </ul>
          <button type="submit" disabled={!resetOk} className={PRIMARY_BUTTON_CLASS}>
            Set password and sign in
          </button>
        </form>
      );
    }

    default:
      return null;
  }
}

/**
 * Password field with a reveal toggle.
 *
 * The toggle is icon-only, so it carries an aria-label that flips with the state
 * — without one it is an unlabelled button to a screen reader. type="button"
 * keeps it from submitting the form it sits inside.
 */
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  visible,
  onToggleVisible,
  invalid,
}: {
  id: string;
  /** The field's accessible name. Not rendered — the design is placeholder-only,
   *  so this is what a screen reader announces instead. */
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Hint inside the box; falls back to the label when omitted. */
  placeholder?: string;
  autoComplete: string;
  autoFocus?: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} pr-10 ${invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        aria-label={label}
        aria-invalid={invalid || undefined}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition hover:text-gray-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden
        >
          {visible ? (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </>
          ) : (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

/** Shared 6-digit code entry with a resend countdown. */
function CodeForm({
  email,
  code,
  setCode,
  resendAt,
  busy,
  error,
  submitLabel = "Verify",
  onSubmit,
  onResend,
}: {
  email: string;
  code: string;
  setCode: (v: string) => void;
  resendAt: number;
  busy: boolean;
  /** Field-level failure for this code, shown under the input. */
  error?: LoginError | null;
  submitLabel?: string;
  onSubmit: () => void;
  onResend: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))
  );

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [resendAt]);

  return (
    <form
      className={`${COLUMN_WIDTH_CLASS} max-w-full space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit();
      }}
    >
      <p className="truncate text-sm text-gray-500">{email}</p>
      <input
        // Kept as text, never a number input: codes are zero-padded strings and
        // "039123" would lose its leading zero. inputMode gets the numeric
        // keypad on mobile, and one-time-code lets the OS autofill it.
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${INPUT_CLASS} text-center text-lg tracking-[0.5em] ${
          isFieldLevelError(error ?? null) ? "border-red-400" : ""
        }`}
        aria-label="6-digit code"
        aria-invalid={isFieldLevelError(error ?? null) || undefined}
      />
      {isFieldLevelError(error ?? null) && <FieldError>{error?.message}</FieldError>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className={PRIMARY_BUTTON_CLASS}
      >
        {busy ? "Checking…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={onResend}
        disabled={busy || secondsLeft > 0}
        className="w-full text-sm text-gray-500 underline hover:text-gray-700 disabled:no-underline disabled:opacity-50"
      >
        {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
      </button>
    </form>
  );
}

/** Error banner for failures that concern the whole modal. */
function LoginErrorNotice({ error }: { error: LoginError }) {
  // The wrong-provider case is informational and self-contained, so it reads as
  // plain amber text; everything else keeps the box.
  if (error.kind === "wrong_provider") {
    return (
      <p className="w-full text-left text-sm text-amber-600">{error.message}</p>
    );
  }

  return (
    <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
      <p>{error.message}</p>
    </div>
  );
}

/**
 * Confirmation dialog for reactivating a soft-deleted account.
 *
 * Its own dialog rather than a button inside an error banner, because this is a
 * consequential, one-way choice: the backend restores the account as a FREE user
 * and clears purchased bonuses. A confirm step with an explicit Cancel makes the
 * trade visible instead of hiding it behind a single click on a red notice.
 *
 * Rendered ABOVE the login modal (z-[110] over its z-[100]) so it reads as a
 * question about the screen behind it, and the backdrop is inert while the
 * request is in flight to avoid orphaning it.
 */
function ReactivateConfirm({
  busy,
  body,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  /** What happens on confirm. Differs by route: reactivating from the login step
   *  signs the user straight in, while from the forgot-password step it only
   *  emails a code — saying so avoids promising a session they won't get yet. */
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden
      />
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reactivate-title"
        aria-describedby="reactivate-body"
      >
        <h2 id="reactivate-title" className="text-lg font-semibold text-gray-900">
          Reactivate your account?
        </h2>
        <p id="reactivate-body" className="mt-2 text-sm leading-relaxed text-gray-600">
          {body}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={`flex-1 ${PRIMARY_BUTTON_CLASS}`}
          >
            {busy ? "Reactivating…" : "Reactivate"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * In-app browsers (Instagram, LinkedIn, TikTok…) block OAuth popups, and the
 * provider buttons fail silently there. We show no sign-in options at all —
 * only the way out to a real browser.
 */
function InAppEscape({
  showInstructions,
  copied,
  onEscape,
  onCopy,
}: {
  showInstructions: boolean;
  copied: boolean;
  onEscape: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
        <p className="font-medium">Open this page in your browser to sign in</p>
        <p className="mt-1 text-amber-800">
          Sign-in isn&apos;t allowed inside this in-app browser. Tap the{" "}
          <span className="font-semibold">⋯</span> menu above and choose{" "}
          <span className="font-semibold">&ldquo;Open in Safari&rdquo;</span> (or{" "}
          <span className="font-semibold">&ldquo;Open in Browser&rdquo;</span>), then sign in.
        </p>
        {showInstructions && (
          <p className="mt-2 font-medium text-amber-900">
            Copy the link below if the menu doesn&apos;t offer that option.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEscape}
            className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
          >
            Open in browser
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
          >
            {copied ? "Link copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
