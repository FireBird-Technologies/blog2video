import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getProject,
  startGeneration,
  getPipelineStatus,
  renderVideo,
  getRenderStatus,
  downloadVideo,
  downloadStudioZip,
  Project,
  Scene,
  BACKEND_URL,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneCard from "../components/SceneCard";
import ChatPanel from "../components/ChatPanel";
import UpgradeModal from "../components/UpgradeModal";
import VideoPreview from "../components/VideoPreview";

type Tab = "script" | "scenes" | "audio";

const PIPELINE_STEPS = [
  { id: 1, label: "Scraping" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
] as const;

// ─── Audio Player Row ────────────────────────────────────────
function AudioRow({
  scene,
  projectId,
}: {
  scene: Scene;
  projectId: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = scene.voiceover_path
    ? `${BACKEND_URL}/media/projects/${projectId}/audio/scene_${scene.order}.mp3`
    : null;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      {/* Scene number */}
      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-purple-600">
          {scene.order}
        </span>
      </div>

      {/* Play button */}
      <button
        onClick={togglePlay}
        disabled={!audioUrl}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-800 text-white"
      >
        {playing ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-900 truncate">
            {scene.title}
          </span>
          <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">
            {duration > 0
              ? `${formatTime(progress)} / ${formatTime(duration)}`
              : audioUrl
              ? "—"
              : "No audio"}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 bg-gray-100 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {audioUrl ? (
          <span className="w-2 h-2 rounded-full bg-green-400 block" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-gray-200 block" />
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user } = useAuth();
  const isPro = user?.plan === "pro";

  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationStarted = useRef(false);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingStudio, setDownloadingStudio] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderFrames, setRenderFrames] = useState({ rendered: 0, total: 0 });
  const [renderTimeLeft, setRenderTimeLeft] = useState<string | null>(null);
  const renderPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-download trigger (only when render finishes during this session)
  const autoDownloadRef = useRef(false);

  // Upgrade modal
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Auto-download once render finishes
  useEffect(() => {
    if (autoDownloadRef.current && rendered && project && !downloading) {
      autoDownloadRef.current = false;
      const safeName =
        project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";
      downloadVideo(projectId, `${safeName}.mp4`).catch(() => {});
    }
  }, [rendered]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = useCallback(async () => {
    try {
      const res = await getProject(projectId);
      setProject(res.data);
      if (res.data.status === "done") {
        setRendered(true);
      }
      return res.data;
    } catch {
      setError("Failed to load project");
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Auto-start generation when project loads and isn't complete
  useEffect(() => {
    const init = async () => {
      const proj = await loadProject();
      if (!proj || generationStarted.current) return;

      const needsGeneration = ["created", "scraped", "scripted"].includes(
        proj.status
      );
      if (needsGeneration) {
        generationStarted.current = true;
        kickOffGeneration();
      }
    };
    init();
    return () => {
      stopPolling();
      stopRenderPolling();
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kickOffGeneration = async () => {
    setPipelineRunning(true);
    setPipelineStep(0);
    setError(null);

    try {
      await startGeneration(projectId);
      startPolling();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Failed to start generation."
      );
      setPipelineRunning(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await getPipelineStatus(projectId);
        const { step, running, error: pipelineError } = res.data;

        setPipelineStep(step);

        if (pipelineError) {
          setError(pipelineError);
          setPipelineRunning(false);
          stopPolling();
          await loadProject();
          return;
        }

        if (!running) {
          setPipelineRunning(false);
          stopPolling();
          await loadProject();
          return;
        }

        await loadProject();
      } catch {
        // Network hiccup -- keep polling
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const stopRenderPolling = () => {
    if (renderPollingRef.current) {
      clearInterval(renderPollingRef.current);
      renderPollingRef.current = null;
    }
  };

  const handleRender = async () => {
    setRendering(true);
    setRenderProgress(0);
    setRenderFrames({ rendered: 0, total: 0 });
    setError(null);

    try {
      await renderVideo(projectId);

      stopRenderPolling();
      let stuckAt100Count = 0;
      renderPollingRef.current = setInterval(async () => {
        try {
          const res = await getRenderStatus(projectId);
          const {
            progress,
            rendered_frames,
            total_frames,
            done,
            error: renderErr,
            time_remaining,
          } = res.data;

          setRenderProgress(progress);
          setRenderFrames({ rendered: rendered_frames, total: total_frames });
          if (time_remaining) setRenderTimeLeft(time_remaining);

          if (renderErr) {
            setError(renderErr);
            setRendering(false);
            stopRenderPolling();
            return;
          }

          const effectivelyDone =
            done ||
            (progress >= 100 &&
              total_frames > 0 &&
              rendered_frames >= total_frames);

          if (effectivelyDone) {
            stuckAt100Count++;
          }

          if (done || stuckAt100Count >= 3) {
            setRendered(true);
            setRendering(false);
            setRenderProgress(100);
            stopRenderPolling();
            await loadProject();
            autoDownloadRef.current = true;
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, 1500);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Render failed. Please try again."
      );
      setRendering(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;
    setDownloading(true);
    try {
      const safeName =
        project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";
      await downloadVideo(projectId, `${safeName}.mp4`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadStudio = async () => {
    if (!project) return;
    setDownloadingStudio(true);
    try {
      const safeName =
        project.name?.replace(/\s+/g, "_").slice(0, 50) || "project";
      await downloadStudioZip(projectId, `${safeName}_studio.zip`);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgrade(true);
      } else {
        setError(err?.response?.data?.detail || "Studio download failed.");
      }
    } finally {
      setDownloadingStudio(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Project not found.
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "script", label: "Script" },
    { id: "scenes", label: "Scenes" },
    { id: "audio", label: "Audio" },
  ];

  const pipelineComplete = ["generated", "rendering", "done"].includes(
    project.status
  );

  // ─── Distribute blog images across scenes ────────────────
  const imageAssets = project.assets.filter((a) => a.asset_type === "image");
  const sceneImageMap: Record<number, string[]> = {};
  if (project.scenes.length > 0 && imageAssets.length > 0) {
    const heroUrl = `${BACKEND_URL}/media/projects/${project.id}/images/${imageAssets[0].filename}`;
    const remaining = imageAssets.slice(1);

    project.scenes.forEach((_, idx) => {
      sceneImageMap[idx] = [];
    });
    sceneImageMap[0].push(heroUrl);

    remaining.forEach((asset, i) => {
      const sceneIdx = i % project.scenes.length;
      sceneImageMap[sceneIdx].push(
        `${BACKEND_URL}/media/projects/${project.id}/images/${asset.filename}`
      );
    });
  }

  // Count audio scenes
  const audioScenes = project.scenes.filter((s) => s.voiceover_path);
  const totalAudioDuration = project.scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );

  // ─── Generation loader ────────────────────────────────────
  const renderGenerationLoader = () => {
    const stepLabels = PIPELINE_STEPS.map((s) => s.label);
    const currentStepIdx = Math.max(0, pipelineStep - 1);
    const progress = Math.min(
      ((pipelineStep - 1) / PIPELINE_STEPS.length) * 100 + 12,
      100
    );

    return (
      <div
        className="glass-card flex items-center justify-center"
        style={{ minHeight: "60vh" }}
      >
        <div className="w-full max-w-md text-center px-6 py-12">
          <div className="w-12 h-12 mx-auto mb-6 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xs animate-pulse">
            B2V
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Generating your video
          </h2>
          <p className="text-xs text-gray-400 mb-8">{project.name}</p>

          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
            <div
              className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between mb-8">
            {stepLabels.map((label, i) => {
              const isActive = i === currentStepIdx;
              const isDone =
                i < currentStepIdx ||
                pipelineStep > PIPELINE_STEPS.length;
              return (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      isDone
                        ? "bg-green-100 text-green-600"
                        : isActive
                        ? "bg-purple-100 text-purple-600 ring-2 ring-purple-200"
                        : "bg-gray-50 text-gray-300"
                    }`}
                  >
                    {isDone ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isDone
                        ? "text-green-600"
                        : isActive
                        ? "text-purple-600"
                        : "text-gray-300"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-400">
              {pipelineStep <= PIPELINE_STEPS.length
                ? `${PIPELINE_STEPS[currentStepIdx]?.label}...`
                : "Finishing up..."}
            </span>
          </div>

          {error && (
            <div className="mt-6">
              <p className="text-xs text-red-500 mb-3">{error}</p>
              <button
                onClick={kickOffGeneration}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Completed view (video preview + actions + chat) ──────
  const renderCompleted = () => {
    const videoSrc = rendered
      ? `${BACKEND_URL}/media/projects/${project.id}/output/video.mp4`
      : null;

    return (
      <div className="space-y-4">
        {/* Render loading overlay with progress */}
        {rendering && (
          <div
            className="glass-card flex items-center justify-center"
            style={{ minHeight: "60vh" }}
          >
            <div className="w-full max-w-md text-center px-6 py-12">
              <div className="w-14 h-14 mx-auto mb-6 bg-purple-600 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Rendering your video
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                {renderFrames.total > 0
                  ? `Frame ${renderFrames.rendered.toLocaleString()} of ${renderFrames.total.toLocaleString()}`
                  : "Preparing render..."}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>{renderProgress}%</span>
                {renderTimeLeft ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    {renderTimeLeft} remaining
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    Encoding
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-6">
                  <p className="text-xs text-red-500 mb-3">{error}</p>
                  <button
                    onClick={handleRender}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content (hidden while rendering) */}
        {!rendering && (
          <div className="glass-card overflow-hidden flex flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/30">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-gray-900">
                  {project.name}
                </h2>
                <StatusBadge status={project.status} />
              </div>
              <div className="flex items-center gap-2">
                {/* Open Studio — Pro only (download workspace zip) */}
                {isPro ? (
                  <button
                    onClick={handleDownloadStudio}
                    disabled={downloadingStudio}
                    className="px-3 py-1.5 border border-purple-200 text-purple-600 hover:bg-purple-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {downloadingStudio ? (
                      <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    )}
                    Open Studio
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Studio is a Pro feature"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Studio
                    <span className="text-[9px] bg-purple-100 text-purple-600 px-1 rounded">
                      PRO
                    </span>
                  </button>
                )}

                {/* Render / Download */}
                {!rendered ? (
                  <button
                    onClick={handleRender}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Render MP4
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {downloading ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download MP4
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Video player area + Chat */}
            <div className="flex flex-1 min-h-0">
              {/* Chat sidebar */}
              <div className="w-[380px] flex-shrink-0 border-r border-gray-200/30">
                <ChatPanel
                  projectId={projectId}
                  onScenesUpdated={loadProject}
                />
              </div>

              {/* Video preview */}
              <div className="flex-1 flex flex-col min-w-0 bg-black/[0.02]">
                {videoSrc ? (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <video
                      key={videoSrc}
                      controls
                      className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                      style={{ background: "#000" }}
                    >
                      <source src={videoSrc} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : project.scenes.length > 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
                    <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-lg border border-gray-200/40">
                      <VideoPreview project={project} />
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Live preview · {project.scenes.length} scenes
                      {totalAudioDuration > 0 &&
                        ` · ${Math.round(totalAudioDuration)}s`}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-full max-w-lg aspect-video bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-gray-900/80" />
                      <div className="relative text-center">
                        <div className="w-6 h-6 mx-auto mb-2 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                        <p className="text-xs text-white/40">
                          Generating scenes...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Remotion Studio"
      />

      {/* Upper area: loader when running, editor when complete */}
      {pipelineRunning ? (
        renderGenerationLoader()
      ) : pipelineComplete && project.scenes.length > 0 ? (
        renderCompleted()
      ) : (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold text-gray-900">
                  {project.name}
                </h1>
                <StatusBadge status={project.status} />
              </div>
              <a
                href={project.blog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
              >
                {project.blog_url}
              </a>
            </div>

            <div className="flex items-center gap-2">
              {error && (
                <button
                  onClick={kickOffGeneration}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-500">{error}</p>
          )}
        </div>
      )}

      {/* Pill tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "script" && (
          <ScriptPanel
            scenes={project.scenes}
            projectName={project.name}
          />
        )}

        {activeTab === "scenes" && (
          <div>
            {project.scenes.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Scenes will appear here once generated.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-baseline gap-4 mb-2">
                  <h2 className="text-base font-medium text-gray-900">
                    {project.name}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {project.scenes.length} scenes --{" "}
                    {imageAssets.length} images
                  </span>
                </div>

                <div className="space-y-2">
                  {project.scenes.map((scene, idx) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      images={sceneImageMap[idx] || []}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "audio" && (
          <div>
            {project.scenes.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Audio will appear here once generated.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-base font-medium text-gray-900">
                      Voiceovers
                    </h2>
                    <span className="text-xs text-gray-400">
                      {audioScenes.length} / {project.scenes.length} scenes
                      {totalAudioDuration > 0 &&
                        ` -- ${Math.round(totalAudioDuration)}s total`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      Ready
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-200" />
                      Pending
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {project.scenes.map((scene) => (
                    <AudioRow
                      key={scene.id}
                      scene={scene}
                      projectId={projectId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
