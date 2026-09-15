import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { GoogleLogin } from "@react-oauth/google";

import AppleAuthButton from "../public/AppleAuthButton";
import MicrosoftAuthButton from "../public/MicrosoftAuthButton";
import { useSocialLogin } from "../../hooks/useSocialLogin";
import { isAppleSignInConfigured } from "../../lib/appleSignIn";
import { isMicrosoftSignInConfigured } from "../../lib/microsoftSignIn";
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

const DEFAULT_TITLE = "Sign in to Blog2Video";
const DEFAULT_SUBTITLE = "Choose how you'd like to continue.";

/**
 * The single sign-in surface for the whole app.
 *
 * Every "Get started" / "Sign in" CTA opens this modal and the user picks a
 * provider here, so provider choice, error recovery, and the in-app-browser
 * escape flow are implemented once instead of per page.
 */
export default function LoginModal({
  open,
  onClose,
  onSuccess,
  skipRedirect,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: LoginModalProps) {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithMicrosoft,
    onGoogleError,
    signingIn,
    error,
    reactivate,
    reset,
  } = useSocialLogin({ onSuccess, skipRedirect });

  // Only consult the UA once the modal opens; the result never changes for a
  // given page load, but this keeps the check out of the render path.
  const [inApp, setInApp] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInApp(detectInAppBrowser().isInApp);
    setShowInstructions(false);
    setCopied(false);
    reset();
  }, [open, reset]);

  // Escape closes, and the backdrop is inert while a sign-in is in flight so a
  // stray click can't orphan an in-progress exchange.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signingIn) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, signingIn, onClose]);

  const handleEscape = useCallback(() => {
    // Android can hand off to Chrome; iOS cannot, so fall back to instructions.
    if (!escapeToSystemBrowser(window.location.href)) setShowInstructions(true);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyLink(window.location.href);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }, []);

  if (!open) return null;

  // After a wrong-provider rejection we know exactly which provider owns the
  // email, so offer only that one — recovery becomes a single click instead of
  // another guess between several buttons.
  const onlyProvider = error?.kind === "wrong_provider" ? error.provider : null;

  // One list so adding a provider is a single entry. A provider whose client id
  // isn't configured hides itself, which is what makes this safe to ship before
  // the provider's console setup is done.
  const providers = [
    {
      id: "apple",
      enabled: isAppleSignInConfigured(),
      render: () => (
        <AppleAuthButton
          onClick={signInWithApple}
          text={onlyProvider ? "signin_with" : "continue_with"}
        />
      ),
    },
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
    {
      id: "microsoft",
      enabled: isMicrosoftSignInConfigured(),
      render: () => (
        <MicrosoftAuthButton
          onClick={signInWithMicrosoft}
          text={onlyProvider ? "signin_with" : "continue_with"}
        />
      ),
    },
  ].filter((p) => p.enabled && (onlyProvider === null || onlyProvider === p.id));

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={signingIn ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-7 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={signingIn}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="login-modal-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>

        <div className="mt-6">
          {inApp ? (
            <InAppEscape
              showInstructions={showInstructions}
              copied={copied}
              onEscape={handleEscape}
              onCopy={handleCopy}
            />
          ) : signingIn ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-purple-600" />
              <p className="text-sm text-gray-600">Signing you in…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {error && <LoginErrorNotice error={error} onReactivate={reactivate} />}

              {/* One fixed-width row per provider. Google Identity Services
                  renders its own iframe and does not honour `width` exactly, so
                  the row — not the button — defines the box; our own buttons
                  stretch to fill it and GIS is centred inside it. That keeps all
                  three the same width even though one is not ours to style. */}
              {providers.map((p) => (
                <div key={p.id} className="flex w-[300px] max-w-full justify-center">
                  {p.render()}
                </div>
              ))}
            </div>
          )}
        </div>

        {!inApp && (
          <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
            By continuing you agree to our{" "}
            <a href="/terms" className="underline hover:text-gray-600">Terms</a> and{" "}
            <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Error banner, including the one-click switch to the correct provider. */
function LoginErrorNotice({
  error,
  onReactivate,
}: {
  error: NonNullable<ReturnType<typeof useSocialLogin>["error"]>;
  onReactivate: () => void;
}) {
  const isWrongProvider = error.kind === "wrong_provider";
  const tone = isWrongProvider
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`w-full rounded-xl border p-3 text-left text-xs ${tone}`}>
      <p>{error.message}</p>
      {error.kind === "account_deleted" && (
        <button
          type="button"
          onClick={onReactivate}
          className="mt-2 inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100"
        >
          Reactivate my account
        </button>
      )}
    </div>
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
    <div className="flex flex-col items-center gap-3">
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
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
