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
  getSceneDrafts,
  getSceneEditStatus,
  setSceneFontDefaults,
  updateCustomTemplate,
  type CustomTemplateItem,
  type SceneDraft,
} from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";
import { useAuth } from "../hooks/useAuth";
import { formatAiEditCreditsDisplay } from "../lib/formatAiEditCredits";
import { preloadBabel } from "../utils/compileComponent";
import { blend, isDarkColor, readableOn } from "./remotion/generated/kit/theme";
import { USER_BANDS } from "./remotion/generated/kit";
import {
  FONT_OPTIONS,
  fontIdFromName,
  resolveFontFamily,
  type FontId,
} from "../fonts/registry";

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
  /** Whether this scene's design takes an image. `undefined` = unknown (a
   *  template generated before design docs carried the flag), which renders no
   *  badge at all rather than an assertion we cannot back up. */
  supportsImage?: boolean;
}

/** Per-scene image capability, keyed the same way the scene list is.
 *
 * Read straight off `design_blueprint.scenes`, which is the source
 * `build_custom_meta` itself derives `layouts_without_image` from — so this
 * badge and the image controls the project view shows cannot disagree.
 *
 * Indexed by ROLE and content position, not by raw array index: the blueprint
 * array is ordered intro → content… → outro, and reading it positionally would
 * mislabel every scene the moment a template has no intro or no outro.
 */
function imageCapabilityByKey(
  designBlueprint: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const raw = (designBlueprint as { scenes?: unknown } | null | undefined)?.scenes;
  if (!Array.isArray(raw)) return out;

  let contentIdx = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const scene = entry as { role?: unknown; supports_image?: unknown };
    if (typeof scene.supports_image !== "boolean") continue;
    if (scene.role === "intro") out.intro = scene.supports_image;
    else if (scene.role === "outro") out.outro = scene.supports_image;
    else out[`content_${contentIdx++}`] = scene.supports_image;
  }
  return out;
}

/** The "whole template" pseudo-scene. Not a real scene key, so every code path
 *  that regenerates or drafts a scene must exclude it. */
const ALL_SCENES = "__all__";

/** Credits one AI scene edit costs. MUST match SCENE_AI_EDIT_CREDIT_COST in
 *  backend/app/routers/custom_templates.py — this copy only drives what the
 *  modal SAYS and whether the button is enabled; the server is what charges. */
const SCENE_AI_EDIT_CREDIT_COST = 1;

export default function TemplateSceneEditor({ template, onClose, onTemplateUpdated }: Props) {
  const contentCodes = useMemo(() => template.content_codes ?? [], [template.content_codes]);

  const scenes: SceneEntry[] = useMemo(() => {
    const archetypeLabel = (i: number): string => {
      const raw = template.content_archetype_ids?.[i];
      const id = typeof raw === "string" ? raw : raw?.id;
      if (!id) return `Content ${i + 1}`;
      return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const capability = imageCapabilityByKey(template.design_blueprint);
    return [
      // Plays the whole template, so the modal opens on the finished thing
      // rather than on one scene in isolation. Per-scene AI editing is gated
      // off this key — there is no single scene to regenerate here.
      { key: ALL_SCENES, label: "All scenes" },
      { key: "intro", label: "Intro", supportsImage: capability.intro },
      ...contentCodes.map((_, i) => ({
        key: `content_${i}`,
        label: archetypeLabel(i),
        supportsImage: capability[`content_${i}`],
      })),
      { key: "outro", label: "Outro", supportsImage: capability.outro },
    ];
  }, [contentCodes, template.content_archetype_ids, template.design_blueprint]);

  const [selected, setSelected] = useState<string>(ALL_SCENES);
  const [prompt, setPrompt] = useState("");
  /* WHICH scene is being regenerated, not merely whether one is.
   *
   * This was a single global boolean, so starting a retry on one faulty scene
   * disabled the retry control on EVERY faulty scene at once (a whole column
   * greying together reads as "it is retrying all of them"), and the spinner
   * was keyed on `selected` — so picking a different scene mid-run moved the
   * spinner onto a scene that was not being retried.
   *
   * Now a SET, not one key: an edit keeps running on the backend after the user
   * navigates to another scene, and the left column has to keep showing it. */
  const [runningScenes, setRunningScenes] = useState<Set<string>>(new Set());
  /** Scene keys with a pending draft. Drives the green dot and the per-scene
   *  edit lock, and is seeded for the whole template by one call on open. */
  const [draftScenes, setDraftScenes] = useState<Set<string>>(new Set());
  const isRunning = useCallback(
    (key: string) => runningScenes.has(key),
    [runningScenes],
  );
  const markRunning = useCallback((key: string, on: boolean) => {
    setRunningScenes((prev) => {
      if (prev.has(key) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const markDrafted = useCallback((key: string, on: boolean) => {
    setDraftScenes((prev) => {
      if (prev.has(key) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const selectedHasDraft = selected !== ALL_SCENES && draftScenes.has(selected);
  /** A scene with a pending draft is read-only until the draft is applied or
   *  discarded — otherwise a font-size edit would be saved against code the
   *  user is still deciding whether to keep. Only THIS scene locks; the rest of
   *  the template stays editable. */
  const sceneLocked = selectedHasDraft;
  /** Every scene awaiting an apply/discard decision. Saving is blocked until
   *  this is empty — see the note above the Save button. */
  const pendingDraftScenes = useMemo(
    () => scenes.filter((s) => s.key !== ALL_SCENES && draftScenes.has(s.key)),
    [scenes, draftScenes],
  );
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
  /** The "Edit with AI" prompt modal, opened from beside the scene name. */
  const [aiOpen, setAiOpen] = useState(false);

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
  // No `name` state: the template is renamed from the gallery, not here. The
  // PUT treats `name` as optional, so omitting it leaves the stored name alone.
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
  // ONE typeface for the whole template, written to both the heading and body
  // slots. The renderer keeps two separate font props (and always will — the
  // generated scenes bind them independently), but exposing both here asked the
  // user to make a typographic pairing decision the template does not need: two
  // controls that are the same value in almost every case, and easy to leave
  // mismatched by accident.
  //
  // Seeded through fontIdFromName because a template's stored font is whatever
  // the theme extractor guessed ("Cormorant Garamond") and is often NOT a
  // registry id — a <select> seeded with such a value would show a blank option
  // and, worse, silently write it back on save. Anything unresolvable starts
  // from the renderer's own default instead, which is what that template is
  // already rendering with. Heading is read first since it is the more visible
  // of the two.
  const [fontFamily, setFontFamily] = useState<FontId>(
    () =>
      fontIdFromName(template.theme.fonts?.heading) ??
      fontIdFromName(template.theme.fonts?.body) ??
      "dm_sans",
  );
  /**
   * Pending per-scene type-size edits, keyed `<sceneKey>:<orientation>`.
   *
   * Held here rather than written straight through so the slider previews LIVE
   * (previewFontSizes below feeds the preview) while nothing persists until
   * "Save changes" — the same pending-edit shape the colours and the typeface
   * already use.
   */
  const [fontSizeEdits, setFontSizeEdits] = useState<
    Record<string, { title?: number; description?: number }>
  >({});
  const [savingTemplate, setSavingTemplate] = useState(false);

  /* Preview the EDITED theme, not the saved one, so colour changes show
   * immediately instead of only after a round-trip. CustomPreview already takes
   * `theme` as a prop, so this costs nothing. */
  /** This scene's stored default size for one axis, or undefined. */
  const storedFontSize = (
    sceneKey: string,
    axis: "title" | "description",
    o: "landscape" | "portrait",
  ): number | undefined => {
    const fd = template.scene_font_defaults;
    if (!fd) return undefined;
    let entry;
    if (sceneKey === "intro") entry = fd.intro;
    else if (sceneKey === "outro") entry = fd.outro;
    else {
      const m = /^content_(\d+)$/.exec(sceneKey);
      const list = fd.content;
      if (m && Array.isArray(list)) entry = list[Number(m[1])];
    }
    const v = (entry as Record<string, { landscape?: number; portrait?: number } | null> | null | undefined)?.[axis]?.[o];
    return typeof v === "number" && v > 0 ? v : undefined;
  };

  /** The size a slider shows: a pending edit first, else what is stored. */
  const currentFontSize = (
    sceneKey: string,
    axis: "title" | "description",
    o: "landscape" | "portrait",
  ): number | undefined =>
    fontSizeEdits[`${sceneKey}:${o}`]?.[axis] ?? storedFontSize(sceneKey, axis, o);

  /**
   * The defaults handed to the preview, with pending edits folded in — so a
   * slider updates the frame immediately without anything being saved.
   */
  const previewFontDefaults = useMemo(() => {
    const base = template.scene_font_defaults;
    if (!base && Object.keys(fontSizeEdits).length === 0) return base;
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(base ?? {}));
    for (const [key, edit] of Object.entries(fontSizeEdits)) {
      const [sceneKey, o] = key.split(":") as [string, "landscape" | "portrait"];
      let holder: Record<string, unknown>;
      if (sceneKey === "intro" || sceneKey === "outro") {
        holder = (clone[sceneKey] as Record<string, unknown>) ?? {};
        clone[sceneKey] = holder;
      } else {
        const m = /^content_(\d+)$/.exec(sceneKey);
        if (!m) continue;
        const list = (clone.content as Record<string, unknown>[]) ?? [];
        while (list.length <= Number(m[1])) list.push({});
        holder = list[Number(m[1])] ?? {};
        list[Number(m[1])] = holder;
        clone.content = list;
      }
      for (const axis of ["title", "description"] as const) {
        const v = edit[axis];
        if (typeof v !== "number") continue;
        const slot = (holder[axis] as Record<string, unknown>) ?? {};
        slot[o] = v;
        holder[axis] = slot;
      }
    }
    return clone as typeof base;
  }, [template.scene_font_defaults, fontSizeEdits]);

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
      // CustomPreview resolves these through cssFamilyFromName, so the picked
      // typeface previews live without a round trip. One choice fills both
      // slots — see the fontFamily state above.
      fonts: {
        ...template.theme.fonts,
        heading: fontFamily,
        body: fontFamily,
      },
    }),
    [template.theme, bgColor, textColor, accentColor, bgMode, bg2Color, fontFamily],
  );

  /* derivePalette pulls a second stop that crosses the light/dark divide back
   * toward bg until both ends admit the same text colour — measured, 49% of
   * unconstrained two-stop gradients admit none at all. Warn rather than let
   * the user pick a colour that silently renders as something else. */
  const bg2WillClamp =
    bgMode === "gradient" && readableOn(bg2Color) !== readableOn(bgColor);

  const templateDirty =
    Object.keys(fontSizeEdits).length > 0 ||
    bgColor !== template.theme.colors.bg ||
    textColor !== template.theme.colors.text ||
    accentColor !== template.theme.colors.accent ||
    bgMode !== (template.theme.colors.bg2 ? "gradient" : "solid") ||
    (bgMode === "gradient" && bg2Color !== template.theme.colors.bg2) ||
    // Compared against the NORMALISED stored value, matching how the state was
    // seeded. Comparing against the raw string would leave a template whose
    // stored font is an unresolvable extractor name permanently dirty, with a
    // Save button that never settles.
    //
    // Also dirty when the two stored slots DISAGREE: collapsing them to one
    // choice is itself a change worth saving, and without this a template that
    // arrived with a heading/body pair could never be normalised.
    fontFamily !==
      (fontIdFromName(template.theme.fonts?.heading) ??
        fontIdFromName(template.theme.fonts?.body) ??
        "dm_sans") ||
    fontIdFromName(template.theme.fonts?.heading) !==
      fontIdFromName(template.theme.fonts?.body);

  /** One poll per in-flight scene, keyed by scene key.
   *
   * This was a SINGLE interval ref, and `attachToEdit` began by clearing it. So
   * starting an edit on `intro` and then clicking `content_0` killed the intro
   * poll: the backend job carried on, but the UI forgot it existed and the row
   * showed no progress. A registry lets every running edit keep reporting, which
   * is what the per-scene status dot in the left column needs. */
  const pollsRef = useRef<
    Map<string, { timer: ReturnType<typeof setInterval>; startedAt: number }>
  >(new Map());
  const scenesRef = useRef<HTMLDivElement>(null);
  /** Synchronous double-click guard for apply/discard — see handleApply. */
  const applyingRef = useRef(false);
  /** `selected`, readable from inside a poll callback. The interval closes over
   *  its creation-time render, so reading `selected` directly there would see a
   *  stale value and write a finished draft onto the wrong scene. */
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    preloadBabel();
    const polls = pollsRef.current;
    return () => {
      polls.forEach((entry) => clearInterval(entry.timer));
      polls.clear();
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

  /** Stop polling ONE scene. Other in-flight scenes keep reporting. */
  const stopPolling = useCallback((sceneKey: string) => {
    const entry = pollsRef.current.get(sceneKey);
    if (entry) {
      clearInterval(entry.timer);
      pollsRef.current.delete(sceneKey);
    }
  }, []);

  // Load the draft for the selected scene, when the summary says it has one.
  //
  // `draftScenes` (seeded for the whole template on open) replaces what used to
  // be a per-scene "already checked, it 404s" cache: we now know up front which
  // scenes have drafts, so a scene without one never fires a request at all.
  //
  // Keyed on the SCENE, not on `template`: applying a draft hands back a new
  // template object, and depending on it re-ran this effect on every apply —
  // firing a redundant GET and resetting `draft` to null via the clear below.
  useEffect(() => {
    // ALL_SCENES is not a scene — asking the backend for its draft would 404 on
    // a route that never existed. It is also the DEFAULT selection.
    if (selected === ALL_SCENES || !selectedHasDraft) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setDraft(null);
    getSceneDraft(template.id, selected)
      .then((res) => {
        if (cancelled) return;
        setDraft(res.data);
        // Arriving at a scene flagged with a draft must SHOW that draft — it is
        // the whole point of the flag. Only the poll used to set this, and under
        // the registry the poll runs for the scene that finished, not the one
        // being viewed.
        setShowDraft(true);
      })
      .catch(() => {
        // Gone (applied or discarded elsewhere) — drop the stale flag so the
        // dot and the edit lock clear too.
        if (!cancelled) markDrafted(selected, false);
      });
    return () => {
      cancelled = true;
    };
    // Depends on the SELECTED scene's flag, not the whole set: keying on the set
    // would refetch this scene's draft every time any other scene's flag moved.
  }, [template.id, selected, selectedHasDraft, markDrafted]);

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
      // Already watching this scene. Both the open-time re-attach and a 409
      // ("already regenerating") can target the same scene, and React's
      // StrictMode double-invokes effects in dev — without this guard each
      // would add a second interval polling the same job.
      if (pollsRef.current.has(sceneKey)) return;
      markRunning(sceneKey, true);
      const startedAt = Date.now();
      /** The finished/failed scene may no longer be the one on screen. Anything
       *  that writes to the single-scene preview state must check first. */
      const isOnScreen = () => selectedRef.current === sceneKey;
      const label =
        scenes.find((s) => s.key === sceneKey)?.label ?? sceneKey;
      const finish = () => {
        stopPolling(sceneKey);
        markRunning(sceneKey, false);
      };
      const timer = setInterval(async () => {
        try {
          const status = await getSceneEditStatus(template.id, sceneKey, editId);
          if (status.data.status === "complete") {
            finish();
            // The dot in the left column is driven by this, for every scene.
            markDrafted(sceneKey, true);
            // A pending draft supersedes any unsaved font-size tweak on this
            // scene: the scene is about to be locked, so leaving the edit behind
            // would keep the template permanently dirty AND write font defaults
            // against code the user has not accepted.
            setFontSizeEdits((prev) => {
              const next = { ...prev };
              delete next[`${sceneKey}:landscape`];
              delete next[`${sceneKey}:portrait`];
              return next;
            });
            if (isOnScreen()) {
              // Only fetch when it is being viewed — otherwise the flag above is
              // enough, and the draft-load effect fetches on navigation.
              const d = await getSceneDraft(template.id, sceneKey);
              setDraft(d.data);
              setShowDraft(true);
              setPrompt("");
            }
          } else if (status.data.status === "error") {
            finish();
            // `error` is already plain language for an exhausted retry; the raw
            // validator trace stays on `detail` for support. Name the scene when
            // it is not the one on screen — a background failure that says
            // nothing about WHICH scene failed is worse than a slightly
            // out-of-context banner.
            const msg =
              status.data.error || "The edit failed. Try rephrasing your request.";
            setError(isOnScreen() ? msg : `${label}: ${msg}`);
            setErrorDetail(status.data.detail ?? null);
            setErrorSticky(Boolean(status.data.exhausted));
          } else if (status.data.status === "unknown") {
            // Nothing is running and no draft exists — the job is gone (a server
            // restart, most likely). Stop rather than polling a dead id forever.
            finish();
          } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            finish();
            setError(
              `${isOnScreen() ? "The edit" : label} is taking longer than expected. Check back shortly.`,
            );
          }
        } catch {
          finish();
          setError("Lost contact with the server while editing.");
        }
      }, POLL_MS);
      pollsRef.current.set(sceneKey, { timer, startedAt });
    },
    // stopPolling/markRunning/markDrafted are stable useCallbacks.
    [template.id, stopPolling, markRunning, markDrafted, scenes],
  );

  /* On open, learn the draft and in-flight state of EVERY scene at once.
   *
   * Two jobs in one request. It seeds the per-scene status dots, and it
   * re-attaches to edits still running from a previous session — without which
   * closing and reopening the modal lost all trace of an in-flight job, leaving
   * the row idle and inviting a duplicate.
   *
   * This replaces a per-scene re-attach keyed on the selection, which could only
   * ever recover the ONE scene the user happened to be looking at.
   *
   * If it fails the editor still opens, but it reports the failure rather than
   * starting up silently blind to every pending draft — see the catch below. */
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSceneDrafts(template.id);
        if (cancelled) return;
        setDraftScenes(new Set(data.drafts ?? []));
        // No edit_id: the backend resolves the newest live job per scene.
        (data.running ?? []).forEach((key) => attachToEdit(key));
      } catch (err: any) {
        if (cancelled) return;
        // SAY SO. This used to swallow every failure on the theory that "the
        // editor still works, it just starts with no status dots" — but a lost
        // status dot is not cosmetic: `draftScenes` is what gates the draft
        // banner, the Apply/Discard controls and the per-scene edit lock. A
        // failure here therefore renders a pending draft INVISIBLE, and the user
        // sees a scene that silently refuses to accept a new edit ("already
        // being regenerated") with nothing on screen explaining why.
        //
        // Sticky, because it does not resolve itself: reopening the editor runs
        // the same request again.
        const status = err?.response?.status;
        setError(
          status === 401 || status === 403
            ? "Your session expired — sign in again to see pending scene drafts."
            : "Couldn't load pending scene drafts. Any draft you have is safe; reopen the editor to try again.",
        );
        setErrorSticky(true);
      }
    })();
    return () => {
      cancelled = true;
      // RELEASE THE ONE-SHOT, or StrictMode eats the only fetch.
      //
      // React 18 dev double-invokes effects: run -> cleanup -> run. Without this
      // line the first run claimed the ref and started the request, the cleanup
      // set `cancelled`, and the second run hit `didInitRef.current === true`
      // and returned without fetching. The in-flight response then arrived,
      // saw `cancelled`, and was dropped before setDraftScenes — so the request
      // succeeded in the Network tab while `draftScenes` stayed empty forever,
      // and a pending draft was invisible no matter how often the page reloaded.
      //
      // Resetting here lets the second invocation re-run and keep its result.
      // The ref still does its real job: it stops the effect re-firing when
      // `attachToEdit` changes identity (it closes over `scenes`, which is a new
      // array on every template update).
      didInitRef.current = false;
    };
  }, [template.id, attachToEdit]);

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
    // Scoped to THIS scene: another scene regenerating in the background is no
    // reason to refuse. A pending draft is, though — the user has to resolve it
    // before overwriting it with a new edit.
    if (isRunning(sceneKey) || draftScenes.has(sceneKey) || sceneKey === ALL_SCENES) return;
    if (!text && !fromBlueprint) return;
    // Regenerating a scene the user is not looking at would drop them into a
    // draft for something else, so move the view first.
    if (sceneKey !== selected) setSelected(sceneKey);
    markRunning(sceneKey, true);
    setError(null);
    setErrorDetail(null);
    setErrorSticky(false);
    setSuccess(null);

    try {
      const { data } = await aiEditScene(template.id, sceneKey, {
        prompt: fromBlueprint ? "" : text,
        // Always a free rewrite. The "keep the current layout" opt-in used to be
        // offered here; it was removed from the modal, and false is the same
        // request the unticked box sent (and the backend's own default).
        keep_geometry: false,
        from_blueprint: fromBlueprint,
      });
      attachToEdit(sceneKey, data.edit_id);
      // The edit was charged server-side, so pull the new balance rather than
      // decrementing a local copy — a fallback scene costs nothing, and only the
      // server knows which rule applied.
      void refreshUser();
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
      // 403 is the out-of-credits gate. Its detail is written for the user, so
      // surface it verbatim — the generic message below would hide the one thing
      // they can act on. Sticky, because it needs a decision (upgrade/buy), not
      // a glance.
      if (status === 403) {
        setError(
          typeof detail === "string" && detail
            ? detail
            : "You don't have enough AI edit credits to edit this scene.",
        );
        setErrorSticky(true);
        markRunning(sceneKey, false);
        void refreshUser();
        return;
      }
      setError(
        status === 409
          ? "This template is being regenerated — try again shortly."
          : "Could not start the edit.",
      );
      markRunning(sceneKey, false);
    }
  };

  /* Save colours + type sizes. Entirely separate from the scene-draft flow below
   * — that writes scene CODE through the draft endpoints, this writes the THEME
   * through PUT /custom-templates/{id}. They never touch the same fields, which
   * is why both can live in one modal with independent save buttons. */
  const handleSaveTemplate = async () => {
    // Re-checked here, not just on the button: a pending draft means part of the
    // template is still undecided, and this call would write font defaults for a
    // scene whose code the user has not accepted.
    if (savingTemplate || pendingDraftScenes.length > 0) return;
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
        theme: {
          ...template.theme,
          colors: nextColors as typeof template.theme.colors,
          // Spread the rest of `fonts` so any extra keys the extractor stored
          // survive; the two the renderer reads both get the single choice.
          fonts: {
            ...template.theme.fonts,
            heading: fontFamily,
            body: fontFamily,
          },
        },
      });
      let latest = res.data;

      // Type sizes are per SCENE, so they go through their own endpoint rather
      // than the template-level PUT above. One request per edited scene, run in
      // sequence so each response builds on the last — they all rewrite the same
      // column, and firing them together would have the last write win.
      const bySceneKey = new Map<string, {
        title?: { landscape?: number; portrait?: number };
        description?: { landscape?: number; portrait?: number };
      }>();
      for (const [key, edit] of Object.entries(fontSizeEdits)) {
        const [sceneKey, o] = key.split(":") as [string, "landscape" | "portrait"];
        const body = bySceneKey.get(sceneKey) ?? {};
        if (typeof edit.title === "number") {
          body.title = { ...(body.title ?? {}), [o]: edit.title };
        }
        if (typeof edit.description === "number") {
          body.description = { ...(body.description ?? {}), [o]: edit.description };
        }
        bySceneKey.set(sceneKey, body);
      }
      for (const [sceneKey, body] of bySceneKey) {
        if (!body.title && !body.description) continue;
        latest = (await setSceneFontDefaults(template.id, sceneKey, body)).data;
      }
      // Cleared only after every write landed, so a failure mid-way leaves the
      // unsaved edits on screen rather than silently discarding them.
      setFontSizeEdits({});

      onTemplateUpdated(latest);
      setSuccess("Template saved.");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to save the template.");
    } finally {
      setSavingTemplate(false);
    }
  };


  const handleApply = async () => {
    // `applyingRef` (not `busy`) guards the double-click: state set here is not
    // visible to a second click dispatched in the same tick, so two apply calls
    // could race — the first consumes the draft, the second 404s and reports
    // "Could not apply the draft" even though the apply succeeded.
    if (!draft || isRunning(selected) || applyingRef.current) return;
    applyingRef.current = true;
    markRunning(selected, true);
    setError(null);
    try {
      const res = await applySceneDraft(template.id, selected);
      // Clear the draft only AFTER the new template is in hand, and in the same
      // commit. Clearing it up front made `previewCodes` fall back to
      // `template.*_code` — still the OLD code, since the parent had not yet
      // received the update — so the preview visibly reverted to the previous
      // version for the whole duration of the request, then snapped forward.
      onTemplateUpdated(res.data);
      // The draft is consumed server-side: clear the flag so the dot goes and
      // the scene becomes editable again.
      markDrafted(selected, false);
      setDraft(null);
      setSuccess("Scene applied — it's now live in this template.");
    } catch {
      setError("Could not apply the draft.");
    } finally {
      applyingRef.current = false;
      markRunning(selected, false);
    }
  };

  const handleDiscard = async () => {
    if (!draft || isRunning(selected) || applyingRef.current) return;
    applyingRef.current = true;
    markRunning(selected, true);
    // Cleared up front — unlike apply, reverting the preview to the published
    // code IS the intended outcome here, so showing it immediately is correct.
    setDraft(null);
    markDrafted(selected, false);
    try {
      await discardSceneDraft(template.id, selected);
      setSuccess("Draft discarded.");
    } catch {
      setDraft(draft);
      markDrafted(selected, true);
      setError("Could not discard the draft.");
    } finally {
      applyingRef.current = false;
      markRunning(selected, false);
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

  /* Sample copy + type sizes, SLICED to match `previewCodes`.
   *
   * Selecting one content scene hands CustomPreview a single-element
   * `content` array with no intro, so it computes contentIdx = 0 — and passing
   * the FULL arrays therefore fed it scene 0's copy and scene 0's sizes no
   * matter which scene was selected. That is why the editor and the gallery
   * card showed different text for the same scene.
   *
   * Same slicing rule as previewArchetypes above, and it must stay in step with
   * previewCodes: these three are all indexed against the same list. */
  const previewSlice = useMemo(() => {
    const samples = template.scene_sample_content;
    const fonts = previewFontDefaults;
    if (selected === ALL_SCENES) return { samples, fonts };
    if (selected === "intro") {
      return {
        samples: samples ? { intro: samples.intro, content: [] } : samples,
        fonts: fonts ? { intro: fonts.intro, content: [] } : fonts,
      };
    }
    if (selected === "outro") {
      return {
        samples: samples ? { outro: samples.outro, content: [] } : samples,
        fonts: fonts ? { outro: fonts.outro, content: [] } : fonts,
      };
    }
    const m = /^content_(\d+)$/.exec(selected);
    const idx = m ? Number(m[1]) : 0;
    return {
      samples: samples ? { content: [samples.content?.[idx] ?? null] } : samples,
      fonts: fonts ? { content: [fonts.content?.[idx] ?? null] } : fonts,
    };
  }, [selected, template.scene_sample_content, previewFontDefaults]);

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

  // What an AI edit of the SELECTED scene costs, mirroring the server rule in
  // custom_templates.ai_edit_scene: a fallback scene (one that failed generation
  // and shipped a stub) is free, everything else costs one credit.
  //
  // `warnedKeys` is derived from the same `Scene {i} (` warnings the backend
  // matches on, with the same index convention, so the two agree without a new
  // API field. A custom template is single-owner, so there is no collaborator
  // branch here — the acting user is always the payer.
  const { user, refreshUser } = useAuth();
  const aiEditCreditsRemaining =
    (user?.ai_edit_credits ?? 0) + (user?.ai_edit_allowance_remaining ?? 0);
  const selectedEditIsFree = selected !== ALL_SCENES && warnedKeys.has(selected);
  const selectedEditCost = selectedEditIsFree ? 0 : SCENE_AI_EDIT_CREDIT_COST;
  const canAffordSelectedEdit =
    selectedEditCost === 0 || aiEditCreditsRemaining >= selectedEditCost;
  // Only a LEGACY (v1) outro is replaced by GeneratedCtaOverlay at video time,
  // which is what made its generated code a mere fallback. A v2 outro composes
  // the CTA inside its own layout and is exactly what ships, so the caption
  // warning otherwise would now describe the opposite of what happens.
  const isOutro = selected === "outro";
  const isLegacyOutro =
    isOutro &&
    ((template.design_blueprint as { version?: number } | null)?.version ?? 1) < 2;
  // The scene currently on screen, for the per-scene notes under the preview.
  const selectedScene = scenes.find((s) => s.key === selected);

  /* One status marker, three places: the desktop rail, the mobile dropdown's
   * trigger and its option rows. Written once because the rail and the dropdown
   * have drifted apart before — the dropdown showed a bare label while the rail
   * carried the warning flag.
   *
   * Priority is deliberate. Regenerating is transient and outranks everything;
   * a ready draft needs a decision and outranks a warning, which is a standing
   * condition the user may have chosen to live with. */
  const SceneStatusDot = ({ sceneKey }: { sceneKey: string }) => {
    if (sceneKey === ALL_SCENES) return null;
    if (isRunning(sceneKey)) {
      return (
        <span
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
          title="Regenerating…"
          aria-label="Regenerating"
        />
      );
    }
    if (draftScenes.has(sceneKey)) {
      return (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
          title="A draft is ready — apply or discard it"
          aria-label="Draft ready"
        />
      );
    }
    if (warnedKeys.has(sceneKey)) {
      // Same amber the banner uses, so a chip up there and a row down here are
      // recognisably the same flag.
      return (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          title="This scene didn't generate cleanly"
          aria-hidden
        />
      );
    }
    return null;
  };

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
            <p className="hidden text-xs text-gray-500 sm:block">Colours, type and per-scene edits — all in one place.</p>
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
                  <SceneStatusDot sceneKey={selected} />
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
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          selected === s.key
                            ? "bg-violet-50/60 font-medium text-violet-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <SceneStatusDot sceneKey={s.key} />
                        <span className="truncate">{s.label}</span>
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
                      <SceneStatusDot sceneKey={s.key} />
                      <span className="truncate">{s.label}</span>
                      {/* Whether this scene's design takes an image.
                          Deliberately shown ONLY when the template's design docs
                          actually say — an older template with no flag renders
                          nothing rather than an unbacked claim. Videos made from
                          this template give images and clips only to the scenes
                          marked here, so it explains why some scenes never show
                          one. An icon rather than a word: the label beside it is
                          already truncated and a retry button shares the row. */}
                      {s.supportsImage !== undefined && (
                        <span
                          title={
                            s.supportsImage
                              ? "This scene takes an image or clip"
                              : "This scene is text-only — videos never place an image here"
                          }
                          aria-label={
                            s.supportsImage ? "Supports images" : "Does not support images"
                          }
                          className={`ml-auto shrink-0 ${
                            s.supportsImage ? "text-gray-400" : "text-gray-300"
                          }`}
                        >
                          {s.supportsImage ? (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 3l18 18M4 16l4.586-4.586a2 2 0 012.828 0L16 16M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </span>
                      )}
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
                        disabled={isRunning(s.key) || draftScenes.has(s.key)}
                        title={
                          draftScenes.has(s.key)
                            ? "Apply or discard this scene's draft first"
                            : "Retry this scene from the template's design"
                        }
                        aria-label={`Retry ${s.label}`}
                        className="mr-1.5 shrink-0 rounded-md p-1.5 text-violet-600 transition-colors hover:bg-violet-100 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg
                          className={`h-3.5 w-3.5 ${isRunning(s.key) ? "animate-spin" : ""}`}
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
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-gray-700">
                  {selectedLabel}
                </span>
                {draft && showDraft && (
                  <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    Draft
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {draft && (
                  <div className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5">
                    <button
                      onClick={() => setShowDraft(false)}
                      className={`rounded-md px-3 py-1 text-xs transition-colors ${
                        !showDraft ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50"
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
                {/* At the far right of the row, opposite the scene name — the
                    action is now visually paired with the Published/Draft
                    toggle it produces, rather than crowding the scene label.

                    While a draft is pending, this slot swaps to the decision
                    the user actually needs to make (Apply/Discard) instead of
                    offering to start ANOTHER edit on top of an undecided one. */}
                {selected !== ALL_SCENES && sceneLocked ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleApply()}
                      disabled={isRunning(selected)}
                      className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDiscard()}
                      disabled={isRunning(selected)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                ) : selected !== ALL_SCENES ? (
                  <button
                    type="button"
                    onClick={() => setAiOpen(true)}
                    disabled={isRunning(selected)}
                    title={isRunning(selected) ? "This scene is regenerating" : "Rewrite this scene with AI"}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    
                    Edit with AI
                  </button>
                ) : null}
              </div>
            </div>

            {draft && (
              <p className="mb-3 text-xs text-amber-600">
                A draft is ready — use Apply or Discard above. It won&rsquo;t affect
                your videos until you apply it.
              </p>
            )}

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
                  designVersion={(template.design_blueprint as { version?: number } | null)?.version}
                  sceneSampleContent={previewSlice.samples}
                  sceneFontDefaults={previewSlice.fonts}
                  // The sizes the user is dragging. A value here renders at
                  // exactly that number instead of being re-fitted to its box,
                  // so the slider keeps responding across its whole range.
                  fontSizeEdits={fontSizeEdits}
                  logoUrls={template.logo_urls}
                  ogImage={template.og_image}
                  showLoaderOnEmptyOrError
                />
              </div>
            </div>

            {selected !== ALL_SCENES && isRunning(selected) && (
              <p className="mt-2 flex items-center justify-center gap-2 text-xs text-violet-700">
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                Regenerating — this usually takes a minute or two.
              </p>
            )}

            {isLegacyOutro && (
              <p className="mt-2 text-[11px] text-gray-500">
                The outro renders with the call-to-action overlay in the final video; this
                preview shows the underlying scene.
              </p>
            )}

            {/* Why a scene never shows a photo. The image/clip assignment at
                video time is driven by exactly this flag, so stating it here is
                what stops "my images didn't appear" being a mystery. */}
            {selected !== ALL_SCENES && selectedScene?.supportsImage === false && (
              <p className="mt-2 text-[11px] text-gray-500">
                This scene is text-only by design — videos made from this template
                never place an image or clip here. Rewrite it below to change that.
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
                  disabled={isRunning(selected) || sceneLocked}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${isRunning(selected) ? "animate-spin" : ""}`}
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
                  {isRunning(selected) ? "Retrying…" : "Retry this scene"}
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
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Background
              </label>
              {/* Two equal columns rather than a hugging pill group: the two
                  modes are a single either/or choice, and equal halves read as
                  one control instead of two buttons that happen to sit side by
                  side. */}
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 p-0.5">
                {(["solid", "gradient"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBgMode(mode)}
                    aria-pressed={bgMode === mode}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
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
              {/* Three or four, decided by the background mode — bg/text/accent
                  are the only colours the renderer reads (colorsFromBrand), and
                  a gradient adds its second stop. panel, muted and border are
                  derived from these, so exposing those too would offer control
                  that nothing honours.

                  The grid follows that count: 4 sit as a 2x2, 3 as a single row,
                  so neither leaves a lone swatch stranded on its own line. */}
              <div
                className={`mb-1 grid justify-items-center gap-3 ${
                  bgMode === "gradient" ? "grid-cols-2" : "grid-cols-3"
                }`}
              >
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

              <label className="mb-2 mt-3 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Font Family
              </label>
              {/* ONE font for the whole template. Only the faces the renderer
                  can actually load are offered — anything outside this registry
                  resolves to null at render time and silently falls back to the
                  system sans, so a free-text field would offer control that
                  nothing honours. Each option previews in its own face. */}
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as FontId)}
                aria-label="Template typeface"
                className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                style={{ fontFamily: resolveFontFamily(fontFamily) ?? undefined }}
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} style={{ fontFamily: opt.cssFamily }}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <p className="mb-3 text-[10px] text-gray-400">
                Changes preview live; save to keep them. Videos made from this
                template use this font unless the project sets its own.
              </p>

              {/* Per-scene TYPE SIZE.
                  Only for a real scene — "All scenes" has no single size to
                  set — and only for the orientation currently selected above,
                  because portrait needs smaller type for the same copy and
                  showing four numbers at once invites setting them wrong. */}
              {selected !== ALL_SCENES && (
                <div className="mb-4">
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Type size — {orientation}
                  </label>
                  {([
                    ["Title", "title"],
                    ["Display text & content", "description"],
                  ] as const).map(([label, axis]) => {
                    const value = currentFontSize(selected, axis, orientation);
                    // The USER bands — what a person may set. Read from
                    // kit/typeBands.ts rather than written out here: these were
                    // literals, and they were the GENERATION bands, so the
                    // slider stopped at the ceiling the model is held to (88px
                    // on a landscape title) even though the render and the
                    // server accept far more. The server clamps to the same
                    // USER bands, so what is dragged is what is stored.
                    const [lo, hi] = USER_BANDS[axis][orientation];
                    return (
                      <div key={axis} className="mb-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">{label}</span>
                          <span className="text-[10px] font-medium text-violet-600">
                            {value ?? "—"}
                            {value === undefined && (
                              <span className="ml-1 text-gray-400">auto</span>
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={lo}
                          max={hi}
                          value={value ?? Math.round((lo + hi) / 2)}
                          disabled={sceneLocked}
                          onChange={(e) => {
                            // Guarded as well as disabled: the lock can arrive
                            // while the control is focused (a background edit
                            // finishing), and a keyboard drag would still fire.
                            if (sceneLocked) return;
                            const next = Number(e.target.value);
                            setFontSizeEdits((prev) => {
                              const key = `${selected}:${orientation}`;
                              return {
                                ...prev,
                                [key]: { ...(prev[key] ?? {}), [axis]: next },
                              };
                            });
                          }}
                          className="h-1.5 w-full cursor-pointer appearance-none bg-transparent accent-violet-600 disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-600 [&:disabled::-webkit-slider-thumb]:bg-gray-300 [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-600 [&:disabled::-moz-range-thumb]:bg-gray-300"
                          aria-label={`${label} size for ${orientation}`}
                        />
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-gray-400">
                    {sceneLocked
                      ? "This scene has a pending draft — apply or discard it to edit its type sizes."
                      : "Sized automatically from this scene’s copy. Drag to override — videos use these unless the scene sets its own."}
                  </p>
                </div>
              )}

              {/* Saving is blocked while any scene is mid-decision — the
                  reason surfaces on the button's own title rather than a
                  separate card, since the Apply/Discard action for a locked
                  scene is already visible at the top of its own preview. */}
              <button
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || !templateDirty || pendingDraftScenes.length > 0}
                title={
                  pendingDraftScenes.length > 0
                    ? "Apply or discard the pending scene drafts before saving."
                    : undefined
                }
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
                Pick a single scene on the left, then use “Edit with AI” beside the
                scene name to rewrite it.
              </div>
            ) : (
              <div className="flex flex-col border-t border-gray-100 pt-4">
                {/* The "regenerating" status lives under the preview, next to
                    the scene it describes; Apply/Discard for a ready draft
                    lives at the top of the preview, in the same spot "Edit
                    with AI" occupies otherwise — so this column only points
                    at those, rather than duplicating either. */}
                {!draft && !isRunning(selected) && (
                  <p className="text-xs text-gray-500">
                    Use “Edit with AI” beside the scene name to describe a change to
                    this scene.
                  </p>
                )}

                {draft && (
                  <p className="text-xs text-amber-600">
                    A draft is ready — use Apply or Discard above the preview. It
                    won&rsquo;t affect your videos until you apply it.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Both modals sit INSIDE this portal, above the editor's own z-50 — the
          editor is already the top layer, so a second portal would only add a
          stacking context to reason about. */}
      {aiOpen && selected !== ALL_SCENES && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAiOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              Edit “{selectedLabel}” with AI
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Describe the change. The scene keeps regenerating if you close this —
              watch the scene list for progress.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              maxLength={2000}
              autoFocus
              placeholder="e.g. Make this a full-bleed image with the headline in the lower left and a section number top right"
              className="mb-3 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <div className="mt-1 flex items-center gap-3">
              {/* Cost and balance, stated before the user commits. A fallback
                  scene is free — they should not pay to fix a scene we failed to
                  generate — and that is enforced server-side, not just here.
                  `min-w-0` so a long line wraps instead of shoving the buttons
                  out of the modal. */}
              <p className="min-w-0 flex-1 text-xs text-gray-400">
                {selectedEditIsFree ? (
                  <>
                    <span className="font-medium text-emerald-600">Free</span> —
                    this scene didn&rsquo;t generate cleanly.
                  </>
                ) : (
                  <>
                    Costs{" "}
                    <span className="font-medium text-gray-600">
                      {SCENE_AI_EDIT_CREDIT_COST} AI edit credit
                      {SCENE_AI_EDIT_CREDIT_COST === 1 ? "" : "s"}
                    </span>{" "}
                    · {formatAiEditCreditsDisplay(aiEditCreditsRemaining)} remaining
                    {!canAffordSelectedEdit && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-medium text-amber-600">
                          not enough credits
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Close immediately: the job runs in the background and the
                  // scene list carries the progress, so holding a spinner in a
                  // modal would only trap the user for a minute or more.
                  void startEdit();
                  setAiOpen(false);
                }}
                disabled={!prompt.trim() || isRunning(selected) || !canAffordSelectedEdit}
                className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply my change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
