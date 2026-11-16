import { ApiError, exchangeConnectionToken } from "../api/client";
import { clearPendingConnection, getAuth, getPendingConnection, setAuth } from "./storage";

/**
 * Collects the access token for a connection the user is approving in the web app.
 *
 * Shared by the popup and the background service worker. The popup must be able to
 * finish the handshake itself: MV3 suspends the worker ~30s after its last event, so
 * its fast poll dies while the user is still logging in / approving, and reopening
 * the popup before the next alarm used to show "Connect" again — clicking it started
 * a brand-new connection and the approval just given was never collected.
 *
 *  - "connected": a token is stored (by this call or by the other context).
 *  - "pending":   not approved yet, or a transient network/server error — keep polling.
 *  - "failed":    the request is gone (expired, invalid, collected elsewhere and lost).
 *  - "none":      there is no pending connection.
 */
export type CollectResult = "connected" | "pending" | "failed" | "none";

let inFlight: Promise<CollectResult> | null = null;

export function collectPendingConnection(): Promise<CollectResult> {
  if (!inFlight) inFlight = collect().finally(() => (inFlight = null));
  return inFlight;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function collect(): Promise<CollectResult> {
  if (await getAuth()) {
    await clearPendingConnection();
    return "connected";
  }
  const pending = await getPendingConnection();
  if (!pending) return "none";
  try {
    const result = await exchangeConnectionToken(pending.connectionId, pending.deviceCode);
    if (result.status === "connected") {
      await setAuth({ accessToken: result.access_token });
      await clearPendingConnection();
      return "connected";
    }
    return "pending";
  } catch (err) {
    if (!(err instanceof ApiError)) return "pending"; // offline / network blip — retry
    if (err.status === 409) {
      // The other context (popup or worker) collected the token first and is
      // about to store it — give that write a moment to land.
      for (let i = 0; i < 4; i++) {
        await sleep(500);
        if (await getAuth()) {
          await clearPendingConnection();
          return "connected";
        }
      }
    }
    if (err.status === 401 || err.status === 404 || err.status === 409 || err.status === 410) {
      await clearPendingConnection();
      return "failed";
    }
    return "pending"; // 5xx etc. — retry
  }
}
