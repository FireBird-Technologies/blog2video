import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listProjects,
  createProject,
  deleteProject,
  createCheckoutSession,
  createPortalSession,
  ProjectListItem,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import BlogUrlForm from "../components/BlogUrlForm";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadProjects();
    // If user just upgraded, refresh their info
    if (searchParams.get("upgraded") === "true") {
      refreshUser();
    }
  }, []);

  const loadProjects = async () => {
    try {
      const res = await listProjects();
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const handleCreate = async (url: string, name?: string) => {
    setCreating(true);
    try {
      const res = await createProject(url, name);
      await refreshUser(); // Update usage counter
      navigate(`/project/${res.data.id}`);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        alert(
          err.response.data.detail ||
            "Video limit reached. Upgrade to Pro for more."
        );
      } else {
        console.error("Failed to create project:", err);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await createCheckoutSession();
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error("Failed to create checkout:", err);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await createPortalSession();
      window.location.href = res.data.portal_url;
    } catch (err) {
      console.error("Failed to open portal:", err);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isPro = user?.plan === "pro";
  const usagePercent = user
    ? Math.min(100, (user.videos_used_this_period / user.video_limit) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Usage / Plan banner */}
      <div
        className={`rounded-xl p-5 border ${
          isPro
            ? "bg-purple-900/10 border-purple-800/30"
            : "bg-gray-900 border-gray-800"
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  isPro
                    ? "bg-purple-900/50 text-purple-300"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {isPro ? "Pro Plan" : "Free Plan"}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              {user?.videos_used_this_period ?? 0} of {user?.video_limit ?? 1}{" "}
              videos used
              {!isPro && " -- upgrade for 100 videos/month"}
            </p>
            {/* Progress bar */}
            <div className="w-64 h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 100 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
          <div>
            {isPro ? (
              <button
                onClick={handleManageBilling}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
              >
                Manage billing
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Upgrade to Pro -- $20/mo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 mt-1">
            Transform blog posts into explainer videos
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={!user?.can_create_video && !showForm}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-white mb-4">
            New Project
          </h2>
          <BlogUrlForm onSubmit={handleCreate} loading={creating} />
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 && !showForm ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-gray-600">+</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-300">
            No projects yet
          </h2>
          <p className="text-gray-500 mt-2 mb-6">
            Create your first project to get started
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-sm text-gray-500 truncate mb-2">
                    {project.blog_url}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>{project.scene_count} scenes</span>
                    <span>{formatDate(project.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(project.id, e)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
