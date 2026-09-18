/**
 * Sign in with Apple, via Apple's official JS SDK loaded on demand.
 *
 * We use the popup flow so the browser hands us an identity token in-page,
 * exactly like Google Identity Services gives us a credential — no server
 * redirect, and the same shape of call site for both providers.
 *
 * Apple returns the user's NAME only on the very first authorization, in the
 * response's `user` field rather than inside the token. Callers must forward it
 * to the backend on that first sign-in or the name is lost forever.
 */

const APPLE_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

export interface AppleSignInResult {
  identityToken: string;
  /** Present only on the user's first authorization for this Services ID. */
  user?: { name?: { firstName?: string; lastName?: string } };
}

interface AppleAuthResponse {
  authorization?: { id_token?: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<AppleAuthResponse>;
      };
    };
  }
}

/** Raised when the user closes the Apple popup — not a real failure. */
export class AppleSignInCancelled extends Error {
  constructor() {
    super("Apple sign-in cancelled");
    this.name = "AppleSignInCancelled";
  }
}

let sdkPromise: Promise<void> | null = null;

function loadAppleSdk(): Promise<void> {
  if (window.AppleID) return Promise.resolve();
  // Cache the in-flight load so two buttons don't inject two script tags.
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${APPLE_SDK_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Apple SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = APPLE_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null; // allow a retry on the next click
      reject(new Error("Apple SDK failed to load"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function isAppleSignInConfigured(): boolean {
  return Boolean(import.meta.env.VITE_APPLE_CLIENT_ID);
}

/**
 * Open Apple's sign-in popup and resolve with the identity token.
 *
 * Throws AppleSignInCancelled if the user dismissed the popup, so callers can
 * stay silent instead of showing an error for a deliberate action.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  if (!clientId) throw new Error("Apple sign-in is not configured");

  await loadAppleSdk();
  if (!window.AppleID) throw new Error("Apple SDK failed to load");

  window.AppleID.auth.init({
    clientId,
    scope: "name email",
    // Apple validates this against the Services ID's registered Return URLs;
    // an unregistered origin is rejected outright.
    redirectURI: window.location.origin,
    usePopup: true,
  });

  let response: AppleAuthResponse;
  try {
    response = await window.AppleID.auth.signIn();
  } catch (err: unknown) {
    const code = (err as { error?: string })?.error;
    if (code === "popup_closed_by_user" || code === "user_cancelled_authorize") {
      throw new AppleSignInCancelled();
    }
    throw new Error("Apple sign-in failed. Please try again.");
  }

  const identityToken = response?.authorization?.id_token;
  if (!identityToken) throw new Error("Apple sign-in returned no identity token");

  return { identityToken, user: response.user };
}
