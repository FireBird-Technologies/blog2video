import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listProjects,
  createProject,
  createProjectFromDocs,
  createProjectsBulk,
  deleteProject,
  createCheckoutSession,
  createPortalSession,
  uploadLogo,
  startGeneration,
  getPipelineStatus,
  ProjectListItem,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import BlogUrlForm from "../components/BlogUrlForm";
import DeleteProjectModal from "../components/DeleteProjectModal";
import StatusBadge from "../components/StatusBadge";
import { setPendingUpload } from "../stores/pendingUpload";

const BULK_PENDING_IDS_KEY = "b2v_bulk_pending_ids";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bulkPendingIds, setBulkPendingIds] = useState<number[]>([]);
  const [bulkStatuses, setBulkStatuses] = useState<
    Record<number, { step?: string; running?: boolean; error?: string; status?: string }>
  >({});
  const bulkStartedRef = useRef(false);
  const bulkPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate bulk IDs from localStorage (or URL for backward compatibility)
  useEffect(() => {
    const stored = localStorage.getItem(BULK_PENDING_IDS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number" && Number.isInteger(n))) {
          setBulkPendingIds(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    const q = searchParams.get("bulk");
    if (q) {
      const ids = q
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      if (ids.length > 0) {
        setBulkPendingIds(ids);
        localStorage.setItem(BULK_PENDING_IDS_KEY, JSON.stringify(ids));
      }
    }
  }, [searchParams]);

  useEffect(() => {
    loadProjects();
    if (searchParams.get("upgraded") === "true") {
      refreshUser();
    }
  }, []);

  useEffect(() => {
    if (bulkPendingIds.length > 0) loadProjects();
  }, [bulkPendingIds.length]);

  useEffect(() => {
    if (bulkPendingIds.length === 0) {
      bulkStartedRef.current = false;
      return;
    }
  }, [bulkPendingIds.length]);

  // Start generation for each bulk id once
  useEffect(() => {
    if (bulkPendingIds.length === 0 || bulkStartedRef.current) return;
    bulkStartedRef.current = true;
    bulkPendingIds.forEach((id) => {
      startGeneration(id).catch(() => {
        setBulkStatuses((prev) => ({ ...prev, [id]: { running: false, error: "Failed to start", status: "created" } }));
      });
    });
  }, [bulkPendingIds]);

  // Poll pipeline status for bulk ids until all have running === false
  useEffect(() => {
    if (bulkPendingIds.length === 0) return;
    const poll = async () => {
      const updates: Record<number, { step?: string; running?: boolean; error?: string; status?: string }> = {};
      const results = await Promise.allSettled(
        bulkPendingIds.map((id) => getPipelineStatus(id).then((res) => ({ id, data: res.data })))
      );
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const { step, running, error: pipelineError, status } = r.value.data;
          updates[r.value.id] = {
            step: step != null ? String(step) : undefined,
            running,
            error: pipelineError ?? undefined,
            status,
          };
        }
      });
      setBulkStatuses((prev) => ({ ...prev, ...updates }));
      const allDone =
        bulkPendingIds.length > 0 &&
        bulkPendingIds.every((id) => updates[id] != null && updates[id].running === false);
      if (allDone && bulkPollingRef.current) {
        clearInterval(bulkPollingRef.current);
        bulkPollingRef.current = null;
      }
      if (allDone) {
        // All bulk pipeline runs finished (success or error) — clear state and refresh projects
        localStorage.removeItem(BULK_PENDING_IDS_KEY);
        setBulkPendingIds([]);
        setBulkStatuses({});
        loadProjects();
      }
    };
    poll();
    bulkPollingRef.current = setInterval(poll, 2000);
    return () => {
      if (bulkPollingRef.current) {
        clearInterval(bulkPollingRef.current);
        bulkPollingRef.current = null;
      }
    };
  }, [bulkPendingIds.join(",")]);

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

  const handleCreateBulk = async (
    items: import("../api/client").BulkProjectItem[],
    logoOptions: { logoIndices: number[]; logoFiles: File[] } | null
  ) => {
    setCreating(true);
    try {
      const res = await createProjectsBulk(items, logoOptions);
      await refreshUser();
      setShowModal(false);
      const ids = res.data.project_ids;
      if (ids.length > 0) {
        localStorage.setItem(BULK_PENDING_IDS_KEY, JSON.stringify(ids));
        setBulkPendingIds(ids);
      }
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 403) {
        alert(err.response?.data?.detail || "Video limit reached. Upgrade to Pro for more.");
      } else {
        console.error("Bulk create failed:", err);
      }
    } finally {
      setCreating(false);
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
    template?: string,
    videoStyle?: string
  ) => {
    setCreating(true);
    try {
      let res;

      if (uploadFiles && uploadFiles.length > 0) {
        // Document upload flow – use FormData endpoint to send files + config together
        res = await createProjectFromDocs(uploadFiles, {
          name,
          voice_gender: voiceGender,
          voice_accent: voiceAccent,
          accent_color: accentColor,
          bg_color: bgColor,
          text_color: textColor,
          animation_instructions: animationInstructions,
          logo_position: logoPosition,
          logo_opacity: logoOpacity,
          custom_voice_id: customVoiceId,
          aspect_ratio: aspectRatio,
          template,
          video_style: videoStyle,
        });
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
          template,
          videoStyle
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

  const handleDeleteClick = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteProject(deleteTarget.id);
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
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
            <BlogUrlForm onSubmit={handleCreate} onSubmitBulk={handleCreateBulk} loading={creating} />
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
          onSubmitBulk={handleCreateBulk}
          loading={creating}
          asModal
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Delete project confirmation */}
      <DeleteProjectModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        projectName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
      />

      {/* Bulk progress */}
      {bulkPendingIds.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Bulk progress</h2>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(BULK_PENDING_IDS_KEY);
                setBulkPendingIds([]);
                loadProjects();
              }}
              className="text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              Dismiss
            </button>
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {bulkPendingIds.map((id) => {
              const s = bulkStatuses[id];
              const project = projects.find((p) => p.id === id);
              const name =
                (project?.name && project.name.trim()) ||
                project?.blog_url ||
                "Untitled project";
              const stepNumber =
                s && s.step != null && !Number.isNaN(Number(s.step))
                  ? Number(s.step)
                  : 0;
              const stepTargets: Record<number, number> = {
                0: 3,
                1: 20,
                2: 48,
                3: 72,
                4: 100,
              };
              let rowPercent = 0;
              if (s?.error) {
                rowPercent = 100;
              } else if (s && !s.running && s.status === "done") {
                rowPercent = 100;
              } else if (s) {
                rowPercent = stepTargets[stepNumber] ?? 100;
              }
              return (
                <li
                  key={id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span
                    className="truncate flex-1 min-w-0 cursor-pointer text-gray-700 hover:text-purple-600"
                    onClick={() => navigate(`/project/${id}`)}
                    title={name}
                  >
                    {name}
                  </span>
                  <div className="flex flex-col items-end flex-shrink-0 ml-3 w-64">
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 transition-all ${
                          s?.error
                            ? "bg-red-500"
                            : s && !s.running && s.status === "done"
                              ? "bg-green-500"
                              : "bg-purple-600"
                        }`}
                        style={{ width: `${rowPercent}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 w-full">
                      <span
                        className={`text-[11px] ${
                          s?.error
                            ? "text-red-600"
                            : s && !s.running && s.status === "done"
                              ? "text-green-600"
                              : "text-gray-500"
                        } truncate`}
                      >
                        {s?.error
                          ? s.error
                          : s && !s.running && s.status === "done"
                            ? "Done"
                            : s?.status ?? "Running…"}
                      </span>
                      <span className="text-[11px] text-gray-500 tabular-nums">
                        {rowPercent}%
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Project list */}
      <div className="grid gap-3">
        {!loaded ? (
          // Skeleton loading
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-card px-5 py-4 animate-pulse"
              aria-hidden
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-4 bg-gray-200 rounded w-3/4 max-w-[300px]" />
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 bg-gray-100 rounded w-32" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-12" />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          projects.map((project) => (
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
                onClick={(e) => handleDeleteClick(project.id, project.name, e)}
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
        ))
        )}
      </div>
    </div>
  );
}
