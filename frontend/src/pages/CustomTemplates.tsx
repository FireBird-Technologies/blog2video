import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  listCustomTemplates,
  deleteCustomTemplate,
  regenerateTemplateCode,
  generateTemplateCode,
  type CustomTemplateItem,
} from "../api/client";
import { preloadBabel } from "../utils/compileComponent";
import CustomTemplateCreator from "../components/CustomTemplateCreator";
import CustomTemplateEditor from "../components/CustomTemplateEditor";
import CustomPreview from "../components/templatePreviews/CustomPreview";
import { VIDEO_STYLE_OPTIONS, normalizeVideoStyle, type VideoStyleId } from "../constants/videoStyles";

const STYLE_LABELS = Object.fromEntries(VIDEO_STYLE_OPTIONS.map((s) => [s.id, s.label])) as Record<string, string>;

export default function CustomTemplates() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CustomTemplateItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorKey, setCreatorKey] = useState(0);
  const [creatorInitialVideoStyle, setCreatorInitialVideoStyle] = useState<VideoStyleId | undefined>(undefined);
  const [editTarget, setEditTarget] = useState<CustomTemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactCount, setDeleteImpactCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadTemplates();
    preloadBabel();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // BlogUrlForm navigates with ?tab=templates&openCustomCreator=1&videoStyle=…
  useEffect(() => {
    if (searchParams.get("openCustomCreator") !== "1") return;
    const style = normalizeVideoStyle(searchParams.get("videoStyle"));
    setCreatorInitialVideoStyle(style);
    setCreatorKey((k) => k + 1);
    setShowCreator(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openCustomCreator");
    next.delete("videoStyle");
    const qs = next.toString();
    navigate(qs ? `/dashboard?${qs}` : "/dashboard", { replace: true });
  }, [searchParams, navigate]);

  const loadTemplates = async () => {
    try {
      const res = await listCustomTemplates();
      setTemplates(res.data);
      startPollingIfNeeded(res.data);
    } catch (err) {
      console.error("Failed to load custom templates:", err);
    } finally {
      setLoaded(true);
    }
  };

  // Merge only pending/failed templates from server — leaves completed ones untouched to avoid resetting preview
  const mergePendingTemplates = (fresh: CustomTemplateItem[]) => {
    setTemplates((prev) => prev.map((t) => {
      if (t.intro_code) return t; // already complete — don't replace
      const updated = fresh.find((f) => f.id === t.id);
      return updated ?? t;
    }));
  };

  const startPollingIfNeeded = (data: CustomTemplateItem[]) => {
    const anyPending = data.some((t: CustomTemplateItem) => !t.intro_code && !t.generation_failed);
    if (anyPending && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const r = await listCustomTemplates();
          mergePendingTemplates(r.data);
          const stillPending = r.data.some((t: CustomTemplateItem) => !t.intro_code && !t.generation_failed);
          if (!stillPending) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
          }
        } catch { /* ignore */ }
      }, 4000);
    } else if (!anyPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleCreated = (tpl: CustomTemplateItem) => {
    setTemplates((prev) => [tpl, ...prev]);
    setShowCreator(false);
    setCreatorInitialVideoStyle(undefined);
    startPollingIfNeeded([tpl]);
  };

  const handleSaved = (tpl: CustomTemplateItem) => {
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
    setEditTarget(null);
  };

  const handleRegenerate = async (tpl: CustomTemplateItem) => {
    setRegeneratingId(tpl.id);
    try {
      if (!tpl.intro_code) {
        // First-time generation (failed previously) — fire and poll
        await generateTemplateCode(tpl.id);
        setTimeout(() => loadTemplates(), 5000);
      } else {
        const res = await regenerateTemplateCode(tpl.id);
        setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? res.data : t)));
        setTimeout(() => loadTemplates(), 5000);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 429) {
        setRateLimitError(typeof detail === "string" ? detail : "Daily AI generation limit reached. Try again tomorrow.");
      } else {
        console.error("Failed to regenerate template code:", err);
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomTemplate(deleteTarget.id, deleteImpactCount != null);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteImpactCount(null);
    } catch (err) {
      const detail = (err as {
        response?: { data?: { detail?: string | { code?: string; message?: string; project_count?: number } } };
      })?.response?.data?.detail;
      if (
        detail &&
        typeof detail === "object" &&
        detail.code === "template_in_use"
      ) {
        setDeleteImpactCount(typeof detail.project_count === "number" ? detail.project_count : 0);
        setDeleteError(detail.message || null);
      } else {
        console.error("Failed to delete template:", err);
        setDeleteError(
          typeof detail === "string"
            ? detail
            : "Failed to delete template. Please try again."
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  // ─── Empty state ──────────────────────────────────────────
  if (loaded && templates.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom templates yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm">
            Create your first custom template by providing a website URL. We'll extract
            colors, fonts, and style to build a video template that matches your brand.
          </p>
          <button
            onClick={() => {
              setCreatorInitialVideoStyle(undefined);
              setCreatorKey((k) => k + 1);
              setShowCreator(true);
            }}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Create Custom Template
          </button>
        </div>

        {showCreator && (
          <CustomTemplateCreator
            key={creatorKey}
            initialVideoStyle={creatorInitialVideoStyle}
            onCreated={handleCreated}
            onCancel={() => {
              setShowCreator(false);
              setCreatorInitialVideoStyle(undefined);
            }}
          />
        )}
      </>
    );
  }

  // ─── Template grid ────────────────────────────────────────
  return (
    <>
      <div className="space-y-6">
        {/* Rate limit banner */}
        {rateLimitError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span>{rateLimitError}</span>
            <button onClick={() => setRateLimitError(null)} className="shrink-0 text-amber-500 hover:text-amber-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Custom Templates
            <span className="text-sm font-normal text-gray-400 ml-2">({templates.length})</span>
          </h2>
          <button
            onClick={() => {
              setCreatorInitialVideoStyle(undefined);
              setCreatorKey((k) => k + 1);
              setShowCreator(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Create New
          </button>
        </div>

        {/* Grid */}
        {!loaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="w-full aspect-video bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="glass-card overflow-hidden group">
                {/* Template preview */}
                <div className="relative overflow-hidden rounded-t-xl min-h-[120px] aspect-video">
                  {tpl.intro_code ? (
                    <CustomPreview
                      theme={tpl.theme}
                      name={tpl.name}
                      introCode={tpl.intro_code || undefined}
                      outroCode={tpl.outro_code || undefined}
                      contentCodes={tpl.content_codes || undefined}
                      contentArchetypeIds={tpl.content_archetype_ids || undefined}
                      previewImageUrl={tpl.preview_image_url}
                      logoUrls={tpl.logo_urls}
                      ogImage={tpl.og_image}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-3"
                      style={{ background: tpl.theme.colors.bg, aspectRatio: "16/9" }}
                    >
                      {tpl.generation_failed && regeneratingId !== tpl.id ? (
                        <>
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tpl.theme.colors.muted }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: tpl.theme.colors.muted }}>
                            Generation failed
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${tpl.theme.colors.accent}40`, borderTopColor: "transparent" }} />
                          <span className="text-xs font-medium" style={{ color: tpl.theme.colors.muted }}>
                            Generating...
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Name */}
                  <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">
                    {tpl.name}
                  </h3>

                  {/* Style pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium">
                      {STYLE_LABELS[tpl.supported_video_style] ?? tpl.supported_video_style}
                    </span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium">
                      {tpl.theme.colors.bg2 ? "Gradient" : "Solid"}
                    </span>
                    {tpl.theme.patterns && [
                      `${tpl.theme.patterns.cards?.corners || "rounded"} cards`,
                      `${tpl.theme.patterns.spacing?.density || "balanced"} spacing`,
                      `${tpl.theme.patterns.images?.treatment || "rounded"} images`,
                      tpl.theme.patterns.layout?.direction || "centered",
                    ].map((tag) => (
                      <span key={tag} className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium capitalize">
                        {tag}
                      </span>
                    ))}
                    {/* theme.style text — commented out */}
                    {/* <span className="text-[10px] text-gray-400 truncate">{tpl.theme.style}</span> */}
                  </div>

                  {/* Actions */}
                  {!tpl.intro_code ? (
                    tpl.generation_failed ? (
                      regeneratingId === tpl.id ? (
                        <div className="flex items-center gap-2 text-xs text-purple-500">
                          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRegenerate(tpl)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Retry generation
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(tpl);
                              setDeleteImpactCount(null);
                              setDeleteError(null);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        Generating template...
                      </div>
                    )
                  ) : regeneratingId === tpl.id ? (
                    <div className="flex items-center gap-2 text-xs text-purple-500">
                      <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Regenerating...
                    </div>
                  ) : (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRegenerate(tpl)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        title="Generate a completely new design for this brand"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => setEditTarget(tpl)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(tpl);
                          setDeleteImpactCount(null);
                          setDeleteError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creator modal */}
      {showCreator && (
        <CustomTemplateCreator
          key={creatorKey}
          initialVideoStyle={creatorInitialVideoStyle}
          onCreated={handleCreated}
          onCancel={() => {
            setShowCreator(false);
            setCreatorInitialVideoStyle(undefined);
          }}
        />
      )}

      {/* Editor modal */}
      {editTarget && (
        <CustomTemplateEditor
          template={editTarget}
          onSaved={handleSaved}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setDeleteTarget(null);
              setDeleteImpactCount(null);
              setDeleteError(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
            <p className="text-sm text-gray-500 mb-5">
              {deleteImpactCount == null ? (
                <>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
                </>
              ) : (
                <>
                  <strong>{deleteTarget.name}</strong> is currently used by {deleteImpactCount} project{deleteImpactCount === 1 ? "" : "s"}.
                  Deleting it will keep previews visible, but those projects will be blocked from future render and re-render actions.
                </>
              )}
            </p>
            {deleteError && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteImpactCount(null);
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {deleting ? "Deleting..." : deleteImpactCount == null ? "Delete" : "Delete Anyway"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
