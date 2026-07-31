import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { CraftedTemplateDetail, Project, Scene } from "../api/client";
import SceneOnlyPlayer from "./SceneOnlyPlayer";
import useIsMobileViewport from "../hooks/useIsMobileViewport";

export interface RecordVoiceoverModalProps {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  /** Called with the recorded audio blob and its measured duration (seconds) on "Apply". */
  onApply: (sceneId: number, blob: Blob, durationSeconds: number) => void;
  /**
   * Full project. When supplied (and not on mobile) the scene plays alongside the
   * recording so the user can feel its pacing. Omit to get the recorder alone.
   */
  project?: Project;
  layoutPropSchema?: Record<string, { defaults?: Record<string, unknown> }>;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  ownerScopedProjectId?: number;
}

type RecState = "idle" | "recording" | "recorded";

/** Hard cap on recording length (seconds) — recording auto-stops here. */
const MAX_SECONDS = 60;
/** When elapsed reaches this, warn the user how long they have left. */
const WARN_SECONDS = 45;

/** Pick the first MediaRecorder mimeType the browser supports. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Scrolling waveform recorder: samples RMS loudness from an AnalyserNode and
 * draws a history of bars that scroll right-to-left as time passes (newest on
 * the right, like iOS Voice Memos). Also reports the live level via `onLevel`
 * so the parent can pulse the mic icon.
 */
function WaveformRecorder({
  analyser,
  onLevel,
}: {
  analyser: AnalyserNode;
  /** Reports live RMS loudness (0..1) so the parent can pulse the mic icon. */
  onLevel: (level: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;

  useEffect(() => {
    const time = new Uint8Array(analyser.fftSize);
    // Rolling history of bar amplitudes (0..1); newest pushed to the end.
    const history: number[] = [];
    const BAR_W = 4; // px per bar
    const GAP = 2.5; // px between bars
    const SAMPLE_MS = 60; // how often a new bar is captured
    let lastSample = 0;
    let raf = 0;
    // Throttle state updates to the parent (see `draw`).
    let lastLevelReport = 0;
    let lastReportedLevel = 0;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    if (canvas && ctx) {
      // Scale for crisp rendering on HiDPI.
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    const readLevel = () => {
      analyser.getByteTimeDomainData(time);
      let sumSq = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / time.length);
      return Math.min(1, rms * 3);
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const level = readLevel();
      // Report upward at most ~12x/sec, and only on a visible change. Calling
      // this every frame re-renders the whole modal 60x/sec — which starves the
      // scene preview's own rAF loop and makes it crawl. The canvas below still
      // redraws every frame, so the waveform stays smooth.
      if (now - lastLevelReport >= 80 && Math.abs(level - lastReportedLevel) > 0.04) {
        lastLevelReport = now;
        lastReportedLevel = level;
        onLevelRef.current(level);
      }

      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const maxBars = Math.ceil(w / (BAR_W + GAP)) + 1;

      // Capture a new bar at a steady cadence so scroll speed is time-based,
      // not frame-rate dependent.
      if (now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        history.push(level);
        if (history.length > maxBars) history.shift();
      }

      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#6366f1"); // indigo
      grad.addColorStop(1, "#d946ef"); // fuchsia
      ctx.fillStyle = grad;

      // Draw newest bar flush to the right edge, older bars trailing left.
      for (let i = 0; i < history.length; i++) {
        const amp = history[history.length - 1 - i];
        const barH = Math.max(2, amp * (h - 4));
        const x = w - BAR_W - i * (BAR_W + GAP);
        if (x + BAR_W < 0) break;
        const y = (h - barH) / 2;
        const r = BAR_W / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + BAR_W, y, x + BAR_W, y + barH, r);
        ctx.arcTo(x + BAR_W, y + barH, x, y + barH, r);
        ctx.arcTo(x, y + barH, x, y, r);
        ctx.arcTo(x, y, x + BAR_W, y, r);
        ctx.closePath();
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      onLevelRef.current(0);
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16"
      style={{ display: "block" }}
    />
  );
}

export default function RecordVoiceoverModal({
  open,
  onClose,
  scene,
  onApply,
  project,
  layoutPropSchema,
  precompiledTemplateData,
  precompiledCraftedDetail,
  ownerScopedProjectId,
}: RecordVoiceoverModalProps) {
  const [recState, setRecState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /**
   * Measured length of the finished take. Mirrors `durationRef` as state so the
   * preview can re-render at the new scene length once recording stops —
   * matching how the scene will actually be timed after Apply.
   */
  const [recordedDuration, setRecordedDuration] = useState<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [micLevel, setMicLevel] = useState(0); // 0..1 live loudness, drives the mic pulse

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Web Audio analysis for the live frequency/loudness visualizer.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // ─── Scene preview ──────────────────────────────────────────────────────
  // Plays the scene alongside the take so the user can feel its pacing. Never
  // on mobile: a Remotion Player there OOMs/reloads iOS Safari tabs.
  const isMobile = useIsMobileViewport();
  const showPreview = !isMobile && !!project;
  const playerRef = useRef<PlayerRef | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPortrait = project?.aspect_ratio === "portrait";

  // Mirrors recState for the ref callback below, which fires outside React's
  // render flow and would otherwise close over a stale value.
  const recStateRef = useRef<RecState>("idle");

  /**
   * While recording: the full recording cap, so the scene runs for as long as
   * the take can and simply holds once its animation is done — it never ends,
   * so it can't fade out, rewind or need an artificial stop. Safe because
   * layouts schedule their acts on FIXED frame constants (chronicle's BookOpen
   * finishes at frame 134 regardless of length); duration only moves the closing
   * fade, which a 60s window pushes far past anything the user will see.
   *
   * Once recorded: re-timed to what the scene will actually become, mirroring
   * the backend — max(7, take + 1s pad) + extra hold.
   *
   * Memoised because SceneOnlyPlayer is memoised: a new value each render would
   * re-render the Player subtree on every mic-level tick.
   */
  const previewDurationSeconds = useMemo(() => {
    if (recordedDuration == null) return MAX_SECONDS;
    return (
      Math.max(7, recordedDuration + 1.0) + (Number(scene.extra_hold_seconds) || 0)
    );
  }, [recordedDuration, scene.extra_hold_seconds]);

  const pausePreview = () => {
    try {
      playerRef.current?.pause();
    } catch {
      /* preview is best-effort — never let it break recording */
    }
  };

  /**
   * Start the scene from frame 0, muted. Idempotent: whichever of the effect or
   * the ref callback runs second finds the player already playing and leaves the
   * playhead alone, so the scene never restarts mid-take.
   */
  const startPreviewFromZero = (p: PlayerRef | null) => {
    if (!p) return;
    try {
      p.mute();
      if (p.isPlaying()) return;
      p.seekTo(0);
      p.play();
    } catch {
      /* best-effort */
    }
  };

  /**
   * VideoPreview renders a loading spinner *instead of* the Player until media
   * and templates finish loading, so the Player can mount well after recording
   * starts. Catching it via a ref callback (rather than polling on a deadline)
   * means a slow preload can't cause us to miss the start.
   *
   * Stable identity: SceneOnlyPlayer is memoised, and a fresh callback each
   * render would defeat that.
   *
   * Note there is deliberately no loop here — when the scene's animation ends it
   * holds on its last frame for the rest of the take, which is what the finished
   * video does when a voiceover outruns its scene.
   */
  const attachPlayerRef = useCallback((node: PlayerRef | null) => {
    playerRef.current = node;
    if (!node) return;
    if (recStateRef.current === "recording") startPreviewFromZero(node);
  }, []);

  const teardownAudioGraph = () => {
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* noop */
    }
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const cleanupStream = () => {
    teardownAudioGraph();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetPreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    blobRef.current = null;
    setRecordedDuration(null);
  };

  // Reset everything whenever the modal opens for a (possibly new) scene.
  useEffect(() => {
    if (!open) return;
    setRecState("idle");
    setError(null);
    setElapsed(0);
    setAnalyser(null);
    resetPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scene.id]);

  // Teardown on unmount / close.
  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStream();
      pausePreview();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Recording: run the scene in lockstep with the take ─────────────────
  // Two ways in, because the Player may mount before OR after recording starts:
  //  - already mounted when Start is pressed → this effect fires it;
  //  - still behind VideoPreview's loading gate → `attachPlayerRef` fires it on mount.
  // (Player.play() is synchronous and returns void — Remotion advances frames with
  // requestAnimationFrame, so no autoplay policy applies.)
  useEffect(() => {
    recStateRef.current = recState;
    if (!showPreview || recState !== "recording") return;
    startPreviewFromZero(playerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, recState]);


  // ─── Playback: drive the scene from the recorded audio's position ────────
  useEffect(() => {
    if (!showPreview || recState !== "recorded") return;
    const audio = audioElRef.current;
    if (!audio) return;

    const FPS = 30;
    const frameFor = () => Math.max(0, Math.round(audio.currentTime * FPS));

    const onPlay = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        p.mute();
        p.seekTo(frameFor());
        p.play();
      } catch {
        /* best-effort */
      }
    };
    const onPause = () => pausePreview();
    const onSeek = () => {
      try {
        playerRef.current?.seekTo(frameFor());
      } catch {
        /* best-effort */
      }
    };
    // timeupdate fires ~4x/sec; only correct real drift so we don't fight the player.
    const onTimeUpdate = () => {
      const p = playerRef.current;
      if (!p || audio.paused) return;
      try {
        const target = frameFor();
        if (Math.abs(p.getCurrentFrame() - target) > 3) p.seekTo(target);
      } catch {
        /* best-effort */
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("seeking", onSeek);
    audio.addEventListener("seeked", onSeek);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("seeking", onSeek);
      audio.removeEventListener("seeked", onSeek);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      pausePreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, recState, previewUrl]);

  if (!open) return null;

  // Length of the scene's existing/current voiceover, shown for reference so the
  // user knows when a new recording exceeds it.
  const prevDuration = Math.round(Number(scene.duration_seconds) || 0);

  const startRecording = async () => {
    setError(null);
    resetPreview();
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Wire up a Web Audio analyser to drive the live visualizer.
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const node = ctx.createAnalyser();
          node.fftSize = 1024;
          node.smoothingTimeConstant = 0.8;
          source.connect(node);
          audioCtxRef.current = ctx;
          sourceRef.current = source;
          analyserRef.current = node;
          setAnalyser(node);
        }
      } catch {
        // Visualizer is best-effort; recording still works without it.
      }

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Wall-clock recording length — reliable across formats (WebM blobs often
        // report Infinity for <audio>.duration until seeked).
        durationRef.current = Math.max(0.5, (performance.now() - startTimeRef.current) / 1000);
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setRecordedDuration(durationRef.current);
        setRecState("recorded");
        setAnalyser(null);
        // Also covers the MAX_SECONDS auto-stop, which reaches here via stopRecording().
        pausePreview();
        cleanupStream();
      };

      recorder.start();
      startTimeRef.current = performance.now();
      mediaRecorderRef.current = recorder;
      setRecState("recording");
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          // Auto-stop once we hit the hard cap.
          if (next >= MAX_SECONDS) {
            stopRecording();
          }
          return Math.min(next, MAX_SECONDS);
        });
      }, 1000);
    } catch (err) {
      setAnalyser(null);
      cleanupStream();
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Microphone access was denied. Please allow microphone access in your browser and try again."
        );
      } else if (name === "NotFoundError") {
        setError("No microphone was found. Please connect a microphone and try again.");
      } else {
        setError("Could not start recording. Please check your microphone and try again.");
      }
    }
  };

  const stopRecording = () => {
    stopTimer();
    // Freeze the scene where the take ended — the preview window is the take.
    pausePreview();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const reRecord = () => {
    resetPreview();
    setElapsed(0);
    setAnalyser(null);
    setRecState("idle");
    // Rewind so the next take starts from the top of the scene.
    try {
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
    } catch {
      /* best-effort */
    }
  };

  const handleApply = () => {
    if (!blobRef.current) return;
    onApply(scene.id, blobRef.current, durationRef.current);
    onClose();
  };

  const handleClose = () => {
    stopTimer();
    pausePreview();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    cleanupStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden ${
          showPreview ? (isPortrait ? "max-w-lg" : "max-w-3xl") : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="record-voiceover-title"
      >
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h3 id="record-voiceover-title" className="text-lg font-semibold text-gray-900">
            Record voiceover
          </h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {scene.title || `Scene ${scene.order}`}
          </p>
        </div>

        <div
          className={
            showPreview
              ? "p-6 flex flex-col sm:flex-row items-center sm:items-stretch gap-5"
              : "p-6 flex flex-col items-center gap-3"
          }
        >
          {showPreview && project && (
            <div className="w-full sm:flex-1 sm:min-w-0 flex flex-col justify-center">
              <SceneOnlyPlayer
                ref={attachPlayerRef}
                project={project}
                sceneId={scene.id}
                durationSeconds={previewDurationSeconds}
                muted
                layoutPropSchema={layoutPropSchema}
                precompiledTemplateData={precompiledTemplateData}
                precompiledCraftedDetail={precompiledCraftedDetail}
                ownerScopedProjectId={ownerScopedProjectId}
              />
              <p className="mt-2 text-[11px] text-gray-400 text-center">
                {recState === "recording"
                  ? "Playing along with your recording"
                  : recState === "recorded"
                    ? "Plays in sync with your recording below"
                    : "Preview — plays when you start recording"}
              </p>
            </div>
          )}

          <div
            className={
              showPreview
                ? "w-full sm:w-64 sm:flex-shrink-0 flex flex-col items-center gap-3"
                : "contents"
            }
          >
          {error && (
            <p className="w-full text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Mic / status indicator — pulses green with live loudness while recording */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            {recState === "recording" && (
              <span
                className="absolute inset-0 rounded-full bg-green-400/30"
                style={{
                  transform: `scale(${1 + micLevel * 0.6})`,
                  opacity: 0.25 + micLevel * 0.5,
                  transition: "transform 90ms ease-out, opacity 90ms ease-out",
                }}
              />
            )}
            <div
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
                recState === "recording"
                  ? "bg-green-50 text-green-600"
                  : "bg-purple-50 text-purple-600"
              }`}
              style={
                recState === "recording"
                  ? { boxShadow: `0 0 ${8 + micLevel * 28}px rgba(34,197,94,${0.25 + micLevel * 0.5})` }
                  : undefined
              }
            >
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                <path
                  d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v3M8.5 21h7"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {recState === "idle" && (
            <p className="text-xs text-gray-500 text-center">
              Maximum recording length is{" "}
              <span className="font-medium text-gray-700 tabular-nums">
                {formatTime(MAX_SECONDS)}
              </span>
              .
            </p>
          )}

          {recState === "recording" && (
            <>
              <p className="text-sm font-medium text-gray-700 tabular-nums">
                {formatTime(elapsed)}
                <span className="text-gray-400"> / {formatTime(MAX_SECONDS)}</span>
              </p>
              {analyser && (
                <div className="w-64 max-w-full px-3 py-2 overflow-hidden">
                  <WaveformRecorder analyser={analyser} onLevel={setMicLevel} />
                </div>
              )}

              {/* Previous voiceover length reference — flags when the recording
                  exceeds the scene's current voiceover. */}
              {prevDuration > 0 && (
                <p
                  className={`text-xs text-center tabular-nums ${
                    elapsed > prevDuration ? "text-amber-600 font-medium" : "text-gray-400"
                  }`}
                >
                  Current voiceover: {formatTime(prevDuration)}
                  {elapsed > prevDuration && " — you're now exceeding it"}
                </p>
              )}

              {/* Time-remaining warning past the warn threshold. */}
              {elapsed >= WARN_SECONDS && (
                <p className="text-xs text-center font-medium text-red-600">
                  {MAX_SECONDS - elapsed > 0
                    ? `${MAX_SECONDS - elapsed}s remaining — recording will stop at ${formatTime(
                        MAX_SECONDS
                      )}`
                    : "Maximum length reached"}
                </p>
              )}
            </>
          )}

          {recState === "recorded" && previewUrl && (
            <audio
              ref={audioElRef}
              controls
              src={previewUrl}
              className="w-full h-9"
              preload="metadata"
            />
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 w-full justify-center pt-1">
            {recState === "idle" && (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                Start recording
              </button>
            )}

            {recState === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                Done
              </button>
            )}

            {recState === "recorded" && (
              <>
                <button
                  type="button"
                  onClick={reRecord}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors"
                >
                  Re-record
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
                >
                  Apply
                </button>
              </>
            )}
          </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
