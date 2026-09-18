import { useEffect } from "react";
import ReactDOM from "react-dom";

import AuthFlow, { type LoginModalCopy } from "./AuthFlow";

export type { LoginModalCopy };

interface LoginModalProps extends LoginModalCopy {
  open: boolean;
  onClose: () => void;
  /** Runs on a successful sign-in; the provider uses it to close the modal. */
  onSuccess?: () => void;
  /** Suppresses the default post-login redirect (see LoginModalContext). */
  skipRedirect?: boolean;
}

/**
 * Dialog chrome around the shared sign-in surface.
 *
 * The flow itself lives in AuthFlow, which the full-page /signin and /signup
 * routes render too — so this file is only the portal, backdrop and close
 * button. Keeping one implementation is what stops the modal and the page
 * drifting apart on things like the 409 provider narrowing or the burned-code
 * recovery.
 *
 * Still used by the in-place tool gates (SignupGate, the /tools widgets, the
 * support widget), which sign the user in WITHOUT navigating away so a
 * half-filled form survives. Plain CTAs link to /signin instead.
 */
export default function LoginModal({
  open,
  onClose,
  onSuccess,
  skipRedirect,
  title,
  subtitle,
}: LoginModalProps) {
  // Escape closes. The backdrop stays clickable here rather than tracking the
  // flow's busy state, which now lives inside AuthFlow.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
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
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <AuthFlow
          active={open}
          variant="modal"
          onSuccess={onSuccess}
          skipRedirect={skipRedirect}
          title={title}
          subtitle={subtitle}
        />
      </div>
    </div>,
    document.body
  );
}
