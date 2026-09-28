import { useCallback, useEffect, useRef, useState } from "react";
import { oauthMessageOrigin } from "../api/integrations";

/**
 * Drive a backend OAuth popup: open the consent URL, then settle when the
 * backend's callback page posts `{source: "b2v-social-oauth", platform, ok, error}`
 * — or when the user just closes the popup (checked once a second), which
 * otherwise would leave the UI on "Connecting…" forever.
 *
 * Same contract as the YouTube/LinkedIn flow in PublishToSocialModal; the
 * message is only trusted from the BACKEND origin, which serves the callback.
 */
export function useOAuthPopup(
  platform: string,
  onDone: (result: { ok: boolean; error?: string; closed?: boolean }) => void
) {
  const [connecting, setConnecting] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const stopWatching = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    popupRef.current = null;
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  useEffect(() => {
    const expectedOrigin = oauthMessageOrigin();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      const data = event.data as { source?: string; platform?: string; ok?: boolean; error?: string } | undefined;
      if (!data || data.source !== "b2v-social-oauth" || data.platform !== platform) return;
      stopWatching();
      setConnecting(false);
      doneRef.current({ ok: !!data.ok, error: data.error });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [platform, stopWatching]);

  /** Open the popup at `url` (fetch it first; popups must open from the click). */
  const open = useCallback(
    (url: string) => {
      setBlockedUrl(null);
      const popup = window.open(url, "b2v-connect", "width=600,height=760,menubar=no,toolbar=no");
      if (!popup) {
        // Blocked: offer the link so the flow is still completable.
        setBlockedUrl(url);
        setConnecting(false);
        return;
      }
      setConnecting(true);
      stopWatching();
      popupRef.current = popup;
      pollRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          stopWatching();
          setConnecting(false);
          doneRef.current({ ok: false, closed: true });
        }
      }, 1000);
    },
    [stopWatching]
  );

  return { open, connecting, setConnecting, blockedUrl };
}
