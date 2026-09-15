/**
 * Sign in with Microsoft, via MSAL loaded on demand.
 *
 * Uses the popup flow so the browser hands us an ID token in-page, exactly like
 * Google Identity Services gives us a credential and Apple gives us an identity
 * token — same shape of call site for all three providers.
 *
 * MSAL is ~40KB gzipped, so it is imported dynamically inside the click handler
 * rather than at module scope: visitors who never sign in never download it.
 */
import type { PublicClientApplication } from "@azure/msal-browser";

export interface MicrosoftSignInResult {
  idToken: string;
}

/** Raised when the user closes the MSAL popup — not a real failure. */
export class MicrosoftSignInCancelled extends Error {
  constructor() {
    super("Microsoft sign-in cancelled");
    this.name = "MicrosoftSignInCancelled";
  }
}

// MSAL throws these when the user dismisses or blocks the popup.
const CANCEL_CODES = new Set([
  "user_cancelled",
  "popup_window_error",
  "empty_window_error",
]);

let msalPromise: Promise<PublicClientApplication> | null = null;

async function getMsal(): Promise<PublicClientApplication> {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("Microsoft sign-in is not configured");

  // Cache the initialized instance so a second click doesn't re-download or
  // re-initialize; MSAL requires initialize() before any auth call in v3+.
  if (!msalPromise) {
    msalPromise = (async () => {
      const { PublicClientApplication: PCA } = await import("@azure/msal-browser");
      const instance = new PCA({
        auth: {
          clientId,
          // "common" accepts personal Microsoft accounts (outlook.com,
          // hotmail.com, live.com) and any organization's Microsoft 365 tenant.
          authority: "https://login.microsoftonline.com/common",
          redirectUri: window.location.origin,
        },
        cache: {
          // sessionStorage, not localStorage: MSAL's own account cache should
          // not outlive the tab or sit alongside our long-lived b2v_token.
          cacheLocation: "sessionStorage",
        },
      });
      await instance.initialize();
      return instance;
    })().catch((err) => {
      msalPromise = null; // allow a retry on the next click
      throw err;
    });
  }
  return msalPromise;
}

export function isMicrosoftSignInConfigured(): boolean {
  return Boolean(import.meta.env.VITE_MICROSOFT_CLIENT_ID);
}

/**
 * Open Microsoft's sign-in popup and resolve with the ID token.
 *
 * Throws MicrosoftSignInCancelled if the user dismissed the popup, so callers
 * can stay silent instead of showing an error for a deliberate action.
 */
export async function signInWithMicrosoft(): Promise<MicrosoftSignInResult> {
  const msal = await getMsal();

  let result;
  try {
    result = await msal.loginPopup({ scopes: ["openid", "profile", "email"] });
  } catch (err: unknown) {
    const code = (err as { errorCode?: string })?.errorCode;
    if (code && CANCEL_CODES.has(code)) {
      throw new MicrosoftSignInCancelled();
    }
    throw new Error("Microsoft sign-in failed. Please try again.");
  }

  if (!result?.idToken) throw new Error("Microsoft sign-in returned no ID token");
  return { idToken: result.idToken };
}
