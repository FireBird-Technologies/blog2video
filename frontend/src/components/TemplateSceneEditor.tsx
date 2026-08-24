/**
 * Per-scene AI editing for a custom template (P4).
 *
 * Flow: pick a scene -> describe the change -> the backend regenerates that ONE
 * scene into a DRAFT -> preview draft vs published side by side -> apply or
 * discard. The published template is never touched until Apply, so a bad edit
 * costs nothing.
 *
 * Preview needs no new render infrastructure: CustomPreview already compiles
 * scene code in the browser. Feeding it ONLY the selected scene's code turns it
 * into a single-scene preview, so the panel shows exactly what is being edited
 * rather than playing the whole video.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  aiEditScene,
  applySceneDraft,
  discardSceneDraft,
  getSceneDraft,
  getSceneEditStatus,
  type CustomTemplateItem,
  type SceneDraft,
} from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";
import { preloadBabel } from "../utils/compileComponent";

const POLL_MS = 2000;
/** A scene edit is one scene, so it is far quicker than a regeneration — but
 *  still bounded so a hung job cannot poll forever. */
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

interface Props {
  template: CustomTemplateItem;
  onClose: () => void;
  onTemplateUpdated: (tpl: CustomTemplateItem) => void;
  /**
   * Switch back to the template-level editor (name / colours). Optional so this
   * modal can still be opened standalone, in which case no switch is rendered.
   */
  onSwitchToTemplate?: () => void;
}

interface SceneEntry {
  key: string;
  label: string;
}

export default function TemplateSceneEditor({ template, onClose, onTemplateUpdated, onSwitchToTemplate }: Props) {
  const contentCodes = useMemo(() => template.content_codes ?? [], [template.content_codes]);

  const scenes: SceneEntry[] = useMemo(() => {
    const archetypeLabel = (i: number): string => {
      const raw = template.content_archetype_ids?.[i];
      const id = typeof raw === "string" ? raw : raw?.id;
      if (!id) return `Content ${i + 1}`;
      return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };
    return [
      { key: "intro", label: "Intro" },
      ...contentCodes.map((_, i) => ({ key: `content_${i}`, label: archetypeLabel(i) })),
      { key: "outro", label: "Outro" },
    ];
  }, [contentCodes, template.content_archetype_ids]);

  const [selected, setSelected] = useState<string>("intro");
  const [prompt, setPrompt] = useState("");
  const [keepGeometry, setKeepGeometry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [showDraft, setShowDraft] = useState(true);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [scenesOpen, setScenesOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scenesRef = useRef<HTMLDivElement>(null);
  /** Synchronous double-click guard for apply/discard — see handleApply. */
  const applyingRef = useRef(false);

  useEffect(() => {
    preloadBabel();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Close the scene dropdown on an outside click or Escape — same behaviour as
  // the Background Style dropdown in CustomTemplateEditor.
  useEffect(() => {
    if (!scenesOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (scenesRef.current && !scenesRef.current.contains(e.target as Node)) {
        setScenesOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScenesOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [scenesOpen]);

  // Banners describe the scene they happened on, so drop them when the
  // selection changes. Done here rather than in the draft-loading effect below,
  // which early-returns on a cache hit and so would miss most switches.
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [selected]);

  // Auto-dismiss both banners after 3s. Keyed on the message itself, not just
  // presence, so a second error replacing a first restarts the countdown rather
  // than inheriting the old timer's remaining time.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Load any draft already pending for the selected scene (e.g. after a reload).
  //
  // Keyed on the SCENE, not on `template`: applying a draft hands back a new
  // template object, and depending on it re-ran this effect on every apply —
  // which fired a redundant GET and, worse, reset `draft` to null via the
  // unconditional clear below. Scenes with no pending draft answer 404, so a
  // scene revisited during one session refetched every time; `checkedRef`
  // remembers the answer and skips the repeat.
  //
  // (In dev, React StrictMode intentionally double-invokes effects, so each of
  // these appears twice in the server log. That is dev-only and expected.)
  const checkedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cacheKey = `${template.id}:${selected}`;
    if (checkedRef.current.has(cacheKey)) return;

    let cancelled = false;
    setDraft(null);
    setError(null);
    getSceneDraft(template.id, selected)
      .then((res) => {
        if (!cancelled) setDraft(res.data);
      })
      .catch(() => {
        // 404 simply means no pending draft — remember it so selecting this
        // scene again does not re-ask.
        if (!cancelled) checkedRef.current.add(cacheKey);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id, selected]);

  const handleSubmit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    stopPolling();

    try {
      const { data } = await aiEditScene(template.id, selected, {
        prompt: text,
        keep_geometry: keepGeometry,
      });
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getSceneEditStatus(template.id, selected, data.edit_id);
          if (status.data.status === "complete") {
            stopPolling();
            const d = await getSceneDraft(template.id, selected);
            // This scene now HAS a draft — drop the "known empty" marker so
            // reselecting it later refetches instead of assuming 404.
            checkedRef.current.delete(`${template.id}:${selected}`);
            setDraft(d.data);
            setShowDraft(true);
            setPrompt("");
            setBusy(false);
          } else if (status.data.status === "error") {
            stopPolling();
            setError(status.data.error || "The edit failed. Try rephrasing your request.");
            setBusy(false);
          } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            stopPolling();
            setError("The edit is taking longer than expected. Check back shortly.");
            setBusy(false);
          }
        } catch {
          stopPolling();
          setError("Lost contact with the server while editing.");
          setBusy(false);
        }
      }, POLL_MS);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setError(
        status === 429
          ? typeof detail === "string"
            ? detail
            : "Edit limit reached. Try again tomorrow."
          : status === 409
            ? "This template is being regenerated — try again shortly."
            : "Could not start the edit.",
      );
      setBusy(false);
    }
  };

  const handleApply = async () => {
    // `applyingRef` (not `busy`) guards the double-click: state set here is not
    // visible to a second click dispatched in the same tick, so two apply calls
    // could race — the first consumes the draft, the second 404s and reports
    // "Could not apply the draft" even though the apply succeeded.
    if (!draft || busy || applyingRef.current) return;
    applyingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await applySceneDraft(template.id, selected);
      // Clear the draft only AFTER the new template is in hand, and in the same
      // commit. Clearing it up front made `previewCodes` fall back to
      // `template.*_code` — still the OLD code, since the parent had not yet
      // received the update — so the preview visibly reverted to the previous
      // version for the whole duration of the request, then snapped forward.
      onTemplateUpdated(res.data);
      // The draft is consumed server-side; record that so the effect above does
      // not issue a guaranteed-404 refetch for this scene.
      checkedRef.current.add(`${res.data.id}:${selected}`);
      setDraft(null);
      setSuccess("Scene applied — it's now live in this template.");
    } catch {
      setError("Could not apply the draft.");
    } finally {
      applyingRef.current = false;
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    if (!draft || busy || applyingRef.current) return;
    applyingRef.current = true;
    setBusy(true);
    // Cleared up front — unlike apply, reverting the preview to the published
    // code IS the intended outcome here, so showing it immediately is correct.
    setDraft(null);
    try {
      await discardSceneDraft(template.id, selected);
      checkedRef.current.add(`${template.id}:${selected}`);
      setSuccess("Draft discarded.");
    } catch {
      setDraft(draft);
      setError("Could not discard the draft.");
    } finally {
      applyingRef.current = false;
      setBusy(false);
    }
  };

  /**
   * Preview ONLY the selected scene.
   *
   * CustomPreview has no "show scene N" prop — it cycles through whatever code
   * it is given. Passing just the selected scene's code makes it a one-scene
   * template, so the preview shows exactly what is being edited instead of
   * playing the whole video.
   *
   * The draft is substituted here when the Draft toggle is on, so the same
   * component renders both sides of the comparison.
   */
  const previewCodes = useMemo(() => {
    const useDraft = draft && showDraft;
    if (selected === "intro") {
      return { intro: useDraft ? draft.code : (template.intro_code ?? undefined), outro: undefined, content: [] };
    }
    if (selected === "outro") {
      return { intro: undefined, outro: useDraft ? draft.code : (template.outro_code ?? undefined), content: [] };
    }
    const m = /^content_(\d+)$/.exec(selected);
    const idx = m ? Number(m[1]) : 0;
    const code = useDraft ? draft.code : contentCodes[idx];
    return { intro: undefined, outro: undefined, content: code ? [code] : [] };
  }, [draft, showDraft, selected, template.intro_code, template.outro_code, contentCodes]);

  // The archetype metadata for the one scene being previewed, so its label and
  // best_for still drive the sample content CustomPreview feeds the component.
  const previewArchetypes = useMemo(() => {
    const m = /^content_(\d+)$/.exec(selected);
    if (!m) return undefined;
    const entry = template.content_archetype_ids?.[Number(m[1])];
    return entry ? [entry] : undefined;
  }, [selected, template.content_archetype_ids]);

  const warnings = template.generation_warnings ?? [];
  const selectedLabel = scenes.find((s) => s.key === selected)?.label ?? selected;
  // The outro always renders through GeneratedCtaOverlay at video time, so the
  // generated outro code is only a fallback. Say so rather than letting the
  // preview look wrong.
  const isOutro = selected === "outro";

  // Rendered through a portal like every other modal in the app: a `fixed`
  // element is still clipped by any ancestor with a transform/filter, which is
  // why the backdrop stopped short of the viewport edges when rendered in place.
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
              Edit scenes — {template.name}
            </h2>
            <p className="hidden text-xs text-gray-500 sm:block">Describe a change; preview it before it goes live.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1.5"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            {warnings.length} scene{warnings.length > 1 ? "s" : ""} used a simplified fallback
            design. Editing {warnings.length > 1 ? "them" : "it"} here is the quickest way to fix that.
          </div>
        )}

        {/* Three columns side by side on desktop; stacked and scrolled as one
            column below `lg`, where 52+preview+80 cannot fit without clipping
            the prompt panel off-screen. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Scene list */}
          {/* Left column: format switch above the scene list */}
          <nav className="flex shrink-0 flex-col border-b border-gray-100 p-3 lg:w-52 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {/* Return to the template-level editor (name / colours). Sits above
                Format as a plain text link rather than a button — it navigates
                between two views of the same template, so it should read as
                secondary next to the controls that actually change something. */}
            {onSwitchToTemplate && (
              <button
                onClick={onSwitchToTemplate}
                className="mb-4 inline-flex items-center gap-1 px-2 text-left text-[11px] font-medium text-violet-700 transition-colors hover:text-violet-900 hover:underline"
              >
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Switch to template editing
              </button>
            )}

            {/* Same segmented format toggle the bulk flow uses per row
                (BulkLinksSection) — a gray track with a white active chip. */}
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Format
            </p>
            <div className="mb-5 px-1">
              <div className="flex w-full gap-1 p-1 bg-gray-100/60 rounded-xl">
                {/* Landscape */}
                <button
                  type="button"
                  title="Landscape for Desktop/Youtube Videos"
                  onClick={() => setOrientation("landscape")}
                  className={`flex flex-1 items-center justify-center px-3 py-1.5 rounded-lg transition-all ${
                    orientation === "landscape"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <rect x="3" y="4" width="18" height="12" rx="2" />
                    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                  </svg>
                  <span className="ml-1.5 text-[11px] font-medium">16:9</span>
                </button>

                {/* Portrait */}
                <button
                  type="button"
                  title="Portrait for tiktok/instagram/mobile videos"
                  onClick={() => setOrientation("portrait")}
                  className={`flex flex-1 items-center justify-center px-3 py-1.5 rounded-lg transition-all ${
                    orientation === "portrait"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <rect x="7" y="2" width="10" height="20" rx="2" />
                    <circle cx="12" cy="18" r="1" />
                  </svg>
                  <span className="ml-1.5 text-[11px] font-medium">9:16</span>
                </button>
              </div>
            </div>

            {/* Label left, pill right on small screens (one row, no wasted
                vertical space); label above the list on desktop. */}
            <div className="flex items-center justify-between gap-2 lg:block">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:pb-2">
                Scenes
              </p>
              {/* Scene picker: the current scene as a pill with a chevron, opening
                  a custom menu. A dropdown rather than a full list so the stacked
                  small-screen layout keeps the preview above the fold; on desktop
                  the `lg:` rules below expand it back to a plain vertical list,
                  where the tall narrow rail has room for every scene at once. */}
              <div ref={scenesRef} className="relative min-w-0 lg:hidden">
                <button
                  type="button"
                  onClick={() => setScenesOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={scenesOpen}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-violet-50 py-1.5 pl-3 pr-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
                >
                  <span className="truncate">{selectedLabel}</span>
                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform ${scenesOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {scenesOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 z-20 mt-1.5 max-h-64 w-52 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    {scenes.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        role="option"
                        aria-selected={selected === s.key}
                        onClick={() => {
                          setSelected(s.key);
                          setScenesOpen(false);
                        }}
                        className={`block w-full truncate px-3 py-2 text-left text-sm transition-colors ${
                          selected === s.key
                            ? "bg-violet-50/60 font-medium text-violet-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: the full vertical list, unchanged. */}
            <div className="hidden lg:block">
              {scenes.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelected(s.key)}
                  className={`mb-0.5 w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected === s.key
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Preview — pinned to the top of the panel */}
          <section className="flex min-w-0 flex-1 flex-col bg-gray-50 p-4 sm:p-5 lg:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-gray-700">{selectedLabel}</span>
              {draft && (
                <div className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5">
                  <button
                    onClick={() => setShowDraft(false)}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      !showDraft ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Published
                  </button>
                  <button
                    onClick={() => setShowDraft(true)}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      showDraft ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Draft
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                style={
                  orientation === "portrait"
                    ? { width: "min(100%, 300px)", aspectRatio: "9 / 16" }
                    : { width: "100%", aspectRatio: "16 / 9" }
                }
              >
                <CustomPreview
                  key={`${selected}-${orientation}-${showDraft && draft ? draft.version_id : "published"}`}
                  orientation={orientation}
                  scenesOnly
                  theme={template.theme as never}
                  name={template.name}
                  introCode={previewCodes.intro}
                  outroCode={previewCodes.outro}
                  contentCodes={previewCodes.content}
                  contentArchetypeIds={previewArchetypes}
                  logoUrls={template.logo_urls}
                  ogImage={template.og_image}
                  showLoaderOnEmptyOrError
                />
              </div>
            </div>

            {isOutro && (
              <p className="mt-2 text-[11px] text-gray-500">
                The outro renders with the call-to-action overlay in the final video; this
                preview shows the underlying scene.
              </p>
            )}
          </section>

          {/* Controls */}
          {/* Below `lg` this follows the preview in the stacked column, which is
              already its DOM order — so "prompt under the preview" needs only
              the border/width to move rather than a reorder. */}
          <aside className="flex shrink-0 flex-col border-t border-gray-100 p-4 sm:p-5 lg:w-80 lg:border-t-0 lg:border-l">
            <>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Describe the change
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={busy}
                  rows={5}
                  maxLength={2000}
                  placeholder="e.g. Make this a full-bleed image with the headline in the lower left and a section number top right"
                  className="mb-3 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-gray-50"
                />
                <label className="mb-4 flex items-start gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={keepGeometry}
                    onChange={(e) => setKeepGeometry(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5 accent-violet-600"
                  />
                  Keep the current layout (change details only)
                </label>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={busy || !prompt.trim()}
                  className="mb-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Working…" : "Regenerate this scene"}
                </button>

                {busy && (
                  <p className="mb-3 text-xs text-gray-500">
                    This usually takes a minute or two.
                  </p>
                )}

                {error && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                    <svg className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{success}</span>
                  </div>
                )}

                {draft && (
                  <div className="mt-auto rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <p className="mb-3 text-xs text-violet-800">
                      A draft is ready. It won't affect your videos until you apply it.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleApply()}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => void handleDiscard()}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
            </>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
