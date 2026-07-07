import { useEffect, useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import {
  detectInAppBrowser,
  escapeToSystemBrowser,
  copyLink,
} from "../../lib/inAppBrowser";

interface GoogleAuthButtonProps {
  onSuccess: (response: CredentialResponse) => void;
  onError: () => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  width?: string;
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  text = "continue_with",
  width = "300",
}: GoogleAuthButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInApp(detectInAppBrowser().isInApp);
  }, []);

  if (!mounted) {
    return (
      <div className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-500 shadow-sm">
        Continue with Google
      </div>
    );
  }

  // Inside an in-app browser (e.g. opened from LinkedIn/Instagram), Google
  // silently blocks OAuth in the embedded webview. Render an escape flow instead
  // of the dead Google button.
  if (inApp) {
    const handleEscape = () => {
      const escaped = escapeToSystemBrowser(window.location.href);
      // iOS (and any failed Android attempt) can't auto-escape — show steps.
      if (!escaped) setShowInstructions(true);
    };

    const handleCopy = async () => {
      const ok = await copyLink(window.location.href);
      setCopied(ok);
      if (ok) setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col items-center gap-3" style={{ width: `${width}px`, maxWidth: "100%" }}>
        <button
          type="button"
          onClick={handleEscape}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" />
          Continue with Google
        </button>

        {showInstructions && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <p className="font-medium">Open this page in your browser to sign in</p>
            <p className="mt-1 text-amber-800">
              Google sign-in isn&apos;t allowed inside this in-app browser. Tap the
              {" "}<span className="font-semibold">⋯</span> menu above and choose
              {" "}<span className="font-semibold">&ldquo;Open in Safari&rdquo;</span> (or
              {" "}<span className="font-semibold">&ldquo;Open in Browser&rdquo;</span>), then sign in.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2 inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
            >
              {copied ? "Link copied!" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <GoogleLogin
      onSuccess={onSuccess}
      onError={onError}
      size="large"
      shape="pill"
      text={text}
      theme="outline"
      width={width}
    />
  );
}
