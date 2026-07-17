import { useEffect, useRef, useState } from "react";
import type { Scene } from "../api/client";

export interface RecordVoiceoverModalProps {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  /** Called with the recorded audio blob and its measured duration (seconds) on "Apply". */
  onApply: (sceneId: number, blob: Blob, durationSeconds: number) => void;
}

type RecState = "idle" | "recording" | "recorded";

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
      onLevelRef.current(level);

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
}: RecordVoiceoverModalProps) {
  const [recState, setRecState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

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
        setRecState("recorded");
        setAnalyser(null);
        cleanupStream();
      };

      recorder.start();
      startTimeRef.current = performance.now();
      mediaRecorderRef.current = recorder;
      setRecState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
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
  };

  const handleApply = () => {
    if (!blobRef.current) return;
    onApply(scene.id, blobRef.current, durationRef.current);
    onClose();
  };

  const handleClose = () => {
    stopTimer();
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
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden"
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

        <div className="p-6 flex flex-col items-center gap-3">
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

          {recState === "recording" && (
            <>
              <p className="text-sm font-medium text-gray-700 tabular-nums">
                {formatTime(elapsed)}
              </p>
              {analyser && (
                <div className="w-64 max-w-full px-3 py-2 overflow-hidden">
                  <WaveformRecorder analyser={analyser} onLevel={setMicLevel} />
                </div>
              )}
            </>
          )}

          {recState === "recorded" && previewUrl && (
            <audio
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
