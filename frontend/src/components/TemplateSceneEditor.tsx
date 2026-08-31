/**
 * The single edit modal for a custom template: name, colours, rating AND
 * per-scene AI editing.
 *
 * These were two modals — this one and CustomTemplateEditor — that unmounted
 * each other and handed back and forth. Because they wrote different fields,
 * switching ran a window.confirm that DISCARDED unsaved edits. Merging removes
 * both the round trip and the data loss; CustomTemplateEditor is gone.
 *
 * Scene editing: pick a scene -> describe the change -> the backend regenerates
 * that ONE scene into a DRAFT -> preview draft vs published side by side ->
 * apply or discard. The published template is never touched until Apply, so a
 * bad edit costs nothing.
 *
 * Preview needs no new render infrastructure: CustomPreview already compiles
 * scene code in the browser and takes the theme as a prop. Which scenes it is
 * given is the whole mechanism —
 *   - "All scenes" hands it everything, so it plays the finished template;
 *   - a single scene hands it just that code, making it a one-scene preview.
 * Colour edits preview live by passing the EDITED theme rather than the saved
 * one, so nothing has to be saved to be seen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  aiEditScene,
  applySceneDraft,
  discardSceneDraft,
  getSceneDraft,
  getSceneEditStatus,
  submitTemplateRating,
  updateCustomTemplate,
  type CustomTemplateItem,
  type SceneDraft,
} from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";
import TemplateStarRating from "./TemplateStarRating";
import { preloadBabel } from "../utils/compileComponent";
import { blend, isDarkColor, readableOn } from "./remotion/generated/kit/theme";

const POLL_MS = 2000;

/**
 * A sane starting second stop for a gradient, mirroring `_compute_bg2` in
 * backend/app/dspy_modules/theme_extractor.py: darken a light background,
 * lighten a dark one, both by roughly a tenth. Switching to Gradient then
 * begins from something on-brand rather than an arbitrary colour the user has
 * to fix before the control is useful.
 */
function deriveBg2(bg: string): string {
  return isDarkColor(bg) ? blend(bg, "#FFFFFF", 0.1) : blend(bg, "#000000", 0.12);
}
/** A scene edit is one scene, so it is far quicker than a regeneration — but
 *  still bounded so a hung job cannot poll forever. */
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

interface Props {
  template: CustomTemplateItem;
  onClose: () => void;
  onTemplateUpdated: (tpl: CustomTemplateItem) => void;
}

interface SceneEntry {
  key: string;
  label: string;
}

/** The "whole template" pseudo-scene. Not a real scene key, so every code path
 *  that regenerates or drafts a scene must exclude it. */
const ALL_SCENES = "__all__";

export default function TemplateSceneEditor({ template, onClose, onTemplateUpdated }: Props) {
  const contentCodes = useMemo(() => template.content_codes ?? [], [template.content_codes]);

  const scenes: SceneEntry[] = useMemo(() => {
    const archetypeLabel = (i: number): string => {
      const raw = template.content_archetype_ids?.[i];
      const id = typeof raw === "string" ? raw : raw?.id;
      if (!id) return `Content ${i + 1}`;
      return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };
    return [
      // Plays the whole template, so the modal opens on the finished thing
      // rather than on one scene in isolation. Per-scene AI editing is gated
      // off this key — there is no single scene to regenerate here.
      { key: ALL_SCENES, label: "All scenes" },
      { key: "intro", label: "Intro" },
      ...contentCodes.map((_, i) => ({ key: `content_${i}`, label: archetypeLabel(i) })),
      { key: "outro", label: "Outro" },
    ];
  }, [contentCodes, template.content_archetype_ids]);

  const [selected, setSelected] = useState<string>(ALL_SCENES);
  const [prompt, setPrompt] = useState("");
  const [keepGeometry, setKeepGeometry] = useState(false);
  /* WHICH scene is being regenerated, not merely whether one is.
   *
   * This was a single global boolean, so starting a retry on one faulty scene
   * disabled the retry control on EVERY faulty scene at once (a whole column
   * greying together reads as "it is retrying all of them"), and the spinner
   * was keyed on `selected` — so picking a different scene mid-run moved the
   * spinner onto a scene that was not being retried. */
  const [busyScene, setBusyScene] = useState<string | null>(null);
  const busy = busyScene !== null;
  const [error, setError] = useState<string | null>(null);
  /** Raw diagnostic behind `error`, shown only on hover — never rendered. */
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  /** An exhausted retry must NOT auto-dismiss: it is a terminal state the user
   *  has to read and act on, and the 3s timer wiped it off the screen. */
  const [errorSticky, setErrorSticky] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [showDraft, setShowDraft] = useState(true);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [scenesOpen, setScenesOpen] = useState(false);

  // ── Template-level fields, merged in from the old CustomTemplateEditor ──────
  //
  // These used to live in a SEPARATE modal that unmounted this one, so switching
  // between "rename / recolour" and "edit a scene" meant discarding unsaved work
  // (that editor ran a window.confirm to say so). One modal removes the choice.
  //
  // Only bg / text / accent are exposed. They are the only colours that reach
  // the renderer — colorsFromBrand() reads exactly these, and panel/muted/border
  // are DERIVED by derivePalette rather than stored. surface/muted stay in the
  // theme untouched, spread through on save.
  const [name, setName] = useState(template.name);
  const [bgColor, setBgColor] = useState(template.theme.colors.bg);
  const [textColor, setTextColor] = useState(template.theme.colors.text);
  const [accentColor, setAccentColor] = useState(template.theme.colors.accent);
  // Background mode. `colors.bg2` is the gradient's second stop and its presence
  // IS the mode — absent means solid. It used to be written only by the theme
  // extractor (when the extracted brand happened to list "gradients" among its
  // decorative elements), so a template that missed that check was solid forever
  // with no way to change it.
  const [bgMode, setBgMode] = useState<"solid" | "gradient">(
    template.theme.colors.bg2 ? "gradient" : "solid",
  );
  const [bg2Color, setBg2Color] = useState(
    template.theme.colors.bg2 ?? deriveBg2(template.theme.colors.bg),
  );
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(template.my_rating ?? null);
  const [myRatingComment, setMyRatingComment] = useState<string | null>(
    template.my_rating_comment ?? null,
  );
  const [ratingSaving, setRatingSaving] = useState(false);

  /* Preview the EDITED theme, not the saved one, so colour changes show
   * immediately instead of only after a round-trip. CustomPreview already takes
   * `theme` as a prop, so this costs nothing. */
  const previewTheme = useMemo(
    () => ({
      ...template.theme,
      colors: {
        ...template.theme.colors,
        bg: bgColor,
        text: textColor,
        accent: accentColor,
        // undefined here is what the kit reads as "solid" — backgroundCss()
        // only emits a linear-gradient when bg2 is set.
        bg2: bgMode === "gradient" ? bg2Color : undefined,
      },
    }),
    [template.theme, bgColor, textColor, accentColor, bgMode, bg2Color],
  );

  /* derivePalette pulls a second stop that crosses the light/dark divide back
   * toward bg until both ends admit the same text colour — measured, 49% of
   * unconstrained two-stop gradients admit none at all. Warn rather than let
   * the user pick a colour that silently renders as something else. */
  const bg2WillClamp =
    bgMode === "gradient" && readableOn(bg2Color) !== readableOn(bgColor);

  const templateDirty =
    name !== template.name ||
    bgColor !== template.theme.colors.bg ||
    textColor !== template.theme.colors.text ||
    accentColor !== template.theme.colors.accent ||
    bgMode !== (template.theme.colors.bg2 ? "gradient" : "solid") ||
    (bgMode === "gradient" && bg2Color !== template.theme.colors.bg2);

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
  // the Background Style dropdown the old template editor used.
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
    setErrorDetail(null);
    setErrorSticky(false);
    setSuccess(null);
  }, [selected]);

  // Auto-dismiss both banners after 3s. Keyed on the message itself, not just
  // presence, so a second error replacing a first restarts the countdown rather
  // than inheriting the old timer's remaining time.
  useEffect(() => {
    if (!error || errorSticky) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error, errorSticky]);

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
    // ALL_SCENES is not a scene — asking the backend for its draft would 404 on
    // a route that never existed. It is also the DEFAULT selection, so without
    // this every open of the modal fired one junk request.
    if (selected === ALL_SCENES) {
      setDraft(null);
      return;
    }
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

  /**
   * Poll a RUNNING edit through to its draft.
   *
   * Split out of startEdit because it has two callers now: a freshly-started
   * edit, and a re-attach — the modal reopening onto a retry that is already
   * running. The edit_id used to live only in startEdit's closure, so closing
   * the modal orphaned the job: the spinner reset and the user could start a
   * duplicate that raced the first for the same draft row.
   *
   * `editId` is optional. Without one the backend resolves the newest live job
   * for this scene, which is exactly the re-attach case.
   */
  const attachToEdit = useCallback(
    (sceneKey: string, editId?: string) => {
      stopPolling();
      setBusyScene(sceneKey);
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getSceneEditStatus(template.id, sceneKey, editId);
          if (status.data.status === "complete") {
            stopPolling();
            const d = await getSceneDraft(template.id, sceneKey);
            // This scene now HAS a draft — drop the "known empty" marker so
            // reselecting it later refetches instead of assuming 404.
            checkedRef.current.delete(`${template.id}:${sceneKey}`);
            setDraft(d.data);
            setShowDraft(true);
            setPrompt("");
            setBusyScene(null);
          } else if (status.data.status === "error") {
            stopPolling();
            // `error` is already plain language for an exhausted retry; the raw
            // validator trace stays on `detail` for support.
            setError(status.data.error || "The edit failed. Try rephrasing your request.");
            setErrorDetail(status.data.detail ?? null);
            setErrorSticky(Boolean(status.data.exhausted));
            setBusyScene(null);
          } else if (status.data.status === "unknown") {
            // Nothing is running and no draft exists — the job is gone (a server
            // restart, most likely). Stop rather than polling a dead id forever.
            stopPolling();
            setBusyScene(null);
          } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            stopPolling();
            setError("The edit is taking longer than expected. Check back shortly.");
            setBusyScene(null);
          }
        } catch {
          stopPolling();
          setError("Lost contact with the server while editing.");
          setBusyScene(null);
        }
      }, POLL_MS);
    },
    // stopPolling is a stable useCallback; template.id is the only real input.
    [template.id, stopPolling],
  );

  /* Re-attach on mount to a retry that is already running for this scene.
   *
   * Without this, closing and reopening the modal lost all trace of an in-flight
   * job: the spinner reset to idle and the retry button re-enabled, inviting a
   * duplicate. The backend now answers "what is running for this scene?" with no
   * edit_id, which is what makes recovery possible. */
  useEffect(() => {
    if (selected === ALL_SCENES) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSceneEditStatus(template.id, selected);
        if (cancelled || !data.running) return;
        attachToEdit(selected, data.edit_id);
      } catch {
        // No running job, or the lookup failed — nothing to resume.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.id, selected, attachToEdit]);

  /**
   * Start a scene edit and poll it to a draft.
   *
   * Two callers with one body: a user-written prompt, and a blueprint REBUILD
   * for a scene that fell back to a stub. The rebuild sends no prompt — the
   * backend re-derives the scene from its stored blueprint layout — but the
   * queue, poll, draft and apply path after that is identical, so duplicating
   * it would mean two copies of the timeout and error handling to keep in step.
   */
  const startEdit = async (opts?: { fromBlueprint?: boolean; sceneKey?: string }) => {
    const fromBlueprint = opts?.fromBlueprint ?? false;
    const sceneKey = opts?.sceneKey ?? selected;
    const text = prompt.trim();
    // ALL_SCENES has no scene to regenerate. The UI hides these controls there,
    // so reaching it means a bug — fail quietly rather than POSTing "__all__".
    if (busy || sceneKey === ALL_SCENES) return;
    if (!text && !fromBlueprint) return;
    // Regenerating a scene the user is not looking at would drop them into a
    // draft for something else, so move the view first.
    if (sceneKey !== selected) setSelected(sceneKey);
    setBusyScene(sceneKey);
    setError(null);
    setErrorDetail(null);
    setErrorSticky(false);
    setSuccess(null);
    stopPolling();

    try {
      const { data } = await aiEditScene(template.id, sceneKey, {
        prompt: fromBlueprint ? "" : text,
        keep_geometry: fromBlueprint ? false : keepGeometry,
        from_blueprint: fromBlueprint,
      });
      attachToEdit(sceneKey, data.edit_id);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      // 409 with an edit_id means an edit for THIS scene is already running —
      // a duplicate click, or a retry started before the modal was closed.
      // Attach to it rather than reporting a failure: the work the user asked
      // for is in progress, which is what they wanted.
      if (status === 409 && detail && typeof detail === "object" && detail.edit_id) {
        attachToEdit(sceneKey, detail.edit_id as string);
        return;
      }
      setError(
        status === 409
          ? "This template is being regenerated — try again shortly."
          : "Could not start the edit.",
      );
      setBusyScene(null);
    }
  };

  /* Save name + colours. Entirely separate from the scene-draft flow below —
   * that writes scene CODE through the draft endpoints, this writes the THEME
   * through PUT /custom-templates/{id}. They never touch the same fields, which
   * is why both can live in one modal with independent save buttons. */
  const handleSaveTemplate = async () => {
    if (!name.trim() || savingTemplate) return;
    setSavingTemplate(true);
    setError(null);
    try {
      // Spread the existing colours so surface / muted survive untouched — they
      // are no longer shown, but the theme still carries them.
      const nextColors: Record<string, unknown> = {
        ...template.theme.colors,
        bg: bgColor,
        text: textColor,
        accent: accentColor,
      };
      // Solid is the ABSENCE of bg2, so delete the key outright rather than
      // setting it to undefined — the theme is round-tripped as JSON and an
      // explicit delete is what makes "switch back to solid" actually stick.
      if (bgMode === "gradient") {
        nextColors.bg2 = bg2Color;
      } else {
        delete nextColors.bg2;
      }
      const res = await updateCustomTemplate(template.id, {
        name: name.trim(),
        theme: {
          ...template.theme,
          colors: nextColors as typeof template.theme.colors,
        },
      });
      onTemplateUpdated(res.data);
      setSuccess("Template saved.");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to save the template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRate = async (rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
    const prevRating = myRating;
    const prevComment = myRatingComment;
    const nextComment = comment ?? prevComment ?? null;
    setMyRating(rating);
    setMyRatingComment(nextComment);
    setRatingSaving(true);
    try {
      await submitTemplateRating(template.id, { rating, suggestion: comment });
      onTemplateUpdated({ ...template, my_rating: rating, my_rating_comment: nextComment });
    } catch (err) {
      console.error("Failed to rate template:", err);
      setMyRating(prevRating);
      setMyRatingComment(prevComment);
    } finally {
      setRatingSaving(false);
    }
  };

  const handleApply = async () => {
    // `applyingRef` (not `busy`) guards the double-click: state set here is not
    // visible to a second click dispatched in the same tick, so two apply calls
    // could race — the first consumes the draft, the second 404s and reports
    // "Could not apply the draft" even though the apply succeeded.
    if (!draft || busy || applyingRef.current) return;
    applyingRef.current = true;
    setBusyScene(selected);
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
      setBusyScene(null);
    }
  };

  const handleDiscard = async () => {
    if (!draft || busy || applyingRef.current) return;
    applyingRef.current = true;
    setBusyScene(selected);
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
      setBusyScene(null);
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
    // Whole template: hand CustomPreview everything and let it cycle, which is
    // the behaviour it has by default.
    if (selected === ALL_SCENES) {
      return {
        intro: template.intro_code ?? undefined,
        outro: template.outro_code ?? undefined,
        content: contentCodes,
      };
    }
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
    // All-scenes mode passes the FULL list — the codes are index-matched to it,
    // so handing over one entry (or none) would feed every scene the wrong
    // sample content.
    if (selected === ALL_SCENES) return template.content_archetype_ids ?? undefined;
    const m = /^content_(\d+)$/.exec(selected);
    if (!m) return undefined;
    const entry = template.content_archetype_ids?.[Number(m[1])];
    return entry ? [entry] : undefined;
  }, [selected, template.content_archetype_ids]);

  /* Which scenes the generator flagged, resolved from the warning text.
   *
   * The banner used to say "1 scene used a simplified fallback design" without
   * naming it, which left the user to guess. Warnings are authored as
   * `Scene {i} ({label}) ...` where `i` is the position in the generated batch —
   * intro is 0, content scenes are 1..N, outro is last — so the key is
   * recoverable without a backend change.
   *
   * Anything that does not parse is kept as an unattributed message rather than
   * dropped: a warning we cannot place is still a warning worth showing.
   */
  const { warnedKeys, warningsByKey, unattributedWarnings } = useMemo(() => {
    const byKey = new Map<string, string[]>();
    const loose: string[] = [];
    for (const w of template.generation_warnings ?? []) {
      const m = /^Scene (\d+) \(/.exec(String(w));
      if (!m) {
        loose.push(String(w));
        continue;
      }
      const idx = Number(m[1]);
      const key =
        idx === 0
          ? "intro"
          : idx === contentCodes.length + 1
            ? "outro"
            : `content_${idx - 1}`;
      byKey.set(key, [...(byKey.get(key) ?? []), String(w)]);
    }
    return {
      warnedKeys: new Set(byKey.keys()),
      warningsByKey: byKey,
      unattributedWarnings: loose,
    };
  }, [template.generation_warnings, contentCodes.length]);

  const warnings = template.generation_warnings ?? [];
  const selectedLabel = scenes.find((s) => s.key === selected)?.label ?? selected;
  const selectedWarnings = warningsByKey.get(selected) ?? [];
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
              Edit template — {template.name}
            </h2>
            <p className="hidden text-xs text-gray-500 sm:block">Name, colours and per-scene edits — all in one place.</p>
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
          // Name the flagged scenes and make each one a jump link. Saying only
          // "1 scene used a simplified fallback design" left the user to hunt
          // for which. Each chip selects that scene, and the entry in the list
          // carries the same amber dot so the two read as the same thing.
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-amber-100 bg-amber-50 px-6 py-2 text-xs text-amber-800">
            <span>
              {warnedKeys.size > 0 ? (
                <>
                  {warnedKeys.size} scene{warnedKeys.size > 1 ? "s" : ""} used a simplified
                  fallback design:
                </>
              ) : (
                <>This template reported a generation problem.</>
              )}
            </span>
            {scenes
              .filter((s) => warnedKeys.has(s.key))
              .map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected(s.key)}
                  title={(warningsByKey.get(s.key) ?? []).join("\n\n")}
                  className={`rounded-full border px-2 py-0.5 font-medium transition-colors ${
                    selected === s.key
                      ? "border-amber-400 bg-amber-200 text-amber-900"
                      : "border-amber-200 bg-white/70 text-amber-800 hover:bg-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            <span className="text-amber-700">
              Regenerating {warnedKeys.size > 1 ? "them" : "it"} here is the quickest way to fix that.
            </span>
            {unattributedWarnings.length > 0 && (
              <span className="w-full text-amber-700" title={unattributedWarnings.join("\n\n")}>
                {unattributedWarnings.length} further warning
                {unattributedWarnings.length > 1 ? "s" : ""} could not be traced to a scene.
              </span>
            )}
          </div>
        )}

        {/* Three columns side by side on desktop; stacked and scrolled as one
            column below `lg`, where 52+preview+80 cannot fit without clipping
            the prompt panel off-screen. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Scene list */}
          {/* Left column: format switch above the scene list */}
          <nav className="flex shrink-0 flex-col border-b border-gray-100 p-3 lg:w-52 lg:overflow-y-auto lg:border-b-0 lg:border-r">
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

            {/* Desktop: the full vertical list. "All scenes" is separated by a
                rule — it plays the whole template rather than selecting one
                scene, so it should not read as just another scene. */}
            <div className="hidden lg:block">
              {scenes.map((s) => (
                <div key={s.key}>
                  <div
                    className={`mb-0.5 flex items-center rounded-lg transition-colors ${
                      selected === s.key ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => setSelected(s.key)}
                      className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm ${
                        selected === s.key ? "font-medium text-violet-700" : "text-gray-700"
                      }`}
                    >
                      {/* Same amber the banner uses, so a chip up there and a
                          row down here are recognisably the same flag. */}
                      {warnedKeys.has(s.key) && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      )}
                      <span className="truncate">{s.label}</span>
                    </button>
                    {/* One-click rebuild for a scene that fell back to a stub.
                        The generator's error is a pipeline internal ("palette.text
                        is used as BOTH a background and a text colour") that the
                        user can neither read nor act on — so offer the action
                        instead of the diagnostic. */}
                    {warnedKeys.has(s.key) && (
                      <button
                        type="button"
                        onClick={() => void startEdit({ fromBlueprint: true, sceneKey: s.key })}
                        disabled={busy}
                        title="Retry this scene from the template's design"
                        aria-label={`Retry ${s.label}`}
                        className="mr-1.5 shrink-0 rounded-md p-1.5 text-violet-600 transition-colors hover:bg-violet-100 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg
                          className={`h-3.5 w-3.5 ${busyScene === s.key ? "animate-spin" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {s.key === ALL_SCENES && <div className="my-1.5 border-t border-gray-100" />}
                </div>
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
                  theme={previewTheme as never}
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

            {/* Sits under the PREVIEW, not in the controls column: it is a
                statement about the thing on screen, and the fix is one click
                rather than something to describe.
                The raw warning is a pipeline diagnostic — "palette.text is used
                as BOTH a background and a text colour", a validator trace. It
                tells the user nothing they can act on, so it stays on the title
                attribute for support and is replaced here by plain language. */}
            {selectedWarnings.length > 0 && (
              <div
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                title={selectedWarnings.join("\n\n")}
              >
                <p className="min-w-0 flex-1">
                  This scene didn't generate cleanly and is showing a simplified fallback
                  design. Retry it from the template's design, or describe the change you
                  want on the right.
                </p>
                <button
                  type="button"
                  onClick={() => void startEdit({ fromBlueprint: true })}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${busyScene === selected ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {busyScene === selected ? "Retrying…" : "Retry this scene"}
                </button>
              </div>
            )}

            {/* A retry produces a DRAFT — nothing is published, and the warning
                above stays until it is applied. Saying so here prevents the
                reading that the retry silently did nothing. */}
            {draft && selectedWarnings.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                A new version is ready — use Apply on the right to publish it and clear
                this warning.
              </p>
            )}
            {/* Outcome banners sit under the PREVIEW, not in the controls
                column. They report on the scene on screen — a failed retry, an
                applied draft, a saved rename — and putting them in the far
                column left the message visually detached from the thing it was
                about. */}
            {error && (
              <div
                className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                // The raw diagnostic is kept for support but never rendered —
                // it is a validator trace the user cannot act on.
                title={errorDetail ?? undefined}
              >
                {error}
              </div>
            )}
            {success && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                <svg className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{success}</span>
              </div>
            )}
          </section>

          {/* Controls */}
          {/* Below `lg` this follows the preview in the stacked column, which is
              already its DOM order — so "prompt under the preview" needs only
              the border/width to move rather than a reorder. */}
          <aside className="flex shrink-0 flex-col overflow-y-auto border-t border-gray-100 p-4 sm:p-5 lg:w-80 lg:border-t-0 lg:border-l">
            {/* Template-level fields. Merged in from the old separate modal, so
                a rename or a recolour no longer costs a round trip through
                another view — and no longer discards unsaved scene work. */}
            <div className="mb-5">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Template name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />

              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Background
              </label>
              <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5">
                {(["solid", "gradient"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBgMode(mode)}
                    aria-pressed={bgMode === mode}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                      bgMode === mode
                        ? "bg-violet-600 text-white"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Colours
              </label>
              {/* Exactly three: these are the only colours the renderer reads
                  (colorsFromBrand takes bg/text/accent). panel, muted and border
                  are derived from them, so exposing those too would offer
                  control that nothing honours. */}
              <div className="mb-1 flex items-center gap-4">
                {([
                  ["Background", bgColor, setBgColor],
                  ...(bgMode === "gradient"
                    ? ([["Gradient end", bg2Color, setBg2Color]] as const)
                    : []),
                  ["Text", textColor, setTextColor],
                  ["Accent", accentColor, setAccentColor],
                ] as const).map(([label, value, set]) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <label className="relative cursor-pointer">
                      <div
                        className="h-8 w-8 rounded-full border-2 border-gray-200 shadow-sm"
                        style={{ backgroundColor: value }}
                      />
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={label}
                      />
                    </label>
                    <span className="text-[10px] text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
              {bg2WillClamp && (
                <p className="mb-1 text-[10px] text-amber-600">
                  This gradient end sits on the other side of the light/dark divide from
                  the background, so it will be pulled toward the background colour to
                  keep text readable across the whole ramp.
                </p>
              )}
              <p className="mb-3 text-[10px] text-gray-400">
                Changes preview live; save to keep them.
              </p>

              <div className="mb-4">
                <TemplateStarRating
                  value={myRating}
                  comment={myRatingComment}
                  onRate={handleRate}
                  disabled={ratingSaving}
                  size={20}
                  showLabel
                  allowComment
                />
              </div>

              <button
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || !templateDirty || !name.trim()}
                className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingTemplate ? "Saving…" : "Save changes"}
              </button>
            </div>

            {/* Per-scene AI editing. Hidden in All-scenes mode: there is no one
                scene to regenerate, and offering the prompt there would beg the
                question of which scene it applied to. */}
            {selected === ALL_SCENES ? (
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-500">
                Pick a single scene on the left to rewrite it with AI.
              </div>
            ) : (
              <div className="flex flex-col border-t border-gray-100 pt-4">
                {/* What actually went wrong with THIS scene. The banner says
                    which scenes are flagged; this says why, at the point where
                    the user is about to describe a fix. */}
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
                  onClick={() => void startEdit()}
                  disabled={busy || !prompt.trim()}
                  className="mb-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {/* Distinct from the Retry control under the preview: that one
                      rebuilds from the blueprint, this applies the user's own
                      instruction. Same label for both read as one action. */}
                  {busy ? "Processing…" : "Apply my change"}
                </button>

                {busy && (
                  <p className="mb-3 text-xs text-gray-500">
                    This usually takes a minute or two.
                  </p>
                )}

                {draft && (
                  // Sits directly under the regenerate button rather than being
                  // pushed to the bottom of the sidebar with `mt-auto`: the
                  // draft is the result of the action just taken, and parking
                  // its Apply/Discard a screen away from that action left a
                  // large empty gap between the two.
                  //
                  // Unboxed — no border or fill — so it reads as inline copy
                  // under that action rather than a separate callout. The amber
                  // text is what marks it as a pending state needing a decision.
                  <div className="px-1">
                    <p className="mb-3 text-xs text-amber-600">
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
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
