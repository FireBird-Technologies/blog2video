import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getProject,
  scrapeProject,
  generateScript,
  generateScenes,
  launchStudio,
  Project,
} from "../api/client";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneCard from "../components/SceneCard";
import ChatPanel from "../components/ChatPanel";

type Tab = "script" | "scenes" | "chat" | "studio";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const res = await getProject(projectId);
      setProject(res.data);
      if (res.data.studio_port) {
        setStudioUrl(`http://localhost:${res.data.studio_port}`);
      }
    } catch (err) {
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleAction = async (
    action: string,
    fn: () => Promise<any>
  ) => {
    setActionLoading(action);
    setError(null);
    try {
      await fn();
      await loadProject();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || `${action} failed. Please try again.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleScrape = () =>
    handleAction("Scraping", () => scrapeProject(projectId));

  const handleGenerateScript = () =>
    handleAction("Generating Script", () =>
      generateScript(projectId)
    );

  const handleGenerateScenes = () =>
    handleAction("Generating Scenes", () =>
      generateScenes(projectId)
    );

  const handleLaunchStudio = () =>
    handleAction("Launching Studio", async () => {
      const res = await launchStudio(projectId);
      setStudioUrl(res.data.studio_url);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 text-gray-500">
        Project not found.
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "script", label: "Script" },
    { id: "scenes", label: `Scenes (${project.scenes.length})` },
    { id: "chat", label: "Chat Editor" },
    { id: "studio", label: "Studio" },
  ];

  // Determine which actions are available based on status
  const canScrape = project.status === "created";
  const canGenerateScript = project.status === "scraped";
  const canGenerateScenes = project.status === "scripted";
  const canLaunchStudio = ["generated", "done"].includes(project.status);

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>
            <a
              href={project.blog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {project.blog_url}
            </a>
          </div>
        </div>

        {/* Action buttons - pipeline steps */}
        <div className="flex flex-wrap gap-3">
          {canScrape && (
            <ActionButton
              label="1. Scrape Blog"
              loading={actionLoading === "Scraping"}
              onClick={handleScrape}
            />
          )}
          {canGenerateScript && (
            <ActionButton
              label="2. Generate Script"
              loading={actionLoading === "Generating Script"}
              onClick={handleGenerateScript}
            />
          )}
          {canGenerateScenes && (
            <ActionButton
              label="3. Generate Video Scenes"
              loading={actionLoading === "Generating Scenes"}
              onClick={handleGenerateScenes}
            />
          )}
          {canLaunchStudio && (
            <ActionButton
              label="4. Launch Remotion Studio"
              loading={actionLoading === "Launching Studio"}
              onClick={handleLaunchStudio}
              variant="green"
            />
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
          <div className="space-y-4">
            {project.scenes.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No scenes generated yet.</p>
                <p className="text-sm mt-1">
                  Generate a script first, then generate video scenes.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {project.scenes.map((scene) => (
                  <SceneCard key={scene.id} scene={scene} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div>
            {project.scenes.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">
                  Generate a script first to use the chat editor.
                </p>
              </div>
            ) : (
              <ChatPanel
                projectId={projectId}
                onScenesUpdated={loadProject}
              />
            )}
          </div>
        )}

        {activeTab === "studio" && (
          <div className="space-y-6">
            {studioUrl ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-3">
                  Remotion Studio
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  Remotion Studio is running. Open it in a new tab to
                  preview, edit, and render your video.
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href={studioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Remotion Studio
                  </a>
                  <span className="text-sm text-gray-500">
                    {studioUrl}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">Studio not launched yet.</p>
                <p className="text-sm mt-1">
                  Generate video scenes first, then launch Remotion
                  Studio from the header actions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────

function ActionButton({
  label,
  loading,
  onClick,
  variant = "blue",
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  variant?: "blue" | "green";
}) {
  const colors =
    variant === "green"
      ? "bg-green-600 hover:bg-green-500 disabled:bg-gray-700"
      : "bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-4 py-2 ${colors} disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {loading ? "Processing..." : label}
    </button>
  );
}
