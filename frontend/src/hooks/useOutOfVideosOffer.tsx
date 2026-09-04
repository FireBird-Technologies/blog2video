import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";

const WINDOW_MS = 30 * 1000;
const STORAGE_PREFIX = "b2v_out_of_videos_offer_started_at_";

function storageKey(userId: number | undefined): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}${userId}`;
}

function readStartedAt(userId: number | undefined): number | null {
  const key = storageKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStartedAt(userId: number | undefined, value: number) {
  const key = storageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore quota / disabled storage
  }
}

export function useOutOfVideosOffer() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [wasDismissed, setWasDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<number | null>(null);

  const isEligibleNow = (): boolean => {
    if (!user) return false;
    if (user.plan !== "free") return false;
    return user.can_create_video === false;
  };

  const startedAt = readStartedAt(user?.id);
  const hasStarted = startedAt !== null;
  const expiresAt = hasStarted ? startedAt + WINDOW_MS : null;
  const isWindowLive = hasStarted && now < (startedAt as number) + WINDOW_MS;
  const secondsRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;

  // Tick whenever the window is live (modal open OR minimized pill visible) so
  // the countdown stays accurate in both states.
  useEffect(() => {
    if (!isWindowLive) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    setNow(Date.now());
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isWindowLive]);

  // Auto-dismiss when the window closes.
  useEffect(() => {
    if (isOpen && isWindowLive === false && hasStarted) {
      setIsOpen(false);
    }
  }, [isOpen, isWindowLive, hasStarted]);

  // Disabled: the scarcity/urgency offer modal must never appear. Every call
  // site already treats a `false` return as "fall back to the plain upgrade
  // toast", so short-circuiting here suppresses the modal without touching
  // any call site.
  const open = useCallback((): boolean => {
    return false;
  }, []);

  // User-initiated re-open from the minimized pill — bypasses wasDismissed.
  const expand = useCallback(() => {
    if (!isWindowLive) return;
    setWasDismissed(false);
    setNow(Date.now());
    setIsOpen(true);
  }, [isWindowLive]);

  const dismiss = useCallback(() => {
    setWasDismissed(true);
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    isEligibleNow: isEligibleNow(),
    isWindowLive,
    hasStarted,
    secondsRemaining,
    expiresAt,
    wasDismissed,
    open,
    expand,
    dismiss,
  };
}
