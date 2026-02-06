import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getProject,
  scrapeProject,
  generateScript,
  generateScenes,
  launchStudio,
  renderVideo,
  downloadVideo,
  Project,
} from "../api/client";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneCard from "../components/SceneCard";
import ChatPanel from "../components/ChatPanel";

type Tab = "script" | "scenes" | "editor";

const PIPELINE_STEPS = [
  { id: 1, label: "Scraping" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
  { id: 4, label: "Studio" },
] as const;

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const [loading, setLoading] = useState(true);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const pipelineAbort = useRef(false);

  // Scene pagination
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const res = await getProject(projectId);
      setProject(res.data);
      if (res.data.studio_port) {
        setStudioUrl(`http://localhost:${res.data.studio_port}`);
      }
      if (res.data.status === "done") {
        setRendered(true);
      }
    } catch {
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Keyboard nav for scenes
  useEffect(() => {
    if (activeTab !== "scenes" || !project?.scenes.length) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveSceneIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setActiveSceneIndex((i) =>
          Math.min(project.scenes.length - 1, i + 1)
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, project?.scenes.length]);

  const getStartStep = (status: string): number => {
    switch (status) {
      case "created": return 1;
      case "scraped": return 2;
      case "scripted": return 3;
      default: return 0;
    }
  };

  const getCompletedStep = (status: string): number => {
    switch (status) {
      case "scraped": return 1;
      case "scripted": return 2;
      case "generated":
      case "rendering":
      case "done": return 4;
      default: return 0;
    }
  };

  const handleGenerateVideo = async () => {
    if (!project) return;
    setPipelineRunning(true);
    setError(null);
    pipelineAbort.current = false;

    const startStep = getStartStep(project.status);
    if (startStep === 0) return;

    try {
      if (startStep <= 1) {
        setPipelineStep(1);
        await scrapeProject(projectId);
        if (pipelineAbort.current) return;
        await loadProject();
      }

      if (startStep <= 2) {
        setPipelineStep(2);
        await generateScript(projectId);
        if (pipelineAbort.current) return;
        await loadProject();
      }

      if (startStep <= 3) {
        setPipelineStep(3);
        await generateScenes(projectId);
        if (pipelineAbort.current) return;
        await loadProject();
      }

      // Auto-launch studio
      setPipelineStep(4);
      const res = await launchStudio(projectId);
      setStudioUrl(res.data.studio_url);
      await loadProject();

      setPipelineStep(5);
      setActiveTab("editor");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Generation failed. Please try again."
      );
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleRender = async () => {
    setRendering(true);
    setError(null);
    try {
      await renderVideo(projectId);
      setRendered(true);
      await loadProject();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Render failed. Please try again."
      );
    } finally {
      setRendering(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;
    setDownloading(true);
    try {
      const safeName = project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";
      await downloadVideo(projectId, `${safeName}.mp4`);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Download failed."
      );
    } finally {
      setDownloading(false);
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
    { id: "editor", label: "Editor" },
  ];

  const pipelineNotStarted = ["created", "scraped", "scripted"].includes(
    project.status
  );
  const pipelineComplete = ["generated", "rendering", "done"].includes(
    project.status
  );
  const completedStep =
    pipelineStep >= 5 ? 4 : getCompletedStep(project.status);

  // ─── Full-screen generation loader ───────────────────────
  if (pipelineRunning) {
    const stepLabels = PIPELINE_STEPS.map((s) => s.label);
    const currentStepIdx = pipelineStep - 1; // 0-based
    const progress = Math.min(((pipelineStep - 1) / PIPELINE_STEPS.length) * 100 + 12, 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md">
        <div className="w-full max-w-md text-center px-6">
          {/* Animated logo */}
          <div className="w-14 h-14 mx-auto mb-8 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm animate-pulse">
            B2V
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Generating your video
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            {project.name}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
            <div
              className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between mb-8">
            {stepLabels.map((label, i) => {
              const isActive = i === currentStepIdx;
              const isDone = i < currentStepIdx || pipelineStep > PIPELINE_STEPS.length;
              return (
                <div key={label} className="flex flex-col items-center gap-2">
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

          {/* Current action */}
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
                onClick={handleGenerateVideo}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
            {/* Generate / Resume button */}
            {pipelineNotStarted && (
              <button
                onClick={handleGenerateVideo}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {getStartStep(project.status) === 1
                  ? "Generate Video"
                  : "Resume"}
              </button>
            )}

            {/* Retry on error */}
            {!pipelineRunning && error && pipelineStep > 0 && pipelineStep < 5 && (
              <button
                onClick={handleGenerateVideo}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            )}

            {/* Render / Download buttons */}
            {pipelineComplete && (
              <>
                {!rendered ? (
                  <button
                    onClick={handleRender}
                    disabled={rendering}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {rendering ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Rendering...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Render MP4
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {downloading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress dots (only when not running -- the full-screen loader handles running state) */}
        {pipelineComplete && (
          <div className="flex items-center gap-2 mt-4">
            {PIPELINE_STEPS.map((step) => (
              <div key={step.id} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[11px] text-green-600">{step.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}
      </div>

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
                No scenes yet. Click "Generate Video" above.
              </p>
            ) : (
              <div className="space-y-4">
                <SceneCard scene={project.scenes[activeSceneIndex]} />

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() =>
                      setActiveSceneIndex((i) => Math.max(0, i - 1))
                    }
                    disabled={activeSceneIndex === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-400">
                    {activeSceneIndex + 1} of {project.scenes.length}
                  </span>
                  <button
                    onClick={() =>
                      setActiveSceneIndex((i) =>
                        Math.min(project.scenes.length - 1, i + 1)
                      )
                    }
                    disabled={activeSceneIndex === project.scenes.length - 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "editor" && (
          <div>
            {project.scenes.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Generate a video first to use the editor.
              </p>
            ) : (
              <div className="flex gap-4 h-[650px]">
                {/* Chat side */}
                <div className="w-[380px] flex-shrink-0">
                  <ChatPanel
                    projectId={projectId}
                    onScenesUpdated={loadProject}
                  />
                </div>

                {/* Studio side */}
                <div className="flex-1 glass-card overflow-hidden flex flex-col">
                  {studioUrl ? (
                    <>
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200/30">
                        <span className="text-xs text-gray-400">Remotion Studio</span>
                        <a
                          href={studioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          Open in new tab
                        </a>
                      </div>
                      <iframe
                        src={studioUrl}
                        className="flex-1 w-full border-0"
                        title="Remotion Studio"
                        allow="autoplay"
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-gray-400">
                        {pipelineComplete
                          ? "Studio is starting..."
                          : "Generate your video to launch the studio."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
