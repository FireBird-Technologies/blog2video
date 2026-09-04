import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAvatarProgress,
  getCachedAvatarProgress,
  type AvatarBatch,
  type AvatarProgress,
} from "../api/client";

/** How often the rollup is refetched while anything is in flight. Matches the
 *  cadence the wizard and the settings card each used to poll at separately. */
const POLL_MS = 1500;

/** Once the poller has declared the batch settled, keep checking in at this
 *  much slower cadence instead of going fully silent — see IDLE_POLL below. */
const IDLE_POLL_MS = 8000;

/** What the Avatar tab should render right now.
 *
 *  A DISCRIMINATED UNION, deliberately — "we don't know yet" used to be
 *  indistinguishable from "settings", which is exactly why a refresh mid-batch
 *  painted the placement/shape/size controls over five rendering scenes before
 *  correcting itself a second later. Making the unknown state its own variant is
 *  what lets the card show a skeleton instead of guessing wrong. */
export type AvatarView =
  | { kind: "loading" }
  | { kind: "progress"; batch: AvatarBatch; data: AvatarProgress }
  | { kind: "settings"; data: AvatarProgress };

/** Single source of truth for the Avatar tab, and the ONLY poller of
 *  /avatar-progress.
 *
 *  The view is read straight off `data.view`, which the server computes from the
 *  DB. Nothing here re-derives it. That is the whole point: the tab used to
 *  decide what to show from ~16 client-side guesses — a module-level cache that
 *  survives a tab switch but is empty after a hard refresh, a stale
 *  `avatar_batch_unlocked` latch, a default first-5 scene selection — so the same
 *  server state produced a different screen on every reload.
 *
 *  Three components polled this endpoint at once before (card 3s, matte watcher
 *  1.2s, wizard 1.2s), each writing the shared cache and racing each other. One
 *  poller also means one connection from a DB pool of 5 + 10 that renders already
 *  hold for minutes at a time.
 */
export function useAvatarProgress(projectId: number) {
  // Seeded from the last rollup THIS SESSION saw. Switching tabs unmounts the
  // whole Avatar tab, so without the seed a tab switch would flash the skeleton
  // for a round trip. It cannot cause a wrong view any more: a cache hit and a
  // fresh response both carry the server's `view`, so warm and cold differ only
  // in how long the skeleton shows — never in where you land.
  const [data, setData] = useState<AvatarProgress | null>(
    () => getCachedAvatarProgress(projectId),
  );
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Swap the running interval to a different cadence without a gap where
   *  no timer exists at all — see the settle branch in the tick below. */
  const setCadence = useCallback((ms: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => void tickRef.current(), ms);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data: next } = await getAvatarProgress(projectId);
      setData(next);
      setError(null);
      return next;
    } catch {
      // Transient failures keep the last known rollup on screen rather than
      // collapsing the view. A blank tab is a worse answer than a stale one, and
      // the next tick usually succeeds.
      setError("Could not reach the server.");
      return null;
    }
  }, [projectId]);

  /** One tick: refetch, and drop to the slow idle cadence once nothing is in
   *  flight — never fully stop while the tab is open.
   *
   *  Held in a ref so `refreshNow` can restart polling with the SAME
   *  self-adjusting tick. An earlier version had `refreshNow` schedule bare
   *  `refresh` instead, which had no stop condition — so starting a batch left
   *  a 1.5s poll running forever after that batch settled. */
  const tickRef = useRef<() => Promise<void>>(async () => {});
  // Consecutive non-"progress" reads seen in a row. A SINGLE stray reading
  // used to stop the poller for good — confirmed live on project 1245, where
  // one tick's `view` briefly read something other than "progress" (a race
  // between one job completing and its retry/successor row landing) and
  // polling then stayed dead for the rest of the page session: the batch kept
  // running server-side, but the card never asked again, so the last stale
  // rollup (which could still list scenes as "missing") sat there frozen
  // until a hard refresh remounted the hook. Requiring two IN A ROW filters
  // most of that out, but confirmed AGAIN live on project 1248 (Neon's pooler
  // occasionally serves a connection that hasn't seen a just-committed write
  // yet, and two ticks 1.5s apart can both land on stale connections) — so
  // "stop" no longer means "go silent," see IDLE_POLL_MS below.
  const settledStreakRef = useRef(0);
  // Which cadence the running interval is currently set to — so a tick only
  // calls setCadence (clear + recreate the interval) on an actual transition,
  // not on every single fast-poll tick while progress is ongoing.
  const cadenceRef = useRef(POLL_MS);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await refresh();
      if (cancelled || !next) return;
      if (next.view !== "progress") {
        settledStreakRef.current += 1;
        // Never clear the timer entirely — a permanently-dead poller is worse
        // than an idle one, since nothing short of a hard refresh recovers it
        // if this read was wrong. Once settled, back off to IDLE_POLL_MS
        // instead: cheap enough to run for the life of the tab, and it keeps
        // checking in case a "settled" read was a stale-connection fluke.
        if (settledStreakRef.current >= 2 && cadenceRef.current !== IDLE_POLL_MS) {
          cadenceRef.current = IDLE_POLL_MS;
          setCadence(IDLE_POLL_MS);
        }
      } else {
        settledStreakRef.current = 0;
        if (cadenceRef.current !== POLL_MS) {
          cadenceRef.current = POLL_MS;
          setCadence(POLL_MS);
        }
      }
    };
    tickRef.current = tick;
    cadenceRef.current = POLL_MS;
    setCadence(POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      stop();
    };
  }, [projectId, refresh, stop, setCadence]);

  /** Refetch immediately and resume fast polling — call after starting a
   *  batch, so the view flips to "progress" without waiting for the next
   *  idle-cadence tick. */
  const refreshNow = useCallback(async () => {
    const next = await refresh();
    settledStreakRef.current = 0;
    if (next?.view === "progress" && cadenceRef.current !== POLL_MS) {
      cadenceRef.current = POLL_MS;
      setCadence(POLL_MS);
    }
    return next;
  }, [refresh, setCadence]);

  const view: AvatarView = !data
    ? { kind: "loading" }
    : data.view === "progress"
      ? { kind: "progress", batch: data.batch, data }
      : { kind: "settings", data };

  return { view, data, error, refreshNow };
}
