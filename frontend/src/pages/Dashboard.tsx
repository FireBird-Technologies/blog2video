import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listProjects,
  createProject,
  deleteProject,
  createCheckoutSession,
  createPortalSession,
  uploadLogo,
  ProjectListItem,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import BlogUrlForm from "../components/BlogUrlForm";
import StatusBadge from "../components/StatusBadge";
import { setPendingUpload } from "../stores/pendingUpload";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadProjects();
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
    } finally {
      setLoaded(true);
    }
  };

  const handleCreate = async (
    url: string,
    name?: string,
    voiceGender?: string,
    voiceAccent?: string,
    accentColor?: string,
    bgColor?: string,
    textColor?: string,
    animationInstructions?: string,
    logoFile?: File,
    logoPosition?: string,
    logoOpacity?: number,
    customVoiceId?: string,
    aspectRatio?: string,
    uploadFiles?: File[],
    template?: string
  ) => {
    setCreating(true);
    try {
      let res;

      if (uploadFiles && uploadFiles.length > 0) {
        // Document upload flow – create project via JSON (fast), then
        // navigate immediately.  Files are uploaded on the project page.
        res = await createProject(
          "upload://documents",
          name,
          voiceGender,
          voiceAccent,
          accentColor,
          bgColor,
          textColor,
          animationInstructions,
          logoPosition,
          logoOpacity,
          customVoiceId,
          aspectRatio
        );
        // Stash files so ProjectView can upload them during step 1
        setPendingUpload(res.data.id, uploadFiles);
      } else {
        // URL flow
        res = await createProject(
          url,
          name,
          voiceGender,
          voiceAccent,
          accentColor,
          bgColor,
          textColor,
          animationInstructions,
          logoPosition,
          logoOpacity,
          customVoiceId,
          aspectRatio,
          template
        );
      }

      // Upload logo if provided
      if (logoFile) {
        try {
          await uploadLogo(res.data.id, logoFile);
        } catch (err) {
          console.error("Logo upload failed:", err);
        }
      }

      await refreshUser();
      setShowModal(false);
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
    });
  };

  const isPro = user?.plan === "pro";

  // ─── Onboarding (0 projects) ───────────────────────────────
  if (loaded && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md">
          {/* Welcome header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
              B2V
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Create your first video
            </h1>
            <p className="text-sm text-gray-400">
              Paste a blog URL or upload documents to create a video.
            </p>
          </div>

          {/* Inline form (same fields, not a modal) */}
          <div className="glass-card p-7">
            <BlogUrlForm onSubmit={handleCreate} loading={creating} />
          </div>

          {/* Upgrade nudge */}
          {!isPro && (
            <div className="text-center mt-6">
              <button
                onClick={handleUpgrade}
                className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
              >
                Need more? Upgrade to Pro for 100 videos/month
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Normal dashboard ──────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Usage banner */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {user?.videos_used_this_period ?? 0} of {user?.video_limit ?? 1}{" "}
            videos used
            {!isPro && " -- upgrade for 100/month"}
          </p>
        </div>
        <div>
          {isPro ? (
            <button
              onClick={() => navigate("/subscription")}
              className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
            >
              Manage billing
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Upgrade to Pro -- $50/mo
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowModal(true)}
          disabled={!user?.can_create_video}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New
        </button>
      </div>

      {/* New project modal */}
      {showModal && (
        <BlogUrlForm
          onSubmit={handleCreate}
          loading={creating}
          asModal
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Project list */}
      <div className="grid gap-3">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/project/${project.id}`)}
            className="glass-card px-5 py-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                    {project.name}
                  </h3>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="truncate max-w-[200px]">
                    {project.blog_url?.startsWith("upload://")
                      ? "Uploaded documents"
                      : project.blog_url || "—"}
                  </span>
                  <span>{project.scene_count} scenes</span>
                  <span>{formatDate(project.created_at)}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(project.id, e)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                title="Delete"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
