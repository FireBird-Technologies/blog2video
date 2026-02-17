import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  getProject,
  startGeneration,
  getPipelineStatus,
  renderVideo,
  getRenderStatus,
  downloadVideo,
  fetchVideoBlob,
  downloadStudioZip,
  launchStudio,
  toggleAssetExclusion,
  uploadProjectDocuments,
  reorderScenes,
  Project,
  Scene,
  BACKEND_URL,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneEditModal, { SceneImageItem } from "../components/SceneEditModal";
import ChatPanel from "../components/ChatPanel";
import UpgradeModal from "../components/UpgradeModal";
import VideoPreview from "../components/VideoPreview";
import { getPendingUpload } from "../stores/pendingUpload";

type Tab = "script" | "scenes" | "images" | "audio";

const PIPELINE_STEPS_URL = [
  { id: 1, label: "Scraping" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
] as const;

const PIPELINE_STEPS_UPLOAD = [
  { id: 1, label: "Uploading" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
] as const;

// ─── URL Helpers ─────────────────────────────────────────────

/**
 * Resolve the best URL for an asset: R2 URL if available, else local media path.
 */
function resolveAssetUrl(asset: { r2_url: string | null; filename: string; asset_type: string }, projectId: number): string {
  // In local dev, prefer local media files over R2 URLs
  const isLocalDev = !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');
  
  if (!isLocalDev && asset.r2_url) return asset.r2_url;
  
  const subdir = asset.asset_type === "image" ? "images" : "audio";
  const localPath = `/media/projects/${projectId}/${subdir}/${asset.filename}`;
  
  // Use relative URL in local dev (goes through Vite proxy), absolute in production
  return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
}

/**
 * Resolve the video URL: R2 URL if available, else local media path.
 */
function resolveVideoUrl(project: Project): string | null {
  if (project.status !== "done") return null;
  if (project.r2_video_url) return project.r2_video_url;
  return `${BACKEND_URL}/media/projects/${project.id}/output/video.mp4`;
}

/**
 * Extract audio filename from voiceover_path to handle reordering correctly.
 * Returns filename like "scene_1.mp3" or null if not found.
 * Handles Windows paths with mixed separators like "C:\...\projects/6/audio\scene_3.mp3"
 */
function extractAudioFilename(voiceoverPath: string | null): string | null {
  if (!voiceoverPath) return null;
  
  // Split by both forward and backward slashes, find the part that matches scene_X.mp3
  const pathParts = voiceoverPath.split(/[/\\]/);
  const filename = pathParts.find(part => part.startsWith('scene_') && part.endsWith('.mp3'));
  
  return filename || null;
}

// ─── Audio Player Row ────────────────────────────────────────
function AudioRow({
  scene,
  projectId,
  audioAssets,
}: {
  scene: Scene;
  projectId: number;
  audioAssets: import("../api/client").Asset[];
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Extract audio filename from voiceover_path to handle reordering correctly
  const audioFilename = extractAudioFilename(scene.voiceover_path) || `scene_${scene.order}.mp3`;
  
  // Find the matching audio asset by extracted filename (not by current order)
  const matchingAudioAsset = audioAssets.find(
    (a) => a.filename === audioFilename
  );
  const audioUrl = matchingAudioAsset
    ? resolveAssetUrl(matchingAudioAsset, projectId)
    : scene.voiceover_path
    ? (() => {
        const isLocalDev = !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');
        const localPath = `/media/projects/${projectId}/audio/${audioFilename}`;
        return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
      })()
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isPro = user?.plan === "pro";

  const [project, setProject] = useState<Project | null>(null);
  const hasStudioAccess = isPro || (project?.studio_unlocked ?? false);
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload-based project detection
  const isUploadProject = project?.blog_url?.startsWith("upload://") ?? false;
  const PIPELINE_STEPS = isUploadProject ? PIPELINE_STEPS_UPLOAD : PIPELINE_STEPS_URL;

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationStarted = useRef(false);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false); // "Saving to cloud" after render completes
  const [rendered, setRendered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingStudio, setDownloadingStudio] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderFrames, setRenderFrames] = useState({ rendered: 0, total: 0 });
  const [renderTimeLeft, setRenderTimeLeft] = useState<string | null>(null);
  const renderPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderRetryCountRef = useRef(0); // how many times we've auto-retried render
  const MAX_RENDER_RETRIES = 20;

  // Auto-download trigger (only when render finishes during this session)
  const autoDownloadRef = useRef(false);

  // Smooth pipeline progress: gradually fills between discrete step updates
  const [smoothProgress, setSmoothProgress] = useState(0);
  const smoothProgressRef = useRef(0);

  useEffect(() => {
    if (!pipelineRunning) {
      setSmoothProgress(0);
      smoothProgressRef.current = 0;
      return;
    }

    // Target progress based on step (evenly spaced across 0-95%)
    const stepTargets: Record<number, number> = { 0: 3, 1: 20, 2: 48, 3: 72, 4: 100 };
    const target = stepTargets[pipelineStep] ?? 100;

    // Animate towards target in small increments
    const timer = setInterval(() => {
      smoothProgressRef.current = Math.min(
        smoothProgressRef.current + 0.4,
        target
      );
      setSmoothProgress(Math.round(smoothProgressRef.current));
    }, 150);

    return () => clearInterval(timer);
  }, [pipelineRunning, pipelineStep]);

  // Upgrade modal
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareAnchorRef = useRef<HTMLDivElement>(null);

  // Scenes tab: expanded scene detail, edit modal, drag reorder
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [sceneEditModal, setSceneEditModal] = useState<Scene | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<number | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<number | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Images tab: toggling exclusion
  const [togglingAsset, setTogglingAsset] = useState<number | null>(null);

  // Video blob URL for playback (fetched via backend to avoid CORS, loads completely)
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Fetch video as blob when project is done — ensures full load, no CORS
  useEffect(() => {
    if (project?.status !== "done" || !projectId) {
      if (videoBlobUrl) {
        window.URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(null);
      }
      return;
    }
    let revoked = false;
    setVideoLoading(true);
    fetchVideoBlob(projectId)
      .then((url) => {
        if (!revoked) {
          setVideoBlobUrl(url);
        } else {
          window.URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!revoked) setVideoBlobUrl(null);
      })
      .finally(() => {
        if (!revoked) setVideoLoading(false);
      });
    return () => {
      revoked = true;
    };
  }, [project?.status, projectId]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoBlobUrl) {
        window.URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);

  // Auto-download once render finishes (with retry in case R2 upload is still in progress)
  useEffect(() => {
    if (!autoDownloadRef.current || !rendered || !project || downloading) return;
    autoDownloadRef.current = false;

    const safeName =
      project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";

    let attempts = 0;
    const maxAttempts = 6; // ~12 seconds of retrying

    const tryDownload = async () => {
      while (attempts < maxAttempts) {
        try {
          await downloadVideo(projectId, `${safeName}.mp4`);
          return; // success
        } catch {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000));
            // Refresh project to pick up r2_video_url
            await loadProject();
          }
        }
      }
    };
    tryDownload();
  }, [rendered]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = useCallback(async () => {
    try {
      const res = await getProject(projectId);
      setProject(res.data);
      setError(null); // clear any previous load errors on success
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

  // Handle ?purchased=true redirect from Stripe per-video checkout
  useEffect(() => {
    if (searchParams.get("purchased") === "true") {
      // Clear the query param and refresh project to pick up studio_unlocked
      setSearchParams({}, { replace: true });
      loadProject();
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start generation when project loads and isn't complete
  useEffect(() => {
    const init = async () => {
      const proj = await loadProject();
      if (!proj || generationStarted.current) return;

      // Check for pending document upload (from Dashboard upload flow)
      const pendingFiles = getPendingUpload(projectId);
      if (pendingFiles && pendingFiles.length > 0 && proj.status === "created") {
        generationStarted.current = true;
        setPipelineRunning(true);
        setPipelineStep(1); // "Uploading" step
        setError(null);
        try {
          await uploadProjectDocuments(projectId, pendingFiles);
          // Reload project (status is now SCRAPED)
          await loadProject();
          // Now kick off the generation pipeline (starts at script step)
          await startGeneration(projectId);
          startPolling();
        } catch (err: any) {
          setError(
            err?.response?.data?.detail || "Failed to upload documents."
          );
          setPipelineRunning(false);
        }
        return;
      }

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
        const { step, running, error: pipelineError, status } = res.data;

        setPipelineStep(step);

        if (pipelineError) {
          setError(pipelineError);
          setPipelineRunning(false);
          stopPolling();
          await loadProject();
          return;
        }

        // Backend says pipeline is done — but verify the project status.
        // On Cloud Run, the in-memory progress dict can be lost if a new
        // container handles the poll.  If the project is still mid-generation,
        // keep the loader visible and keep polling.
        if (!running) {
          const stillGenerating = ["created", "scraped", "scripted"].includes(
            status
          );
          if (stillGenerating) {
            // Progress was lost (container restart / cold start).
            // Keep polling — the pipeline task is still running on the
            // original instance or will be retried.
            await loadProject();
            return;
          }
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

  // Track highest-seen render progress so we never go backward
  const renderHighWaterRef = useRef(0);

  // Resolution is always 1080p
  const RENDER_RESOLUTION = "1080p";

  const handleRender = async () => {
    // If already rendered and available in R2, skip straight to download
    if (project?.r2_video_url) {
      setRendered(true);
      setRendering(false);
      return;
    }

    const res = RENDER_RESOLUTION;
    setRendering(true);
    setRenderProgress(0);
    setRenderFrames({ rendered: 0, total: 0 });
    setRenderTimeLeft(null);
    setError(null);
    renderHighWaterRef.current = 0;
    renderRetryCountRef.current = 0;

    const startRenderAndPoll = async (res: string) => {
      try {
        await renderVideo(projectId, res);
      } catch (err: any) {
        // If this is a retry, keep going; otherwise show error
        if (renderRetryCountRef.current >= MAX_RENDER_RETRIES) {
          setError(
            err?.response?.data?.detail || "Render failed after multiple attempts."
          );
          setRendering(false);
          return;
        }
      }

      stopRenderPolling();
      renderPollingRef.current = setInterval(async () => {
        try {
          const status = await getRenderStatus(projectId);
          const {
            progress,
            rendered_frames,
            total_frames,
            done,
            error: renderErr,
            time_remaining,
          } = status.data;

          // Never go backward — only update if progress moved forward
          if (progress >= renderHighWaterRef.current) {
            renderHighWaterRef.current = progress;
            setRenderProgress(progress);
          }
          if (rendered_frames > 0) {
            setRenderFrames({ rendered: rendered_frames, total: total_frames });
          }
          if (time_remaining) setRenderTimeLeft(time_remaining);

          if (renderErr) {
            // Auto-retry: re-trigger render instead of stopping
            if (renderRetryCountRef.current < MAX_RENDER_RETRIES) {
              renderRetryCountRef.current++;
              console.log(
                `[RENDER] Error "${renderErr}", auto-retrying (${renderRetryCountRef.current}/${MAX_RENDER_RETRIES})...`
              );
              stopRenderPolling();
              // Keep the current progress visible — user shouldn't see a reset
              // Small delay before retrying
              await new Promise((r) => setTimeout(r, 3000));
              startRenderAndPoll(res);
            } else {
              setError(`${renderErr} (after ${MAX_RENDER_RETRIES} retries)`);
              setRendering(false);
              stopRenderPolling();
            }
            return;
          }

          // Transition to saving screen when:
          // - backend says done (render + R2 upload complete), OR
          // - all frames rendered (100% / frames match) — encoding + R2 still in progress
          const allFramesRendered =
            progress >= 100 && total_frames > 0 && rendered_frames >= total_frames;

          if (done || allFramesRendered) {
            setRenderProgress(100);
            stopRenderPolling();

            // Transition: rendering → saving (encoding + uploading to cloud)
            setRendering(false);
            setSaving(true);

            // Stay on saving screen until Cloudflare R2 confirms the video URL
            const maxWait = 120; // max 120 attempts (~240s)
            for (let i = 0; i < maxWait; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const fresh = await loadProject();
              if (fresh?.r2_video_url) break;
              // Local-only fallback (no R2 configured)
              if (fresh?.status === "done" && !fresh?.r2_video_url && i >= 2) break;
            }

            // Transition: saving → done (green download button + auto-download)
            setSaving(false);
            setRendered(true);
            autoDownloadRef.current = true;

            // Also open the video URL directly in a new tab as a fallback
            // in case the blob download is blocked by popup settings
            const freshProject = await loadProject();
            const directUrl = freshProject?.r2_video_url;
            if (directUrl) {
              window.open(directUrl, "_blank", "noopener,noreferrer");
            }
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, 10_000); // Poll every 10 seconds
    };

    startRenderAndPoll(res);
  };

  const handleDownload = async () => {
    if (!project) return;
    setDownloading(true);
    setError(null);
    const safeName =
      project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";

    // Retry a few times in case R2 upload is still finishing
    let attempts = 0;
    const maxAttempts = 4;
    while (attempts < maxAttempts) {
      try {
        await downloadVideo(projectId, `${safeName}.mp4`);
        setDownloading(false);
        return;
      } catch (err: any) {
        attempts++;
        const status = err?.response?.status;
        // 202 = still processing, 404 = not ready yet — retry
        if ((status === 202 || status === 404) && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          await loadProject();
          continue;
        }
        setError(err?.response?.data?.detail || "Download failed.");
        break;
      }
    }
    setDownloading(false);
  };

  const handleOpenStudio = async () => {
    if (!project) return;
    setDownloadingStudio(true);
    setError(null);
    try {
      const res = await launchStudio(projectId);
      const url = res.data.studio_url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgrade(true);
      } else {
        setError(err?.response?.data?.detail || "Failed to launch Studio.");
      }
    } finally {
      setDownloadingStudio(false);
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

  const handleToggleExclusion = async (assetId: number) => {
    if (!project || !isPro) return;
    setTogglingAsset(assetId);
    try {
      const res = await toggleAssetExclusion(projectId, assetId);
      // Update local state
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === assetId ? { ...a, excluded: res.data.excluded } : a
          ),
        };
      });
    } catch {
      // Silently fail
    } finally {
      setTogglingAsset(null);
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
    { id: "images", label: "Images" },
    ...(project.voice_gender !== "none" ? [{ id: "audio" as Tab, label: "Audio" }] : []),
    { id: "scenes", label: "Scenes" },
  ];

  const pipelineComplete = ["generated", "rendering", "done"].includes(
    project.status
  );

  // ─── Distribute blog images across scenes (match VideoPreview logic) ────────────────
  const imageAssets = project.assets.filter((a) => a.asset_type === "image");
  const activeImageAssets = imageAssets.filter((a) => !a.excluded);
  const sceneImageMap: Record<number, string[]> = {};
  const sceneImageAssetsMap: Record<number, SceneImageItem[]> = {};
  if (project.scenes.length > 0 && activeImageAssets.length > 0) {
    project.scenes.forEach((_, idx) => {
      sceneImageMap[idx] = [];
      sceneImageAssetsMap[idx] = [];
    });

    // 1) Scene-specific images: filename "scene_<sceneId>_<timestamp>.*" (from AI edit upload)
    const sceneSpecific: { sceneId: number; url: string; asset: (typeof activeImageAssets)[0] }[] = [];
    const genericAssets: typeof activeImageAssets = [];
    for (const asset of activeImageAssets) {
      const match = asset.filename.match(/^scene_(\d+)_/);
      if (match) {
        const sceneId = parseInt(match[1], 10);
        sceneSpecific.push({
          sceneId,
          url: resolveAssetUrl(asset, project.id),
          asset,
        });
      } else {
        genericAssets.push(asset);
      }
    }
    for (const { sceneId, url, asset } of sceneSpecific) {
      const sceneIdx = project.scenes.findIndex((s) => s.id === sceneId);
      if (sceneIdx >= 0) {
        sceneImageMap[sceneIdx].push(url);
        sceneImageAssetsMap[sceneIdx].push({ url, asset });
      }
    }

    // 2) Generic images: assign in order to scenes that don't have one yet
    let genericIdx = 0;
    for (let sceneIdx = 0; sceneIdx < project.scenes.length && genericIdx < genericAssets.length; sceneIdx++) {
      if (sceneImageMap[sceneIdx].length === 0) {
        const asset = genericAssets[genericIdx];
        const url = resolveAssetUrl(asset, project.id);
        sceneImageMap[sceneIdx].push(url);
        sceneImageAssetsMap[sceneIdx].push({ url, asset });
        genericIdx++;
      }
    }
  }

  // Audio assets for R2 URL resolution
  const audioAssets = project.assets.filter((a) => a.asset_type === "audio");

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
    const progress = smoothProgress;

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
                        : "bg-gray-100 text-gray-400"
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
                    className={`text-xs font-medium ${
                      isDone
                        ? "text-green-600"
                        : isActive
                        ? "text-purple-600"
                        : "text-gray-400"
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
    return (
      <div className="space-y-4">
        {/* ── Phase 1: Rendering progress ── */}
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
                Creating your video
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                {renderFrames.total > 0
                  ? `Frame ${renderFrames.rendered.toLocaleString()} of ${renderFrames.total.toLocaleString()}`
                  : "Preparing..."}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
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

              <p className="mt-6 text-sm text-gray-400">
                Feel free to browse other tabs — just don't close this one.
              </p>

              {error && (
                <div className="mt-4">
                  <p className="text-xs text-red-500 mb-3">{error}</p>
                  <button
                    onClick={() => handleRender()}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phase 2: Saving to cloud ── */}
        {saving && !rendering && (
          <div
            className="glass-card flex items-center justify-center"
            style={{ minHeight: "60vh" }}
          >
            <div className="w-full max-w-sm text-center px-6 py-12">
              <div className="w-14 h-14 mx-auto mb-6 bg-green-600 rounded-2xl flex items-center justify-center">
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Finalizing your video
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                Encoding &amp; uploading to cloud...
              </p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>

              <div className="flex items-center justify-center text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                  Almost done
                </span>
              </div>

              <p className="mt-6 text-sm text-gray-400">
                Hang tight — your download will start automatically.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                If your download doesn't start, allow popups for this site.
              </p>
            </div>
          </div>
        )}

        {/* Main content (hidden while rendering or saving to cloud) */}
        {!rendering && !saving && (
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
                {/* Open Studio — Pro or per-video paid (download workspace zip) */}
                {hasStudioAccess ? (
                  <button
                    onClick={handleOpenStudio}
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
                    title="Unlock Studio with per-video or Pro plan"
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
                  </button>
                )}

                {/* Download MP4 */}
                {!rendered ? (
                  <button
                    onClick={() => { setError(null); handleRender(); }}
                    className={`px-4 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      error
                        ? "bg-orange-500 hover:bg-orange-600"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
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
                        d={error
                          ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          : "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        }
                      />
                    </svg>
                    {error ? "Resume Download" : "Download MP4"}
                  </button>
                ) : (
                  <>
                    {/* Download MP4 */}
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
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download MP4
                        </>
                      )}
                    </button>

                    {/* Share button — inline next to Download */}
                    {project.r2_video_url && (
                      <div className="relative" ref={shareAnchorRef}>
                        <button
                          onClick={() => setShowShareMenu((v) => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Video player area + Chat */}
            <div className="flex flex-1 min-h-0">
              {/* Video preview — always shows live preview when scenes exist */}
              <div className="flex-1 flex flex-col min-w-0 bg-black/[0.02]">
                {project.scenes.length > 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
                    <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-lg border border-gray-200/40">
                      <VideoPreview project={project} />
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Live preview · {project.scenes.length} scenes
                      {totalAudioDuration > 0 &&
                        ` · ${Math.round(totalAudioDuration)}s`}
                    </p>
                    {imageAssets.some((a) => /\.gif(\?.*)?$/i.test(a.filename)) && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        GIF images detected — animation may vary in the final render
                      </p>
                    )}
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
        projectId={projectId}
        onPurchased={() => loadProject()}
      />

      {/* Share dropdown — rendered outside glass-card to avoid overflow/backdrop-filter clipping */}
      {showShareMenu && project?.r2_video_url && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowShareMenu(false)} />
          <div
            className="fixed z-[9999] bg-white rounded-xl shadow-lg border border-gray-200/60 p-1.5 flex gap-1"
            style={(() => {
              const rect = shareAnchorRef.current?.getBoundingClientRect();
              if (!rect) return {};
              return { top: rect.top - 48, left: rect.right - 130 };
            })()}
          >
            {/* TikTok */}
            <button
              onClick={() => { navigator.clipboard.writeText(project.r2_video_url!); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-black/5 flex items-center justify-center transition-colors"
              title="Copy link for TikTok"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1.59-.27 4.83 4.83 0 01-1.41-.82V6.69h3z" />
              </svg>
            </button>
            {/* YouTube */}
            <button
              onClick={() => { navigator.clipboard.writeText(project.r2_video_url!); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors"
              title="Copy link for YouTube"
            >
              <svg className="w-4 h-4 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </button>
            {/* Facebook */}
            <button
              onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(project.r2_video_url!)}`, "_blank"); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Share on Facebook"
            >
              <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </button>
          </div>
        </>
      )}

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
              {project.blog_url && !project.blog_url.startsWith("upload://") ? (
                <a
                  href={project.blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
                >
                  {project.blog_url}
                </a>
              ) : (
                <span className="text-xs text-gray-400">
                  {project.blog_url?.startsWith("upload://")
                    ? "Created from uploaded documents"
                    : ""}
                </span>
              )}
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
                    {project.scenes.length} scenes — {imageAssets.length} images. Drag to reorder.
                  </span>
                </div>

                <div className="relative">
                  {reorderSaving && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                      <div className="w-10 h-10 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <p className="mt-3 text-sm font-medium text-gray-700">Saving order…</p>
                    </div>
                  )}
                  <div className="space-y-2">
                  {project.scenes.map((scene, idx) => {
                    const isExpanded = expandedScene === scene.id;
                    const sceneImages = sceneImageMap[idx] || [];
                    // Extract audio filename from voiceover_path to handle reordering correctly
                    const audioFilename = extractAudioFilename(scene.voiceover_path) || `scene_${scene.order}.mp3`;
                    const matchingAudio = audioAssets.find(
                      (a) => a.filename === audioFilename
                    );
                    const audioUrl = matchingAudio
                      ? resolveAssetUrl(matchingAudio, project.id)
                      : scene.voiceover_path
                      ? (() => {
                          const isLocalDev = !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');
                          const localPath = `/media/projects/${project.id}/audio/${audioFilename}`;
                          return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
                        })()
                      : null;
                    const isDragging = draggedSceneId === scene.id;
                    const isDropTarget = dragOverSceneId === scene.id && !isDragging;

                    return (
                      <div
                        key={scene.id}
                        data-scene-row
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverSceneId(scene.id);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverSceneId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSceneId(null);
                          const sourceId = Number(e.dataTransfer.getData("text/plain"));
                          if (!sourceId || sourceId === scene.id) return;
                          const fromIdx = project.scenes.findIndex((s) => s.id === sourceId);
                          const toIdx = project.scenes.findIndex((s) => s.id === scene.id);
                          if (fromIdx < 0 || toIdx < 0) return;
                          const reordered = [...project.scenes];
                          const [removed] = reordered.splice(fromIdx, 1);
                          reordered.splice(toIdx, 0, removed);
                          setReorderSaving(true);
                          reorderScenes(
                            project.id,
                            reordered.map((s, i) => ({ scene_id: s.id, order: i + 1 }))
                          )
                            .then(() => loadProject())
                            .finally(() => setReorderSaving(false));
                        }}
                        className={`transition-all duration-150 ${isDragging ? "opacity-40 scale-[0.98]" : ""} ${isDropTarget ? "ring-2 ring-purple-400 ring-inset rounded-lg" : ""}`}
                      >
                        <div className="flex items-stretch gap-0">
                          {/* Drag handle — only this area starts the drag */}
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDraggedSceneId(scene.id);
                              e.dataTransfer.setData("text/plain", String(scene.id));
                              e.dataTransfer.effectAllowed = "move";
                              const row = (e.currentTarget as HTMLElement).closest("[data-scene-row]");
                              if (row) {
                                const rect = row.getBoundingClientRect();
                                e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedSceneId(null);
                              setDragOverSceneId(null);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-10 flex-shrink-0 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100 select-none touch-none"
                            title="Drag to reorder"
                          >
                            <svg className="w-5 h-5 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Clickable scene header */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedScene(isExpanded ? null : scene.id)
                              }
                              className="w-full text-left glass-card p-4 border-l-2 border-l-purple-200 hover:border-l-purple-400 transition-all rounded-r-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                                  {scene.order}
                                </span>
                                <h3 className="text-sm font-medium text-gray-900 flex-1 truncate">
                                  {scene.title}
                                </h3>

                                {/* Edit icon — opens modal */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSceneEditModal(scene);
                                  }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
                                  title="Edit scene"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>

                                {/* Status pills */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      scene.remotion_code
                                        ? "bg-green-50 text-green-600"
                                        : "bg-gray-50 text-gray-300"
                                    }`}
                                  >
                                    Scene
                                  </span>
                                  {project.voice_gender !== "none" && (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                        scene.voiceover_path
                                          ? "bg-green-50 text-green-600"
                                          : "bg-gray-50 text-gray-300"
                                      }`}
                                    >
                                      Audio
                                    </span>
                                  )}
                                  <span className="text-[11px] text-gray-300 ml-1">
                                    {scene.duration_seconds}s
                                  </span>

                                  {/* Expand chevron */}
                                  <svg
                                    className={`w-4 h-4 text-gray-300 transition-transform ml-1 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </button>

                            {/* Expanded scene detail */}
                            {isExpanded && (
                              <div className="ml-4 mt-1 glass-card p-5 border-l-2 border-l-purple-100 space-y-4 rounded-r-lg border border-t-0">
                                {/* Narration */}
                                <div>
                                  <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                    Narration
                                  </h4>
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {scene.narration_text || (
                                      <span className="italic text-gray-300">
                                        No narration
                                      </span>
                                    )}
                                  </p>
                                </div>

                                {/* Visual Description */}
                                <div>
                                  <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                    Visual Description
                                  </h4>
                                  <p className="text-xs text-gray-500 italic leading-relaxed">
                                    {scene.visual_description || "—"}
                                  </p>
                                </div>

                                {/* Layout (from remotion_code JSON) */}
                                {scene.remotion_code && (() => {
                                  try {
                                    const desc = JSON.parse(scene.remotion_code);
                                    return (
                                      <div>
                                        <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                          Layout
                                        </h4>
                                        <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                                          {desc.layout?.replace(/_/g, " ") || "text narration"}
                                        </span>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}

                                {/* Audio player (inline) — hidden when no voiceover */}
                                {project.voice_gender !== "none" && audioUrl && (
                                  <div>
                                    <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                      Audio
                                    </h4>
                                    <audio
                                      controls
                                      src={audioUrl}
                                      preload="metadata"
                                      className="w-full h-8"
                                      style={{ maxWidth: 400 }}
                                    />
                                  </div>
                                )}

                                {/* Scene images */}
                                {sceneImages.length > 0 && (
                                  <div>
                                    <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                      Images ({sceneImages.length})
                                    </h4>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {sceneImages.map((src, i) => (
                                        <img
                                          key={i}
                                          src={src}
                                          alt={`Scene ${scene.order} image ${i + 1}`}
                                          className="h-24 w-auto rounded-lg object-cover border border-gray-200/40 flex-shrink-0"
                                          loading="lazy"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Scene edit modal */}
                {sceneEditModal && (
                  <SceneEditModal
                    open={!!sceneEditModal}
                    onClose={() => setSceneEditModal(null)}
                    scene={sceneEditModal}
                    project={project}
                    imageItems={sceneImageAssetsMap[project.scenes.findIndex((s) => s.id === sceneEditModal.id)] || []}
                    onSaved={loadProject}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "images" && (
          <div>
            {imageAssets.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Images will appear here once scraped.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-base font-medium text-gray-900">
                      Blog Images
                    </h2>
                    <span className="text-xs text-gray-400">
                      {imageAssets.filter((a) => !a.excluded).length} active
                      {imageAssets.some((a) => a.excluded) &&
                        ` / ${imageAssets.filter((a) => a.excluded).length} excluded`}
                    </span>
                  </div>
                  {!isPro && (
                    <span className="text-[10px] text-gray-300 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
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
                      Pro — exclude images
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageAssets.map((asset) => {
                    const url = resolveAssetUrl(asset, project.id);
                    const isToggling = togglingAsset === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className={`relative group rounded-xl overflow-hidden border transition-all ${
                          asset.excluded
                            ? "border-red-200 opacity-50"
                            : "border-gray-200/40 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={url}
                          alt={asset.filename}
                          className="w-full aspect-[4/3] object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'><rect fill='%23f3f4f6' width='200' height='150'/><text x='50%25' y='50%25' fill='%239ca3af' font-size='12' text-anchor='middle' dy='.3em'>No preview</text></svg>";
                          }}
                        />

                        {/* Excluded overlay */}
                        {asset.excluded && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Info bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 pt-6">
                          <p className="text-[10px] text-white/80 truncate">
                            {asset.filename}
                          </p>
                        </div>

                        {/* Toggle exclude button (Pro only) */}
                        {isPro && (
                          <button
                            onClick={() => handleToggleExclusion(asset.id)}
                            disabled={isToggling}
                            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              asset.excluded
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-white/80 text-gray-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100"
                            } ${isToggling ? "animate-pulse" : ""}`}
                            title={
                              asset.excluded
                                ? "Include this image"
                                : "Exclude this image"
                            }
                          >
                            {isToggling ? (
                              <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            ) : asset.excluded ? (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
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
                                  strokeWidth={2.5}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
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
                      audioAssets={audioAssets}
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
