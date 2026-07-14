import { useCallback, useEffect, useRef, useState } from "react";
import { getLanguageChangeStatus } from "../api/client";

export type LanguageChangePhase = "translating" | "voiceover";

export interface LanguageChangeProgress {
  phase: LanguageChangePhase;
  /** 0-100, spanning BOTH passes. */
  progress: number;
  completed: number;
  total: number;
  /** Target language code, e.g. "ur". */
  contentLanguage: string | null;
}

interface Props {
  projectId: number;
  /** Reload the project once the run finishes. */
  onComplete: () => void | Promise<unknown>;
  onError: (message: string) => void;
  /** Fired when the run starts/stops so the page can disable other job triggers. */
  onRunningChange?: (running: boolean) => void;
  /** Streams progress so the page can render the step loader in the preview area. */
  onProgress?: (progress: LanguageChangeProgress) => void;
  /**
   * Seed to start tracking instantly when the run is kicked off locally (otherwise it
   * still picks up within one poll via the mount check). Pass a fresh object each time
   * so the effect re-fires.
   */
  kickstart?: { kind: "language_change"; total: number } | null;
}

/**
 * Headless progress tracker for a project language change. Renders nothing — the page
 * shows the two-step loader in the video preview area (like regenerate-script and
 * template-relayout do) rather than a full-screen overlay.
 *
 * Always mounted (independent of the active tab), so it survives tab switches and
 * resumes after a refresh by asking the server whether a run is in flight. Progress
 * spans TWO passes over the scenes (translate, then TTS), so `total` is 2 x scene
 * count and the server reports which `phase` is running.
 */
export default function LanguageChangeTracker({
  projectId,
  onComplete,
  onError,
  onRunningChange,
  onProgress,
  kickstart,
}: Props) {
  const [running, setRunning] = useState(false);

  // Keep callbacks in refs so these effects don't re-fire when the parent passes a new
  // function identity on every render.
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    onRunningChangeRef.current?.(running);
  }, [running]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const totalRef = useRef(0);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finish = useCallback(
    async (error?: string | null) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      stop();
      if (error) {
        setRunning(false);
        onError(error);
        finishingRef.current = false;
        return;
      }
      // Reload BEFORE clearing `running` so the fresh project is ready the moment the
      // loader is replaced by the editor (no stale flash).
      await onComplete();
      setRunning(false);
      finishingRef.current = false;
    },
    [onComplete, onError, stop]
  );

  const startPolling = useCallback(() => {
    stop();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getLanguageChangeStatus(projectId);
        if (data.total > 0) totalRef.current = data.total;
        onProgressRef.current?.({
          phase: data.phase ?? "translating",
          progress: data.progress,
          completed: data.completed,
          total: data.total || totalRef.current,
          contentLanguage: data.content_language,
        });
        if (data.done || !data.active) {
          await finish(data.error);
        }
      } catch {
        // transient poll failure — keep trying until the next tick
      }
    }, 1200);
  }, [projectId, finish, stop]);

  // Resume an in-flight run on mount (refresh / tab change / re-navigate).
  useEffect(() => {
    let cancelled = false;
    finishingRef.current = false;
    (async () => {
      try {
        const { data } = await getLanguageChangeStatus(projectId);
        if (cancelled || !data.active) return;
        totalRef.current = data.total;
        onProgressRef.current?.({
          phase: data.phase ?? "translating",
          progress: data.progress,
          completed: data.completed,
          total: data.total,
          contentLanguage: data.content_language,
        });
        setRunning(true);
        startPolling();
      } catch {
        // Nothing to resume.
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Start tracking instantly when the run is kicked off locally.
  useEffect(() => {
    if (!kickstart) return;
    finishingRef.current = false;
    totalRef.current = kickstart.total;
    onProgressRef.current?.({
      phase: "translating",
      progress: 0,
      completed: 0,
      total: kickstart.total,
      contentLanguage: null,
    });
    setRunning(true);
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickstart]);

  return null;
}
