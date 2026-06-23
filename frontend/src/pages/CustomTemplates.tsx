import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  listCustomTemplates,
  deleteCustomTemplate,
  regenerateTemplateCode,
  generateTemplateCode,
  submitTemplateRating,
  type CustomTemplateItem,
} from "../api/client";
import { useCraftedTemplates } from "../contexts/CraftedTemplatesContext";
import { useAuth } from "../hooks/useAuth";
import { preloadBabel } from "../utils/compileComponent";
import CustomTemplateCreator from "../components/CustomTemplateCreator";
import TemplateStarRating from "../components/TemplateStarRating";
import CustomTemplateLimitModal from "../components/CustomTemplateLimitModal";
import CustomTemplateEditor from "../components/CustomTemplateEditor";
import CustomPreview from "../components/templatePreviews/CustomPreview";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreview from "../components/templatePreviews/CraftedTemplatePreview";
import DesignerTemplateRequestModal from "../components/DesignerTemplateRequestModal";

// A template stuck "generating" longer than this (no code, not flagged failed) is
// treated as errored — generation crashed / connection was lost and the backend
// never marked it failed, so it would otherwise spin forever. Real generation
// finishes in ~2 min; 8 min is a safe ceiling that won't false-flag a live run.
const STUCK_GENERATION_MS = 8 * 60 * 1000;

// Backend emits naive UTC timestamps (datetime.utcnow().isoformat(), no tz suffix).
// Date.parse() would read those as LOCAL time, so for any user in a positive UTC
// offset a brand-new template reads as hours old and instantly trips the stuck
// threshold below. Append 'Z' when no zone is present so it's parsed as UTC.
function parseServerTimestamp(s: string): number {
  if (!s) return NaN;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  return Date.parse(hasTz ? s : s + "Z");
}

function isStuckGenerating(tpl: CustomTemplateItem): boolean {
  if (tpl.intro_code || tpl.generation_failed) return false;
  const ts = parseServerTimestamp(tpl.updated_at || tpl.created_at);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > STUCK_GENERATION_MS;
}

export default function CustomTemplates() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { craftedTemplates, loading: craftedTemplatesFetching, initialized: craftedTemplatesInitialized } = useCraftedTemplates();
  // Keep the loader visible until the first R2 roundtrip resolves, even when
  // we paint from localStorage cache first — otherwise an empty cache flashes
  // the "no templates" state before the real list arrives.
  const craftedTemplatesLoading = craftedTemplatesFetching || !craftedTemplatesInitialized;
  const previewCompileScope = user?.id != null ? String(user.id) : undefined;
  const [templates, setTemplates] = useState<CustomTemplateItem[]>([]);
  const [activeTemplatesTab, setActiveTemplatesTab] = useState<"custom" | "crafted">("custom");
  const [loaded, setLoaded] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorKey, setCreatorKey] = useState(0);
  const [editTarget, setEditTarget] = useState<CustomTemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactCount, setDeleteImpactCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyCraftedTemplates = craftedTemplates.filter((ct) => !!ct.theme);

  // Gate the creator on the plan quota up front: if the user is already at their
  // limit, open the upgrade modal immediately instead of letting them fill in the
  // whole creator only to be blocked by the 403 at save time.
  const openCreator = () => {
    if (user && user.can_create_custom_template === false) {
      setShowUpgrade(true);
      return;
    }
    setCreatorKey((k) => k + 1);
    setShowCreator(true);
  };

  useEffect(() => {
    loadTemplates();
    preloadBabel();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // BlogUrlForm navigates with ?tab=templates&openCustomCreator=1
  useEffect(() => {
    if (searchParams.get("openCustomCreator") !== "1") return;
    openCreator();
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
    startPollingIfNeeded([tpl]);
  };

  const handleSaved = (tpl: CustomTemplateItem) => {
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
    setEditTarget(null);
  };

  const handleRate = async (
    tpl: CustomTemplateItem,
    rating: 1 | 2 | 3 | 4 | 5,
    comment?: string
  ) => {
    const prevRating = tpl.my_rating ?? null;
    const prevComment = tpl.my_rating_comment ?? null;
    const nextComment = comment ?? prevComment ?? null;
    // Optimistic — paint the new value immediately, roll back if the call fails.
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === tpl.id ? { ...t, my_rating: rating, my_rating_comment: nextComment } : t
      )
    );
    try {
      await submitTemplateRating(tpl.id, { rating, suggestion: comment });
    } catch (err) {
      console.error("Failed to rate template:", err);
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === tpl.id ? { ...t, my_rating: prevRating, my_rating_comment: prevComment } : t
        )
      );
    }
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
      if (status === 403 && detail?.code === "custom_template_limit") {
        // Over limit on a re-design of a succeeded template → offer the $5 slot.
        setShowUpgrade(true);
      } else if (status === 429) {
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

  const openRequestForm = () => {
    setShowRequestForm(true);
  };

  // ─── Empty state ──────────────────────────────────────────
  if (loaded && templates.length === 0 && readyCraftedTemplates.length === 0) {
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
            onClick={openCreator}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Create Custom Template
          </button>
          <button
            onClick={openRequestForm}
            className="mt-3 text-sm text-purple-500 hover:text-purple-700 transition-colors underline underline-offset-2"
          >
            Or Get Designer Template  →
          </button>
        </div>

        <DesignerTemplateRequestModal
          open={showRequestForm}
          onClose={() => setShowRequestForm(false)}
        />

        {showCreator && (
          <CustomTemplateCreator
            key={creatorKey}
            onCreated={handleCreated}
            onLimitReached={() => {
              setShowCreator(false);
              setShowUpgrade(true);
            }}
            onCancel={() => {
              setShowCreator(false);
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTemplatesTab === "custom" ? "Custom Templates" : "Designer Templates"}
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({activeTemplatesTab === "custom" ? templates.length : readyCraftedTemplates.length})
              </span>
            </h2>
            <div className="flex items-center gap-4">
              {activeTemplatesTab === "custom" && user && (() => {
                const created = user.custom_templates_created ?? 0;
                const limit = user.custom_template_limit ?? 1;
                const pct = limit > 0 ? Math.min(100, Math.round((created / limit) * 100)) : 0;
                return (
                  <div
                    className="hidden sm:flex items-center gap-2.5"
                    title="Templates created count toward your limit for life — deleting one does not free a slot. Buy more slots to raise your limit."
                  >
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      <span className="font-semibold text-gray-700 tabular-nums">{created}</span>
                      <span className="mx-0.5 text-gray-300">/</span>
                      <span className="tabular-nums">{limit}</span>
                      <span className="ml-1.5">Created</span>
                    </span>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              {activeTemplatesTab === "custom" && (
                <button
                  onClick={openCreator}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200"
                >
                  Create New +
                </button>
              )}
              <button
                onClick={openRequestForm}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200"
              >
                Get Designer Template
              </button>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTemplatesTab("custom")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTemplatesTab === "custom"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplatesTab("crafted")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTemplatesTab === "crafted"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Designer
            </button>
          </div>
        </div>

        {/* Grid */}
        {activeTemplatesTab === "custom" && !loaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="w-full aspect-video bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : activeTemplatesTab === "custom" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              // A crashed/stalled generation never gets flagged by the backend, so
              // treat a long-stuck one as failed → surfaces the Retry/Delete UI.
              const effectiveFailed = tpl.generation_failed || isStuckGenerating(tpl);
              return (
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
                      {effectiveFailed && regeneratingId !== tpl.id ? (
                        <>
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tpl.theme.colors.muted }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: tpl.theme.colors.muted }}>
                            {tpl.generation_failed ? "Generation failed" : "Generation stalled — try again or delete"}
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
                    effectiveFailed ? (
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
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity space-y-3">
                      <div className="flex gap-2">
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
                      {/* Rating — below the action buttons, with optional feedback */}
                      <div className="pt-1 border-t border-gray-100">
                        <TemplateStarRating
                          value={tpl.my_rating}
                          comment={tpl.my_rating_comment}
                          onRate={(r, c) => handleRate(tpl, r, c)}
                          size={18}
                          showLabel
                          allowComment
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : craftedTemplatesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="w-full aspect-video bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : readyCraftedTemplates.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-2">No designer templates yet</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Request a designer template and it will appear here once assigned to your account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyCraftedTemplates.map((tpl) => {
              return (
                <div key={tpl.id} className="glass-card overflow-hidden">
                  <div className="relative overflow-hidden rounded-t-xl min-h-[120px] aspect-video">
                    {/* Crafted templates ship a self-contained preview file in
                        their bundle — render it directly without pulling the
                        full layout package. Falls back to the static preview
                        image (then placeholder) when the source isn't bundled. */}
                    <CraftedTemplatePreview
                      templateId={tpl.id}
                      compileCacheScope={previewCompileScope}
                      previewSource={tpl.preview_file ?? null}
                      previewImageUrl={tpl.preview_image_url ?? null}
                      name={tpl.name}
                      showLoaderOnEmptyOrError
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">{tpl.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium">
                        Designer
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request form modal */}
      <DesignerTemplateRequestModal
        open={showRequestForm}
        onClose={() => { setShowRequestForm(false); }}
      />

      {/* Creator modal */}
      {showCreator && (
        <CustomTemplateCreator
          key={creatorKey}
          onCreated={handleCreated}
          onLimitReached={() => {
            setShowCreator(false);
            setShowUpgrade(true);
          }}
          onCancel={() => {
            setShowCreator(false);
          }}
        />
      )}

      {/* Custom-template quota upgrade modal — plan-tiered + $5 extra slot */}
      <CustomTemplateLimitModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />

      {/* Editor modal */}
      {editTarget && (
        <CustomTemplateEditor
          template={editTarget}
          onSaved={handleSaved}
          onTemplatePatch={(tpl) =>
            setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, ...tpl } : t)))
          }
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
