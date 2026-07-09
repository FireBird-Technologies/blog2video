import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceChangeStatus } from "../api/client";

interface Props {
  projectId: number;
  /** Reload the project once the operation finishes. */
  onComplete: () => void | Promise<unknown>;
  onError: (message: string) => void;
  /** Fired whenever a voice add/change/delete op starts or stops, so the page can
   *  disable other job triggers while one is running. */
  onRunningChange?: (running: boolean) => void;
  /**
   * Seed to show the modal instantly when an operation is kicked off locally
   * (otherwise the modal still appears within one poll via the mount check).
   * Pass a fresh object each time so the effect re-fires.
   */
  kickstart?: { kind: string; total: number } | null;
}

/**
 * Page-level progress modal for a project's voiceover add/change ("voice_change")
 * or delete operation. It is always mounted (independent of the active tab), so it
 * survives tab switches and re-opens after a full page refresh: on mount it asks the
 * server whether an operation is running (the backend tracks progress + reports the
 * "kind") and, if so, shows the matching modal and resumes polling. Renders nothing
 * when no operation is active.
 */
export default function VoiceOperationModal({ projectId, onComplete, onError, onRunningChange, kickstart }: Props) {
  const [visible, setVisible] = useState(false);

  // Report visibility (== "an op is running") up to the page. Keep the callback in a
  // ref so this effect doesn't re-fire when the parent passes a new function identity.
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  useEffect(() => {
    onRunningChangeRef.current?.(visible);
  }, [visible]);
  const [kind, setKind] = useState<string>("voice_change");
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [progress, setProgress] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const totalRef = useRef(0);
  totalRef.current = total;

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
        setVisible(false);
        onError(error);
        finishingRef.current = false;
        return;
      }
      // Pin the bar to 100% and reload BEFORE hiding so the fresh project is ready
      // the moment the modal closes (no stale flash, never closes mid-progress).
      setProgress(100);
      setCompleted(totalRef.current);
      await onComplete();
      setVisible(false);
      finishingRef.current = false;
    },
    [onComplete, onError, stop]
  );

  const startPolling = useCallback(() => {
    stop();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getVoiceChangeStatus(projectId);
        if (data.kind) setKind(data.kind);
        if (data.total > 0) setTotal(data.total);
        setCompleted(data.completed);
        setProgress(data.progress);
        if (data.done || !data.active) {
          await finish(data.error);
        }
      } catch {
        // transient poll failure — keep trying until the next tick
      }
    }, 1200);
  }, [projectId, finish, stop]);

  // Resume an in-flight operation on mount (refresh / tab change / re-navigate).
  useEffect(() => {
    let cancelled = false;
    finishingRef.current = false;
    (async () => {
      try {
        const { data } = await getVoiceChangeStatus(projectId);
        if (cancelled || !data.active) return;
        if (data.kind) setKind(data.kind);
        setTotal(data.total);
        setCompleted(data.completed);
        setProgress(data.progress);
        setVisible(true);
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

  // Show instantly when an operation is kicked off locally.
  useEffect(() => {
    if (!kickstart) return;
    finishingRef.current = false;
    setKind(kickstart.kind);
    setTotal(kickstart.total);
    setCompleted(0);
    setProgress(0);
    setVisible(true);
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickstart]);

  if (!visible) return null;

  const isDelete = kind === "delete";
  const accent = isDelete
    ? { spinner: "border-red-200 border-t-red-600", bar: "bg-red-600" }
    : { spinner: "border-purple-200 border-t-purple-600", bar: "bg-purple-600" };
  const title = isDelete ? "Deleting voiceover" : "Generating voiceover";
  const subtitle = isDelete ? "Removing voiceover…" : "Generating new voiceover…";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <span className={`w-9 h-9 border-[3px] ${accent.spinner} rounded-full animate-spin`} />
          <p className="text-sm font-medium text-gray-700">{subtitle}</p>
          <div className="w-full">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full ${accent.bar} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500 text-center tabular-nums">
              {total > 0 ? `${completed} of ${total} scenes • ${progress}%` : `${progress}%`}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 text-center">
            This may take a moment. Please wait and do not close the modal.
          </p>
        </div>
      </div>
    </div>
  );
}
