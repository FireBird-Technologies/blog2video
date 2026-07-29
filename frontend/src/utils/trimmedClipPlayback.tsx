import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Ref,
  type VideoHTMLAttributes,
} from "react";

type TrimOpts = {
  clipDurationSeconds?: number;
  sceneDurationSeconds?: number;
  startSeconds?: number;
};

/** The [start, end) segment of a clip that a scene actually plays. */
export function getTrimmedClipWindow(
  clipDurationSeconds: number | undefined,
  sceneDurationSeconds: number | undefined,
  startSeconds?: number,
): { start: number; end: number } | null {
  const clipDur = clipDurationSeconds ?? 0;
  if (clipDur <= 0) return null;

  const sceneDur = sceneDurationSeconds ?? 0;
  const maxStart = sceneDur > 0 ? Math.max(0, clipDur - sceneDur) : 0;
  const start = Math.max(0, Math.min(startSeconds ?? 0, maxStart));
  const end = sceneDur > 0 ? Math.min(clipDur, start + sceneDur) : clipDur;

  if (end <= start + 0.04) return null;
  return { start, end };
}

function resolveWindow(video: HTMLVideoElement, opts: TrimOpts): { start: number; end: number } | null {
  const fromMeta =
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
  const clipDur = opts.clipDurationSeconds ?? fromMeta;
  return getTrimmedClipWindow(clipDur, opts.sceneDurationSeconds, opts.startSeconds);
}

function loopTrimmedClip(
  video: HTMLVideoElement,
  opts: TrimOpts,
  { resumePlayback = false }: { resumePlayback?: boolean } = {},
) {
  const window = resolveWindow(video, opts);
  if (!window) return;
  const dur = video.duration;
  if (!Number.isFinite(dur) || dur <= 0) return;
  const s = Math.min(window.start, Math.max(0, dur - 0.04));
  if (Math.abs(video.currentTime - s) > 0.03) video.currentTime = s;
  if (resumePlayback) {
    void video.play().catch(() => {});
  }
}

/** Loop a <video> inside `[window.start, window.end)` instead of the full file. */
export function bindTrimmedClipPlayback(video: HTMLVideoElement, opts: TrimOpts): () => void {
  const clampToWindow = () => {
    const window = resolveWindow(video, opts);
    if (!window) return;
    const dur = video.duration;
    const end = Math.min(window.end, Number.isFinite(dur) && dur > 0 ? dur : window.end);
    if (video.currentTime < window.start - 0.03 || video.currentTime >= end - 0.05) {
      loopTrimmedClip(video, opts, { resumePlayback: !video.paused || video.ended });
    }
  };

  const onMeta = () => loopTrimmedClip(video, opts);
  const onEnded = () => loopTrimmedClip(video, opts, { resumePlayback: true });

  video.addEventListener("loadedmetadata", onMeta);
  video.addEventListener("durationchange", onMeta);
  video.addEventListener("timeupdate", clampToWindow);
  video.addEventListener("play", clampToWindow);
  video.addEventListener("ended", onEnded);
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) loopTrimmedClip(video, opts);

  return () => {
    video.removeEventListener("loadedmetadata", onMeta);
    video.removeEventListener("durationchange", onMeta);
    video.removeEventListener("timeupdate", clampToWindow);
    video.removeEventListener("play", clampToWindow);
    video.removeEventListener("ended", onEnded);
  };
}

/**
 * Returns a ref callback that binds trimmed playback when the element mounts
 * and rebinds when trim options change.
 */
export function useTrimmedClipVideoRef(
  forwardRef?: Ref<HTMLVideoElement | null>,
  opts?: TrimOpts & { enabled?: boolean },
) {
  const { enabled = true, clipDurationSeconds, sceneDurationSeconds, startSeconds } = opts ?? {};
  const cleanupRef = useRef<(() => void) | null>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);

  const trimOpts = useMemo(
    (): TrimOpts => ({
      clipDurationSeconds,
      sceneDurationSeconds,
      startSeconds,
    }),
    [clipDurationSeconds, sceneDurationSeconds, startSeconds],
  );

  const detach = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      detach();
      elementRef.current = el;

      if (typeof forwardRef === "function") forwardRef(el);
      else if (forwardRef && "current" in forwardRef) {
        (forwardRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      }

      if (!el || !enabled) return;
      cleanupRef.current = bindTrimmedClipPlayback(el, trimOpts);
    },
    [detach, enabled, forwardRef, trimOpts],
  );

  // Rebind when trim window changes but the element is already mounted.
  useEffect(() => {
    if (!elementRef.current || !enabled) return;
    detach();
    cleanupRef.current = bindTrimmedClipPlayback(elementRef.current, trimOpts);
    return detach;
  }, [detach, enabled, trimOpts]);

  useEffect(() => () => detach(), [detach]);

  return attach;
}

/** `<video>` that loops only the scene's trimmed `[start, start + sceneDur)` window. */
export function TrimmedClipVideo({
  clipDurationSeconds,
  sceneDurationSeconds,
  startSeconds,
  ref: forwardRef,
  loop: _loop,
  ...rest
}: VideoHTMLAttributes<HTMLVideoElement> & {
  clipDurationSeconds?: number;
  sceneDurationSeconds?: number;
  startSeconds?: number;
  ref?: Ref<HTMLVideoElement | null>;
}) {
  const attachRef = useTrimmedClipVideoRef(forwardRef, {
    clipDurationSeconds,
    sceneDurationSeconds,
    startSeconds,
  });
  return <video ref={attachRef} playsInline {...rest} />;
}
