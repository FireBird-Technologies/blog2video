import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import SceneGroupAccordion from "./SceneGroupAccordion";
import {
  previewInitialReviewAI,
  previewInitialReviewNarration,
  getValidLayouts,
  type InitialScriptReviewScene,
  type LayoutInfo,
  type Project,
  type ScriptReviewDraftScene,
} from "../api/client";
import { refreshBlogUrlFormVideoStyles } from "../api/blogUrlFormStep2Prefetch";

type SyncState = "ready" | "stale" | "pending" | "updated" | "error";

interface Props {
  open: boolean;
  project: Project;
  saving?: boolean;
  onSave: (
    scenes: InitialScriptReviewScene[],
    reportSaved: (learning: "queued" | "unchanged") => void,
  ) => Promise<void>;
  /** Called when the user dismisses the post-save confirmation screen. Resumes
   *  the pipeline / navigates away — kept separate from onSave so the
   *  confirmation stays on screen until the user is ready, not on a timer. */
  onDone: () => void;
}

function detailFromError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function InitialScriptReviewModal({ open, project, saving, onSave, onDone }: Props) {
  const [drafts, setDrafts] = useState<InitialScriptReviewScene[]>([]);
  const draftsRef = useRef<InitialScriptReviewScene[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedGroupIndex, setExpandedGroupIndex] = useState<number | null>(0);
  const [sync, setSync] = useState<Record<number, SyncState>>({});
  const [instructions, setInstructions] = useState<Record<number, string>>({});
  const [applyingAI, setApplyingAI] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learningResult, setLearningResult] = useState<"queued" | "unchanged" | null>(null);
  const [pinnedStyleName, setPinnedStyleName] = useState<string | null>(null);
  const controllers = useRef<Record<number, AbortController>>({});
  const revisions = useRef<Record<number, number>>({});
  const updatedTimers = useRef<Record<number, number>>({});
  const pinnedStyleFetch = useRef<Promise<void> | null>(null);

  const replaceDrafts = (next: InitialScriptReviewScene[]) => {
    draftsRef.current = next;
    setDrafts(next);
  };

  useEffect(() => {
    if (!open) return;
    const initial = [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .map((scene) => ({
        id: scene.id,
        title: scene.title || "",
        narration_text: scene.narration_text || "",
        display_text: scene.display_text ?? "",
        preferred_layout: scene.preferred_layout ?? null,
        source_fingerprint: null,
        accepted_ai_instructions: [],
      }));
    replaceDrafts(initial);
    setSync(Object.fromEntries(initial.map((scene) => [scene.id, "ready"])));
    setSelectedId(null);
    setExpandedGroupIndex(0);
    setAiOpen(false);
    setInstructions({});
    setError(null);
    setLearningResult(null);
    setPinnedStyleName(null);
    return () => {
      Object.values(controllers.current).forEach((controller) => controller.abort());
      Object.values(updatedTimers.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, [open, project.id]);

  // Resolve the learning-merge target as soon as the review opens, so it's
  // normally already known well before the user clicks "Save all". submit()
  // also awaits this promise directly (see below) so a fast save can never
  // render the confirmation before this has actually settled.
  useEffect(() => {
    if (!open) return;
    let active = true;
    pinnedStyleFetch.current = refreshBlogUrlFormVideoStyles()
      .then((data) => {
        if (!active) return;
        const pinnedId = data.pinned_target || "your_style";
        const name = pinnedId === "your_style"
          ? "Your Style"
          : data.styles.find((style) => style.id === pinnedId)?.name || "Your Style";
        setPinnedStyleName(name);
      })
      .catch(() => { if (active) setPinnedStyleName(null); });
    return () => { active = false; };
  }, [open, project.id]);

  const showUpdatedThenReady = (sceneId: number) => {
    window.clearTimeout(updatedTimers.current[sceneId]);
    setSync((current) => ({ ...current, [sceneId]: "updated" }));
    updatedTimers.current[sceneId] = window.setTimeout(() => {
      setSync((current) => current[sceneId] === "updated"
        ? { ...current, [sceneId]: "ready" }
        : current);
      delete updatedTimers.current[sceneId];
    }, 1200);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    getValidLayouts(project.id)
      .then((response) => { if (active) setLayouts(response.data); })
      .catch(() => { if (active) setLayouts(null); });
    return () => { active = false; };
  }, [open, project.id]);

  const asContext = (values: InitialScriptReviewScene[]): ScriptReviewDraftScene[] => values.map((scene) => ({
    id: scene.id,
    title: scene.title,
    display_text: scene.display_text,
    narration_text: scene.narration_text,
  }));

  const requestNarration = async (sceneId: number, revision: number, values: InitialScriptReviewScene[]) => {
    const scene = values.find((item) => item.id === sceneId);
    if (!scene || !scene.title.trim() || !(scene.display_text || "").trim()) {
      setSync((current) => ({ ...current, [sceneId]: "error" }));
      return false;
    }
    controllers.current[sceneId]?.abort();
    const controller = new AbortController();
    controllers.current[sceneId] = controller;
    try {
      const response = await previewInitialReviewNarration(project.id, sceneId, {
        title: scene.title,
        display_text: scene.display_text || "",
        narration_text: scene.narration_text,
        draft_scenes: asContext(values),
        revision,
      }, controller.signal);
      if (revisions.current[sceneId] !== response.data.revision) return false;
      replaceDrafts(draftsRef.current.map((item) => item.id === sceneId ? {
        ...item,
        title: response.data.title,
        display_text: response.data.display_text,
        narration_text: response.data.narration_text,
        source_fingerprint: response.data.source_fingerprint,
      } : item));
      showUpdatedThenReady(sceneId);
      return true;
    } catch (requestError) {
      if (controller.signal.aborted) return false;
      setSync((current) => ({ ...current, [sceneId]: "error" }));
      setError(detailFromError(requestError, "Narration could not be updated. Try again before saving."));
      return false;
    }
  };

  const editText = (sceneId: number, patch: Partial<Pick<InitialScriptReviewScene, "title" | "display_text">>) => {
    window.clearTimeout(updatedTimers.current[sceneId]);
    delete updatedTimers.current[sceneId];
    const next = draftsRef.current.map((scene) => scene.id === sceneId
      ? { ...scene, ...patch, source_fingerprint: null, accepted_ai_instructions: [] }
      : scene);
    replaceDrafts(next);
    setError(null);
    setSync((current) => ({ ...current, [sceneId]: "stale" }));
    revisions.current[sceneId] = (revisions.current[sceneId] || 0) + 1;
  };

  const editLayout = (sceneId: number, preferredLayout: string) => {
    replaceDrafts(draftsRef.current.map((scene) => scene.id === sceneId
      ? { ...scene, preferred_layout: preferredLayout }
      : scene));
  };

  const applyAI = async () => {
    if (selectedId == null || applyingAI) return;
    const instruction = (instructions[selectedId] || "").trim();
    const scene = draftsRef.current.find((item) => item.id === selectedId);
    if (!scene || !instruction) return;
    controllers.current[selectedId]?.abort();
    revisions.current[selectedId] = (revisions.current[selectedId] || 0) + 1;
    const revision = revisions.current[selectedId];
    setApplyingAI(true);
    setSync((current) => ({ ...current, [selectedId]: "pending" }));
    setError(null);
    try {
      const response = await previewInitialReviewAI(project.id, selectedId, {
        title: scene.title,
        display_text: scene.display_text || "",
        narration_text: scene.narration_text,
        instruction,
        draft_scenes: asContext(draftsRef.current),
        revision,
      });
      if (revisions.current[selectedId] !== response.data.revision) return;
      replaceDrafts(draftsRef.current.map((item) => item.id === selectedId ? {
        ...item,
        title: response.data.title,
        display_text: response.data.display_text,
        narration_text: response.data.narration_text,
        source_fingerprint: response.data.source_fingerprint,
        accepted_ai_instructions: [...(item.accepted_ai_instructions || []), instruction],
      } : item));
      setInstructions((current) => ({ ...current, [selectedId]: "" }));
      showUpdatedThenReady(selectedId);
    } catch (requestError) {
      setSync((current) => ({ ...current, [selectedId]: "error" }));
      setError(detailFromError(requestError, "The AI edit could not be applied. Try again."));
    } finally {
      setApplyingAI(false);
    }
  };

  const cancelSelectedScene = () => {
    if (selectedId == null) return;
    const sceneId = selectedId;
    controllers.current[sceneId]?.abort();
    window.clearTimeout(updatedTimers.current[sceneId]);
    delete updatedTimers.current[sceneId];
    const original = project.scenes.find((item) => item.id === sceneId);
    if (original) {
      replaceDrafts(draftsRef.current.map((item) => item.id === sceneId ? {
        ...item,
        title: original.title || "",
        narration_text: original.narration_text || "",
        display_text: original.display_text ?? "",
        preferred_layout: original.preferred_layout ?? null,
        source_fingerprint: null,
        accepted_ai_instructions: [],
      } : item));
    }
    setSync((current) => ({ ...current, [sceneId]: "ready" }));
    setInstructions((current) => ({ ...current, [sceneId]: "" }));
    setAiOpen(false);
    setError(null);
    setSelectedId(null);
  };

  const saveSelectedScene = async () => {
    if (!selected || applyingAI) return;
    const state = sync[selected.id];
    if (state === "updated") return;
    if (state === "ready") {
      setSelectedId(null);
      return;
    }
    revisions.current[selected.id] = (revisions.current[selected.id] || 0) + 1;
    const revision = revisions.current[selected.id];
    setSync((current) => ({ ...current, [selected.id]: "pending" }));
    setError(null);
    await requestNarration(selected.id, revision, draftsRef.current);
  };

  const selected = drafts.find((scene) => scene.id === selectedId) || null;
  const cardScenes = useMemo(() => project.scenes.filter(
    (scene) => scene.preferred_layout !== "docreel_countdown"
  ).map((scene) => {
    const draft = drafts.find((item) => item.id === scene.id);
    return draft ? {
      ...scene,
      title: draft.title,
      display_text: draft.display_text,
      narration_text: draft.narration_text,
      preferred_layout: draft.preferred_layout,
    } : scene;
  }), [project.scenes, drafts]);
  const cardSceneNumbers = useMemo(
    () => new Map(cardScenes.map((scene, index) => [scene.id, index + 1])),
    [cardScenes],
  );
  const unsettled = Object.values(sync).some((state) => !["ready", "updated"].includes(state));
  const invalid = drafts.length === 0 || drafts.some((scene) => {
    const original = project.scenes.find((item) => item.id === scene.id);
    const systemCountdown = original?.preferred_layout === "docreel_countdown";
    return (!systemCountdown && !scene.title.trim())
      || (!systemCountdown && !(scene.display_text || "").trim())
      || !scene.narration_text.trim()
      || scene.title.length > 255;
  });

  const submit = async () => {
    if (invalid || unsettled || saving) return;
    setError(null);
    try {
      let learningOutcome: "queued" | "unchanged" | null = null;
      await onSave(drafts, (learning) => { learningOutcome = learning; });
      // Guarantee the pinned-style fetch from modal-open has actually settled
      // before the confirmation renders — normally already true by the time
      // the user finishes reviewing, but a very fast save could otherwise
      // briefly show the nameless fallback text before it flips to the name.
      await pinnedStyleFetch.current;
      setLearningResult(learningOutcome);
    } catch (submitError) {
      setError(detailFromError(submitError, "Could not save the reviewed script. Please try again."));
    }
  };

  // Checked before `open` so a transient prop flip (e.g. a project refresh
  // racing the save) can never yank the confirmation off screen before the
  // user clicks Done — this screen is intentionally sticky once shown.
  if (learningResult !== null) {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-6" role="status" aria-live="polite">
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white px-7 py-8 text-center shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {pinnedStyleName ? `Preferences saved in "${pinnedStyleName}"` : "Your preferences are updated"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            We'll use your latest edits to personalize future scripts.
          </p>
          <button
            type="button"
            onClick={() => {
              // The reset effect only clears this on open=true transitions, so
              // Done must clear it directly — otherwise this screen, which is
              // intentionally sticky against `open` flips, never goes away.
              setLearningResult(null);
              setPinnedStyleName(null);
              onDone();
            }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Done
          </button>
        </div>
      </div>,
      document.body,
    );
  }
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <header className="shrink-0 border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-900">Review the complete script</h2>
          <p className="mt-0.5 text-sm text-gray-500">Edit the title, display text, layout, or script direction directly in each scene.</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <SceneGroupAccordion
              items={cardScenes}
              getOrder={(scene) => cardSceneNumbers.get(scene.id) || scene.order}
              expandedGroupIndex={expandedGroupIndex}
              onToggleGroup={(groupIndex) => {
                if (selectedId !== null) return;
                setExpandedGroupIndex((current) => current === groupIndex ? null : groupIndex);
              }}
              maxHeightClassName="max-h-none"
              renderGroupBody={(groupScenes) => (
                <>
            {groupScenes.map((scene) => {
              const draft = drafts.find((item) => item.id === scene.id);
              if (!draft) return null;
              const editing = selectedId === scene.id;
              const layoutOptions = layouts?.selectable_layouts || layouts?.layouts || [];
              const layoutName = layouts?.layout_names[draft.preferred_layout || ""] || (draft.preferred_layout || "Layout").replace(/_/g, " ");
              return (
                <article key={scene.id} className={`rounded-2xl border bg-white px-5 py-4 shadow-sm transition-colors sm:px-6 ${editing ? "border-purple-300 ring-2 ring-purple-100" : "border-gray-200"}`}>
                  {editing && (
                    <div className="mb-3 flex justify-end">
                      <button type="button" onClick={() => setAiOpen((current) => !current)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-purple-200 px-3 text-xs font-semibold text-purple-600 hover:bg-purple-50">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.8 3.4L11 7l3.6 1.2L11 9.4 9.8 13 8.6 9.4 5 8.2 8.6 7l1.2-3.6zM17 12l.9 2.6 2.6.9-2.6.9L17 19l-.9-2.6-2.6-.9 2.6-.9L17 12z" /></svg>
                        AI edit
                      </button>
                    </div>
                  )}

                  {editing && aiOpen && (
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <textarea rows={2} value={instructions[scene.id] || ""} onChange={(event) => setInstructions((current) => ({ ...current, [scene.id]: event.target.value }))} placeholder="Describe the change you want…" className="min-h-14 flex-1 resize-y rounded-none border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400 hover:border-gray-400 focus:border-purple-500 focus:ring-0" />
                      <button type="button" onClick={() => void applyAI()} disabled={applyingAI || !(instructions[scene.id] || "").trim()} className="h-10 shrink-0 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-purple-300">{applyingAI ? "Applying…" : "Apply AI"}</button>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Scene {cardSceneNumbers.get(scene.id) || scene.order}</p>
                      {editing ? (
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-gray-500">Title</span>
                          <input maxLength={255} value={draft.title} onChange={(event) => editText(scene.id, { title: event.target.value })} className="w-full border-0 border-b border-gray-300 bg-transparent px-0 py-1.5 text-base text-gray-900 outline-none focus:border-purple-500 focus:ring-0" />
                        </label>
                      ) : <h3 className="text-base font-semibold text-gray-900">{draft.title}</h3>}
                    </div>
                    {!editing ? (
                      <button type="button" disabled={selectedId !== null || saving} onClick={() => { setSelectedId(scene.id); setAiOpen(false); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-40">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.732-6.732a2.5 2.5 0 113.536 3.536L12.5 14.572 8 16l1-5zM5 19h14" /></svg>
                        Edit
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3">
                    {editing ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-gray-500">Display text</span>
                        <textarea rows={2} value={draft.display_text || ""} onChange={(event) => editText(scene.id, { display_text: event.target.value })} className="w-full resize-y border-0 border-b border-gray-300 bg-transparent px-0 py-1.5 text-sm leading-6 text-gray-800 outline-none focus:border-purple-500 focus:ring-0" />
                      </label>
                    ) : (
                      <div><p className="mb-1 text-xs font-semibold text-gray-400">Display text</p><p className="text-sm leading-6 text-gray-700">{draft.display_text}</p></div>
                    )}

                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-gray-400">Scene script</p>
                        {editing && sync[scene.id] === "stale" && <span className="text-xs text-amber-600">Updates when changes are saved</span>}
                        {editing && sync[scene.id] === "pending" && <span className="text-xs font-medium text-purple-600">Updating script…</span>}
                        {editing && sync[scene.id] === "updated" && <span className="text-xs font-semibold text-emerald-600">Script updated</span>}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">{draft.narration_text}</p>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-3">
                      {editing ? (
                        <label className="min-w-48">
                          <span className="mb-1 block text-xs font-semibold text-gray-500">Layout</span>
                          <select value={draft.preferred_layout || ""} onChange={(event) => editLayout(scene.id, event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100">
                            {draft.preferred_layout && !layoutOptions.includes(draft.preferred_layout) && <option value={draft.preferred_layout}>{layoutName}</option>}
                            {layoutOptions.map((layout) => <option key={layout} value={layout}>{layouts?.layout_names[layout] || layout.replace(/_/g, " ")}</option>)}
                          </select>
                        </label>
                      ) : (
                        <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500">{layoutName}</span>
                      )}

                      {editing && (
                        <div className="ml-auto flex items-center gap-2">
                          {sync[scene.id] !== "updated" && (
                            <button
                              type="button"
                              onClick={cancelSelectedScene}
                              disabled={sync[scene.id] === "pending"}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          )}
                          {sync[scene.id] !== "updated" && (
                            <button
                              type="button"
                              onClick={() => void saveSelectedScene()}
                              disabled={applyingAI || sync[scene.id] === "pending" || !draft.title.trim() || !(draft.display_text || "").trim()}
                              className="inline-flex h-9 min-w-28 items-center justify-center rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
                            >
                              {sync[scene.id] === "pending" ? "Updating…" : sync[scene.id] === "ready" ? "Done" : "Save changes"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {editing && error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                  </div>
                </article>
              );
            })}
                </>
              )}
            />
          </div>
        </div>

        <footer className="shrink-0 border-t border-gray-200 bg-white px-5 py-4 sm:px-6">
          {!selected && error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          {unsettled && <p className="mb-2 text-xs text-amber-600">Wait until every changed scene has an updated narration.</p>}
          <div className="flex justify-end"><button type="button" onClick={submit} disabled={selectedId !== null || invalid || unsettled || saving}
            className="inline-flex min-w-40 items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : "Save all & continue"}
          </button></div>
        </footer>
      </div>
    </div>, document.body,
  );
}
