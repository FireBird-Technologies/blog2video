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

  /** One tick: refetch, and stop the timer once nothing is in flight.
   *
   *  Held in a ref so `refreshNow` can restart polling with the SAME
   *  self-stopping tick. An earlier version had `refreshNow` schedule bare
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
  // until a hard refresh remounted the hook. Requiring two IN A ROW before
  // stopping filters that out — a genuinely settled project still reports
  // the same view on its very next tick, 1.5s later, so this costs one extra
  // request per settle rather than a permanent timer.
  const settledStreakRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await refresh();
      if (cancelled || !next) return;
      if (next.view !== "progress") {
        settledStreakRef.current += 1;
        // A settled project costs two requests per mount instead of a
        // permanent timer. `refreshNow` restarts it when the user starts a
        // batch (and resets the streak below).
        if (settledStreakRef.current >= 2) stop();
      } else {
        settledStreakRef.current = 0;
      }
    };
    tickRef.current = tick;
    stop();
    timerRef.current = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      stop();
    };
  }, [projectId, refresh, stop]);

  /** Refetch immediately and resume polling — call after starting a batch, so
   *  the view flips to "progress" without waiting for the next tick. */
  const refreshNow = useCallback(async () => {
    const next = await refresh();
    settledStreakRef.current = 0;
    if (next?.view === "progress" && !timerRef.current) {
      timerRef.current = setInterval(() => void tickRef.current(), POLL_MS);
    }
    return next;
  }, [refresh]);

  const view: AvatarView = !data
    ? { kind: "loading" }
    : data.view === "progress"
      ? { kind: "progress", batch: data.batch, data }
      : { kind: "settings", data };

  return { view, data, error, refreshNow };
}
