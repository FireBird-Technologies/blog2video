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
import { invalidateBlogUrlFormAvailabilityCache } from "../api/blogUrlFormStep2Prefetch";
import { useCraftedTemplates } from "../contexts/CraftedTemplatesContext";
import { useAuth } from "../hooks/useAuth";
import { preloadBabel } from "../utils/compileComponent";
import CustomTemplateCreator from "../components/CustomTemplateCreator";
import TemplateStarRating from "../components/TemplateStarRating";
import CustomTemplateLimitModal from "../components/CustomTemplateLimitModal";
import TemplateSceneEditor from "../components/TemplateSceneEditor";
import TemplateProgressModal from "../components/TemplateProgressModal";
import CustomPreview from "../components/templatePreviews/CustomPreview";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreview from "../components/templatePreviews/CraftedTemplatePreview";
import DesignerTemplateRequestModal from "../components/DesignerTemplateRequestModal";
import useIsMobileViewport from "../hooks/useIsMobileViewport";
import TemplateGenerationProgress, {
  useGenerationStatus,
  invalidateGenerationStatus,
} from "../components/TemplateGenerationProgress";

/** Live step list for one generating card.
 *
 * A component rather than an inline block because each card polls its own
 * status, and hooks cannot be called from inside the template .map(). */
function GeneratingCardStatus({
  templateId,
  onFinished,
}: {
  templateId: number;
  onFinished?: () => void;
}) {
  const status = useGenerationStatus(templateId, true);

  // This card polls the generation-status endpoint directly, so it learns the
  // run finished BEFORE the page's 4s list poller does — and it was showing an
  // all-green rail beside the words "Generating template…", because that text
  // is driven by the template ROW, which was still the pre-completion one.
  //
  // Telling the page to reload closes that window instead of leaving the card
  // self-contradicting until the next list poll (or forever, if the list poller
  // had already stopped).
  const finished = status?.status === "complete" || status?.status === "error";
  useEffect(() => {
    if (finished) onFinished?.();
    // onFinished is a parent callback and not stable across renders; including
    // it would re-fire this on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return <TemplateGenerationProgress status={status} variant="card" />;
}

// A template stuck "generating" longer than this (no code, not flagged failed) is
// treated as errored — generation crashed / connection was lost and the backend
// never marked it failed, so it would otherwise spin forever.
//
// The ceiling must sit ABOVE the real worst case, or a live run gets false-flagged
// as stalled and the user is shown a "try again or delete" card while the backend
// is still working (observed: a 14-minute run flagged at 8). Generation is 1 intro +
// N content archetypes + 1 outro, each with its own dspy.Refine retries, plus up to
// MAX_SCENE_RETRIES per scene in the final validation pass — so a slow-but-healthy
// run legitimately reaches double digits. The in-card copy quotes 5–10 minutes;
// 15 leaves headroom past that without spinning forever on a truly dead run.
const STUCK_GENERATION_MS = 15 * 60 * 1000;

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
  const firstTimeGenerating = !tpl.intro_code && !tpl.generation_failed;
  if (!firstTimeGenerating && !tpl.is_regenerating) return false;
  const ts = parseServerTimestamp(tpl.updated_at || tpl.created_at);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > STUCK_GENERATION_MS;
}

export default function CustomTemplates() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { craftedTemplates, loading: craftedTemplatesFetching, initialized: craftedTemplatesInitialized } = useCraftedTemplates();
  // Keep the loader visible until the first R2 roundtrip resolves, even when
  // we paint from localStorage cache first — otherwise an empty cache flashes
  // the "no templates" state before the real list arrives.
  const craftedTemplatesLoading = craftedTemplatesFetching || !craftedTemplatesInitialized;
  const previewCompileScope = user?.id != null ? String(user.id) : undefined;
  // On mobile, template previews render as static images/placeholders (no live
  // Remotion Players) — a grid of Players exhausts iOS Safari's memory and
  // reloads the tab.
  const isMobile = useIsMobileViewport();
  const [templates, setTemplates] = useState<CustomTemplateItem[]>([]);
  const [activeTemplatesTab, setActiveTemplatesTab] = useState<"custom" | "crafted">("custom");
  const [loaded, setLoaded] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorKey, setCreatorKey] = useState(0);
  // The single edit modal: name, colours AND per-scene AI edits. Was two
  // separate states (editTarget + sceneEditTarget) backing two modals that
  // unmounted each other.
  const [editTarget, setEditTarget] = useState<CustomTemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactCount, setDeleteImpactCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [regenerateConfirmTarget, setRegenerateConfirmTarget] = useState<CustomTemplateItem | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  // Re-opened progress view for a template generating in the background.
  // Holds the id, not the row: the row is replaced wholesale by the poller
  // on every tick, so a captured object would go stale immediately.
  const [progressTargetId, setProgressTargetId] = useState<number | null>(null);
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

  // A template is "pending" either during its first-ever generation (no
  // intro_code yet, not flagged failed) or while a regeneration overwrites
  // its existing code (is_regenerating — intro_code is still the OLD code
  // until this flips back to false).
  const isPending = (t: CustomTemplateItem) =>
    (!t.intro_code && !t.generation_failed) || t.is_regenerating;

  // Reconcile the server list into local state.
  //
  // Settled templates are left alone so a live Remotion preview isn't torn down
  // and recompiled on every 4s poll. Pending ones take the server row wholesale
  // — that is how a finished generation's code reaches the card.
  //
  // Rows the server has that we don't are APPENDED rather than ignored. Without
  // this a template created in another tab (or one whose local insert was lost)
  // never appeared until a full page refresh.
  const mergePendingTemplates = (fresh: CustomTemplateItem[]) => {
    setTemplates((prev) => {
      const merged = prev.map((t) => {
        if (!isPending(t)) return t; // already settled — don't replace
        const updated = fresh.find((f) => f.id === t.id);
        return updated ?? t;
      });
      const known = new Set(merged.map((t) => t.id));
      // Server order is created_at DESC, so newcomers belong at the front.
      const added = fresh.filter((f) => !known.has(f.id));
      const next = [...added, ...merged];
      // Collapse any duplicate ids that slipped in (a create racing the poller).
      // Keeping the FIRST occurrence preserves the list's ordering.
      const seen = new Set<number>();
      return next.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    });
  };

  // `data` is a HINT that something may be pending, never the full picture —
  // handleCreated passes just the one new template. So it can only ever START
  // the poller; only the poller itself, seeing a complete server list with
  // nothing pending, is allowed to stop it. Letting a single-element call take
  // the stop branch killed the poller for every other in-flight template.
  const startPollingIfNeeded = (data: CustomTemplateItem[]) => {
    const anyPending = data.some(isPending);
    if (anyPending && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const r = await listCustomTemplates();
          mergePendingTemplates(r.data);
          const stillPending = r.data.some(isPending);
          if (!stillPending) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            // A template just finished (re)generating — refresh the
            // project-creation picker's cache so it reflects the new code.
            invalidateBlogUrlFormAvailabilityCache();
            // A FAILED regeneration refunds its slot server-side, so re-pull
            // the user to pick that back up in the "X / Y Created" counter.
            void refreshUser();
          }
        } catch { /* ignore */ }
      }, 4000);
    }
  };

  const handleCreated = (tpl: CustomTemplateItem) => {
    // Prepend only if it isn't already in the list. The page-level poller runs
    // listCustomTemplates() every 4s while anything is pending, so by the time
    // the user closes the creator the server row is frequently ALREADY here —
    // prepending unconditionally rendered the same template as two cards.
    setTemplates((prev) =>
      prev.some((t) => t.id === tpl.id)
        ? prev.map((t) => (t.id === tpl.id ? tpl : t))
        : [tpl, ...prev]
    );
    setShowCreator(false);
    startPollingIfNeeded([tpl]);
    // Drop the project-creation picker's cached template list so this new one
    // shows up there without needing a full page refresh.
    invalidateBlogUrlFormAvailabilityCache();
    // Re-pull the user so the "X / Y Created" counter and the at-limit gating
    // (can_create_custom_template) reflect the just-incremented server count —
    // otherwise the counter stays stale and "Create New" reopens the creator
    // instead of the upgrade modal.
    void refreshUser();
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
        // First-time generation (failed previously) — fire and poll. Bump
        // updated_at locally too: isStuckGenerating() flags a codeless
        // template whose updated_at is older than STUCK_GENERATION_MS, so a
        // retry on a STALLED (never flagged failed) template would otherwise
        // fall straight back to the "Generation stalled" card instead of
        // showing a spinner. The server bumps it too; this just avoids the
        // gap until the next poll.
        await generateTemplateCode(tpl.id);
        // A new run — forget the previous one's cached status, or the rail
        // opens on its finished state until the first poll lands.
        invalidateGenerationStatus(tpl.id);
        const retried = {
          ...tpl,
          generation_failed: false,
          updated_at: new Date().toISOString(),
        };
        setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? retried : t)));
        startPollingIfNeeded([retried]);
      } else {
        // Regenerate: fire-and-poll (202, no synchronous result). Flip
        // is_regenerating optimistically so the UI shows "Regenerating..."
        // immediately and survives a refresh/tab-switch via the poller —
        // the server's is_regenerating flag is the actual source of truth.
        await regenerateTemplateCode(tpl.id);
        invalidateGenerationStatus(tpl.id);
        const optimistic = { ...tpl, is_regenerating: true };
        setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? optimistic : t)));
        startPollingIfNeeded([optimistic]);
        // A regeneration consumes one custom-template slot, so re-pull the user
        // to update the "X / Y Created" counter and at-limit gating.
        void refreshUser();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403 && detail?.code === "custom_template_limit") {
        // Over limit on first-time generation → offer the $5 slot.
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

  const confirmRegenerate = () => {
    if (!regenerateConfirmTarget) return;
    const tpl = regenerateConfirmTarget;
    setRegenerateConfirmTarget(null);
    void handleRegenerate(tpl);
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
      // Keep the project-creation picker's cached list in sync with the deletion.
      invalidateBlogUrlFormAvailabilityCache();
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

  // Custom-template usage meter ("X / Y Created"). Shown in both the populated
  // header AND the empty state so the limit is always visible — even with zero
  // templates (e.g. all deleted, or a reactivated account still at its cap).
  const templateQuotaMeter =
    user ? (() => {
      const created = user.custom_templates_created ?? 0;
      const limit = user.custom_template_limit ?? 1;
      const pct = limit > 0 ? Math.min(100, Math.round((created / limit) * 100)) : 0;
      return (
        <div
          className="flex items-center gap-2.5"
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
    })() : null;

  // ─── Empty state ──────────────────────────────────────────
  //
  // Rendered as a BRANCH of the single return below, not as an early return.
  // It used to return its own tree carrying its own copy of the creator modal,
  // so the moment the first template landed and this stopped being the empty
  // state, React saw the creator at a different position, unmounted the live
  // one and mounted a fresh instance — losing the in-flight generation and
  // letting a second create fire onCreated again for the same template.
  const isEmpty = loaded && templates.length === 0 && readyCraftedTemplates.length === 0;

  const emptyState = (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom templates yet</h3>
          {templateQuotaMeter && <div className="mb-4">{templateQuotaMeter}</div>}
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
  );

  // ─── Template grid ────────────────────────────────────────
  const grid = (
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
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 min-w-0">
              {activeTemplatesTab === "custom" ? "Custom Templates" : "Designer Templates"}
              <span className="text-xs sm:text-sm font-normal text-gray-400 ml-1.5 sm:ml-2">
                ({activeTemplatesTab === "custom" ? templates.length : readyCraftedTemplates.length})
              </span>
            </h2>
            {/* Buttons shrink with the viewport instead of wrapping their labels
                onto multiple lines (which made them grow tall on narrow screens). */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {activeTemplatesTab === "custom" && templateQuotaMeter && (
                <div className="hidden sm:block">{templateQuotaMeter}</div>
              )}
              {activeTemplatesTab === "custom" && (
                <button
                  onClick={openCreator}
                  className="whitespace-nowrap px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200"
                >
                  Create New +
                </button>
              )}
              <button
                onClick={openRequestForm}
                className="whitespace-nowrap px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200"
              >
                {/* Shorter label on small screens — "Get Designer Template" is the
                    widest element in this row and forces the layout to break. */}
                <span className="sm:hidden">Get Designer</span>
                <span className="hidden sm:inline">Get Designer Template</span>
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
        ) : activeTemplatesTab === "custom" && templates.length === 0 ? (
          // Custom tab, nothing created yet. This is reachable when the user has
          // crafted templates but no custom ones (the both-empty case is handled by
          // the full-page empty state above), so mirror the crafted tab's empty
          // state rather than showing a blank grid.
          <div className="glass-card p-10 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-2">No custom templates created yet</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Create a custom template from a website URL or via a design doc.
            </p>
          </div>
        ) : activeTemplatesTab === "custom" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              // A crashed/stalled generation never gets flagged by the backend, so
              // treat a long-stuck one as failed → surfaces the Retry/Delete UI.
              const effectiveFailed = tpl.generation_failed || isStuckGenerating(tpl);
              // Same idea for a stuck regeneration — falls through to the normal
              // Regenerate/Edit/Delete UI instead of spinning forever if the
              // background thread died without clearing is_regenerating.
              const effectivelyRegenerating = tpl.is_regenerating && !isStuckGenerating(tpl);
              return (
              <div key={tpl.id} className="glass-card overflow-hidden group">
                {/* Template preview */}
                <div className="relative overflow-hidden rounded-t-xl min-h-[120px] aspect-video">
                  {/* A REGENERATING template still holds its old intro_code, so
                      keying this on intro_code alone showed the stale preview and
                      never mounted the progress card — regeneration looked frozen
                      for the same reason a closed creator did. */}
                  {tpl.intro_code && !effectivelyRegenerating ? (
                    <CustomPreview
                      theme={tpl.theme}
                      name={tpl.name}
                      introCode={tpl.intro_code || undefined}
                      outroCode={tpl.outro_code || undefined}
                      contentCodes={tpl.content_codes || undefined}
                      contentArchetypeIds={tpl.content_archetype_ids || undefined}
                      // Without these two the card fell back to the BUILT-IN CTA
                      // ending and generic copy: `designVersion ?? 1` sent every
                      // template down the v1 overlay branch, and an absent sample
                      // made every scene synthesise placeholder text. Both are
                      // already on the object this page holds.
                      designVersion={(tpl.design_blueprint as { version?: number } | null)?.version}
                      sceneSampleContent={tpl.scene_sample_content}
                      sceneFontDefaults={tpl.scene_font_defaults}
                      previewImageUrl={tpl.preview_image_url}
                      logoUrls={tpl.logo_urls}
                      ogImage={tpl.og_image}
                      thumbnailMode={isMobile}
                      staticThumb={isMobile}
                    />
                  ) : (
                    // White with black text, NOT the brand palette: while a
                    // template is generating its theme is the one thing not yet
                    // proven, and a dark brand background made this status text
                    // unreadable on exactly the cards that needed reading.
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-3"
                      style={{ background: "#FFFFFF", aspectRatio: "16/9" }}
                    >
                      {effectiveFailed && regeneratingId !== tpl.id ? (
                        <>
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#6B7280" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: "#111111" }}>
                            {tpl.generation_failed ? "Generation failed" : "Generation stalled — try again or delete"}
                          </span>
                        </>
                      ) : (
                        // Clicking reopens the full progress view. The creator
                        // modal cannot be reused for that — it owns wizard state
                        // that is gone once it unmounts — so this is a separate
                        // modal driven purely by the template id.
                        <button
                          type="button"
                          onClick={() => setProgressTargetId(tpl.id)}
                          title="View generation progress"
                          className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer"
                        >
                          <GeneratingCardStatus
                            templateId={tpl.id}
                            onFinished={() => { void loadTemplates(); }}
                          />
                        </button>
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
                      <div className="flex flex-col gap-1 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                          Generating template...
                        </div>
                        <span className="text-[11px] text-gray-400">This may take 5–10 minutes.</span>
                      </div>
                    )
                  ) : regeneratingId === tpl.id || effectivelyRegenerating ? (
                    <div className="flex flex-col gap-1 text-xs text-purple-500">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        Regenerating...
                      </div>
                      <span className="text-[11px] text-purple-400">This may take 5–10 minutes.</span>
                    </div>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRegenerateConfirmTarget(tpl)}
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
              Request a designer template and we will get one ready for you by our design team.
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
                      theme={tpl.theme}
                      thumbnailMode={isMobile}
                      staticThumb={isMobile}
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
  );

  return (
    <>
      {isEmpty ? emptyState : grid}

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
          onCancel={(inFlight) => {
            setShowCreator(false);
            // Closed while still generating: adopt the run so it keeps going
            // visibly. Without this the template was in NO list — the creator's
            // pollers died with its unmount, no card existed to take over, and
            // the page poller had never been started for it, so the UI sat
            // frozen until an unrelated refresh.
            if (inFlight) {
              setTemplates((prev) =>
                prev.some((t) => t.id === inFlight.id) ? prev : [inFlight, ...prev],
              );
              startPollingIfNeeded([inFlight]);
            }
          }}
        />
      )}

      {/* Re-opened progress for a background generation. Looked up by id on each
          render so it follows the poller's fresh row rather than a stale copy. */}
      {progressTargetId != null && (() => {
        const tpl = templates.find((t) => t.id === progressTargetId);
        if (!tpl) return null;
        return (
          <TemplateProgressModal
            templateId={tpl.id}
            name={tpl.name}
            onClose={() => setProgressTargetId(null)}
            onFinished={() => { void loadTemplates(); }}
          />
        );
      })()}

      {/* Custom-template quota upgrade modal — plan-tiered + $5 extra slot */}
      <CustomTemplateLimitModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />

      {/* ONE editor. Name, colours and per-scene AI edits used to be two modals
          that unmounted each other, so moving between them prompted to discard
          unsaved work. TemplateSceneEditor now hosts both. */}
      {editTarget && (
        <TemplateSceneEditor
          template={editTarget}
          onClose={() => setEditTarget(null)}
          onTemplateUpdated={(tpl) => {
            setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
            // Keep the modal open on the UPDATED row, so a save is reflected in
            // the preview without closing what the user is working in.
            setEditTarget(tpl);
          }}
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

      {/* Regenerate confirmation */}
      {regenerateConfirmTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setRegenerateConfirmTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Regenerate Template</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will replace <strong>{regenerateConfirmTarget.name}</strong>'s current design with a completely
              new AI-generated one. This will cost one template count.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRegenerateConfirmTarget(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRegenerate}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
