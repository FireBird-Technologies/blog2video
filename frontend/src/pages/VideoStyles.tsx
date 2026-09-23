import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  createCustomVideoStyle,
  deleteCustomVideoStyle,
  deleteYourVideoStyle,
  generateVideoStyleDraft,
  resetBuiltinVideoStyle,
  setPinnedVideoStyle,
  updateBuiltinVideoStyle,
  updateCustomVideoStyle,
  updateVideoStyleSelection,
  updateYourVideoStyle,
  type ManagedVideoStyle,
} from "../api/client";
import {
  fetchBlogUrlFormVideoStylesDeduped,
  invalidateBlogUrlFormVideoStylesCache,
  refreshBlogUrlFormVideoStyles,
  setCachedBlogUrlFormVideoStyles,
} from "../api/blogUrlFormStep2Prefetch";
import { VIDEO_STYLE_OPTIONS, type VideoStyleId } from "../constants/videoStyles";
import { getErrorMessage, useErrorModal } from "../contexts/ErrorModalContext";
import { useAuth } from "../hooks/useAuth";
import VoiceItem from "../components/VoiceItem";

type EditorMode = "manual" | "ai";

const DEFAULT_STYLE_IDS: VideoStyleId[] = ["explainer", "storytelling", "promotional"];
const DEFAULT_BUILTIN_STYLES: ManagedVideoStyle[] = VIDEO_STYLE_OPTIONS
  .filter((style) => DEFAULT_STYLE_IDS.includes(style.id))
  .map((style) => ({
    id: style.id,
    name: style.label,
    guidance: style.subtitle,
    kind: "builtin",
    editable: false,
    available: true,
  }));

function withDefaultBuiltins(styles: ManagedVideoStyle[]): ManagedVideoStyle[] {
  const byId = new Map(styles.map((style) => [style.id, style]));
  return [
    ...DEFAULT_BUILTIN_STYLES.map((fallback) => byId.get(fallback.id) || fallback),
    ...styles.filter((style) => !DEFAULT_STYLE_IDS.includes(style.id)),
  ];
}

function stylePreview(style: ManagedVideoStyle): string {
  const guidance = (style.guidance || "").trim();
  if (!guidance) return "No guidance saved yet. Edit this style to add your preferences.";
  const points = guidance.split(/\r?\n/).map((point) => point.trim()).filter(Boolean);
  if (points.length <= 1) return guidance;
  return `${points[0].replace(/^[-*•]\s*/, "")} ...`;
}

function VideoStyleIcon({ personalized }: { personalized: boolean }) {
  if (personalized) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="7.5" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20.5a6.5 6.5 0 0 1 9.7-5.7M13 21l.6-3.1 5.9-5.9a1.4 1.4 0 0 1 2 2l-5.9 5.9L13 21Zm4.9-7.4 2 2" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M8 7v13M12 5v15M16 6l4 14M2 20h20" />
    </svg>
  );
}

interface VideoStylesProps {
  pendingSaveName: string | null;
  onPendingSaveNameChange: (name: string | null) => void;
  pendingDelete: { id: VideoStyleId; name: string } | null;
  onPendingDeleteChange: (pending: { id: VideoStyleId; name: string } | null) => void;
}

export default function VideoStyles({
  pendingSaveName,
  onPendingSaveNameChange,
  pendingDelete,
  onPendingDeleteChange,
}: VideoStylesProps) {
  const { showError } = useErrorModal();
  const { refreshUser } = useAuth();
  const [styles, setStyles] = useState<ManagedVideoStyle[]>(DEFAULT_BUILTIN_STYLES);
  const [selected, setSelected] = useState<VideoStyleId[]>(DEFAULT_STYLE_IDS);
  const [maxSelected, setMaxSelected] = useState(9);
  const [minSelected, setMinSelected] = useState(3);
  const [autoStyle, setAutoStyle] = useState<{ id: "auto"; name: string; description: string }>({
    id: "auto",
    name: "Auto",
    description: "AI picks based on the article",
  });
  const [yourStyleVersion, setYourStyleVersion] = useState(0);
  const [pinnedTarget, setPinnedTarget] = useState<VideoStyleId>("your_style");
  const [pinning, setPinning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("manual");
  const [editing, setEditing] = useState<ManagedVideoStyle | null>(null);
  const [name, setName] = useState("");
  const [guidance, setGuidance] = useState("");
  const [prompt, setPrompt] = useState("");
  const guidanceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previousPendingSaveNameRef = useRef<string | null>(pendingSaveName);
  const handledPendingCompletionRef = useRef(false);
  const previousPendingDeleteRef = useRef(pendingDelete);
  const handledDeleteCompletionRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pinTarget, setPinTarget] = useState<ManagedVideoStyle | null>(null);

  const load = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await (forceRefresh
        ? refreshBlogUrlFormVideoStyles()
        : fetchBlogUrlFormVideoStylesDeduped());
      const serverStyles = Array.isArray(data.styles) ? data.styles : [];
      const nextStyles = withDefaultBuiltins(serverStyles);
      const knownIds = new Set(nextStyles.map((style) => style.id));
      const serverSelection = Array.isArray(data.selected_ids)
        ? data.selected_ids.filter((id) => knownIds.has(id))
        : [];
      setStyles(nextStyles);
      setSelected(serverSelection.length ? serverSelection : DEFAULT_STYLE_IDS);
      setMaxSelected(data.max_selected || 9);
      setMinSelected(data.min_selected || 3);
      if (data.auto_style) setAutoStyle(data.auto_style);
      setYourStyleVersion(data.your_style_version || 0);
      setPinnedTarget(data.pinned_target || "your_style");
    } catch (error) {
      showError(getErrorMessage(error, "Could not load video styles."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const previousPendingName = previousPendingSaveNameRef.current;
    previousPendingSaveNameRef.current = pendingSaveName;
    if (!previousPendingName || pendingSaveName) return;
    if (handledPendingCompletionRef.current) {
      handledPendingCompletionRef.current = false;
      return;
    }
    // This instance mounted while a save started by the previous Video Styles
    // instance was still running. Refresh when it finishes so the persisted
    // style appears without requiring a page reload.
    void load(true);
  }, [pendingSaveName]);

  useEffect(() => {
    const previousPendingDelete = previousPendingDeleteRef.current;
    previousPendingDeleteRef.current = pendingDelete;
    if (!previousPendingDelete || pendingDelete) return;
    if (handledDeleteCompletionRef.current) {
      handledDeleteCompletionRef.current = false;
      return;
    }
    // If the user left this tab during deletion, this newly mounted instance
    // refreshes as soon as the request finishes so the deleted row disappears.
    void load(true);
  }, [pendingDelete]);

  useEffect(() => {
    const textarea = guidanceTextareaRef.current;
    if (!editorOpen || !textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editorOpen, guidance]);

  const orderedStyles = useMemo(() => {
    const yourStyle = styles.find((style) => style.kind === "learned");
    const customStyles = styles
      .filter((style) => style.kind === "custom")
      .sort((a, b) => {
        const createdAtDifference = Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
        if (Number.isFinite(createdAtDifference) && createdAtDifference !== 0) {
          return createdAtDifference;
        }
        return (b.custom_id || 0) - (a.custom_id || 0);
      });
    const builtins = styles.filter((style) => style.kind === "builtin");
    const rest = [...(yourStyle ? [yourStyle] : []), ...customStyles, ...builtins];
    const pinnedIndex = rest.findIndex((style) => style.id === pinnedTarget);
    if (pinnedIndex <= 0) return rest;
    const [pinned] = rest.splice(pinnedIndex, 1);
    return [pinned, ...rest];
  }, [styles, pinnedTarget]);

  const saveSelection = async (next: VideoStyleId[]) => {
    if (savingSelection) return;
    setSavingSelection(true);
    try {
      const response = await updateVideoStyleSelection(next);
      setSelected(response.data.selected_ids);
      setCachedBlogUrlFormVideoStyles({
        styles,
        selected_ids: response.data.selected_ids,
        auto_style: autoStyle,
        max_selected: response.data.max_selected,
        min_selected: response.data.min_selected,
        your_style_version: yourStyleVersion,
        pinned_target: pinnedTarget,
      });
    } catch (error) {
      showError(getErrorMessage(error, "Could not update the styles shown in Step 2."));
    } finally {
      setSavingSelection(false);
    }
  };

  const toggleSelected = (style: ManagedVideoStyle) => {
    if (selected.includes(style.id)) {
      if (selected.length <= minSelected) {
        showError(`At least ${minSelected} video styles must be saved`);
        return;
      }
      void saveSelection(selected.filter((id) => id !== style.id));
      return;
    }
    if (selected.length >= maxSelected) {
      showError(`You can save at most ${maxSelected} video styles.`);
      return;
    }
    if (style.available === false) {
      showError("Add guidance to Your Style before showing it in Step 2.");
      return;
    }
    void saveSelection([...selected, style.id]);
  };

  const openCreate = () => {
    setEditing(null);
    setEditorMode("ai");
    setName("");
    setGuidance("");
    setPrompt("");
    setEditorOpen(true);
  };

  const openEdit = (style: ManagedVideoStyle) => {
    setEditing(style);
    setEditorMode(style.kind === "learned" ? "manual" : style.creation_method || "manual");
    setName(style.name);
    setGuidance(style.guidance || "");
    setPrompt(style.source_prompt || "");
    setEditorOpen(true);
  };

  const generateDraft = async () => {
    if (prompt.trim().length < 20) return;
    setGenerating(true);
    try {
      const response = await generateVideoStyleDraft(prompt.trim());
      setName(response.data.name);
      setGuidance(response.data.guidance);
    } catch (error) {
      showError(getErrorMessage(error, "Could not generate this style. Try a more specific prompt."));
    } finally {
      setGenerating(false);
    }
  };

  const saveStyle = async () => {
    if (!guidance.trim() || ((!editing || editing.kind === "custom") && !name.trim())) return;
    setSaving(true);
    onPendingSaveNameChange(name.trim() || editing?.name || "Video style");
    setEditorOpen(false);
    let savedSuccessfully = false;
    try {
      let refreshAfterSave = true;
      if (editing?.kind === "learned") {
        await updateYourVideoStyle(guidance.trim(), yourStyleVersion);
      } else if (editing?.kind === "builtin") {
        await updateBuiltinVideoStyle(editing.id, guidance.trim(), editing.version || 0);
      } else if (editing?.kind === "custom" && editing.custom_id) {
        await updateCustomVideoStyle(editing.custom_id, {
          name: name.trim(), guidance: guidance.trim(),
          creation_method: editing.creation_method || editorMode,
          source_prompt: prompt.trim() || undefined,
        });
      } else {
        const response = await createCustomVideoStyle({
          name: name.trim(), guidance: guidance.trim(), creation_method: editorMode,
          source_prompt: editorMode === "ai" ? prompt.trim() : undefined,
        });
        const { selected_ids: selectedIds, ...createdStyle } = response.data;
        const nextStyles = [...styles, createdStyle];
        setStyles(nextStyles);
        setSelected(selectedIds);
        setCachedBlogUrlFormVideoStyles({
          styles: nextStyles,
          selected_ids: selectedIds,
          auto_style: autoStyle,
          max_selected: maxSelected,
          min_selected: minSelected,
          your_style_version: yourStyleVersion,
          pinned_target: pinnedTarget,
        });
        refreshAfterSave = false;
      }
      if (refreshAfterSave) await load(true);
      savedSuccessfully = true;
    } catch (error) {
      setEditorOpen(true);
      showError(getErrorMessage(error, "Could not save this video style."));
    } finally {
      if (savedSuccessfully) handledPendingCompletionRef.current = true;
      onPendingSaveNameChange(null);
      setSaving(false);
    }
  };

  const resetBuiltin = async () => {
    if (editing?.kind !== "builtin" || !editing.customized) return;
    setSaving(true);
    try {
      await resetBuiltinVideoStyle(editing.id);
      setEditorOpen(false);
      await load(true);
    } catch (error) {
      showError(getErrorMessage(error, "Could not reset this video style."));
    } finally {
      setSaving(false);
    }
  };

  const removeCustom = (style: ManagedVideoStyle) => {
    if (!style.custom_id) return;
    setDeleteTarget({
      title: `Delete “${style.name}”?`,
      description: "Existing projects will keep their saved copy.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        onPendingDeleteChange({ id: style.id, name: style.name });
        try {
          const response = await deleteCustomVideoStyle(style.custom_id!);
          const nextStyles = styles.filter((candidate) => candidate.id !== style.id);
          const selectedIds = response.data.selected_ids;
          const nextPinnedTarget = pinnedTarget === style.id ? "your_style" : pinnedTarget;
          setSelected(selectedIds);
          setPinnedTarget(nextPinnedTarget);
          setCachedBlogUrlFormVideoStyles({
            styles: nextStyles,
            selected_ids: selectedIds,
            auto_style: autoStyle,
            max_selected: maxSelected,
            min_selected: minSelected,
            your_style_version: yourStyleVersion,
            pinned_target: nextPinnedTarget,
          });
          handledDeleteCompletionRef.current = true;
        } finally {
          onPendingDeleteChange(null);
        }
      },
    });
  };

  const removeYourStyle = () => {
    setDeleteTarget({
      title: "Delete Your Style?",
      description: "This permanently erases what the app has learned from your edits. Existing projects will keep their saved copy, and a new profile will start building from future edits.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteYourVideoStyle();
        await Promise.all([load(true), refreshUser()]);
      },
    });
  };

  const requestPin = (style: ManagedVideoStyle) => {
    if (pinning || style.id === pinnedTarget) return;
    setPinTarget(style);
  };

  const confirmPin = async () => {
    if (!pinTarget) return;
    setPinning(true);
    try {
      const response = await setPinnedVideoStyle(pinTarget.id);
      setPinnedTarget(response.data.pinned_target);
      invalidateBlogUrlFormVideoStylesCache();
      setPinTarget(null);
    } catch (error) {
      showError(getErrorMessage(error, "Could not update your preferred style."));
    } finally {
      setPinning(false);
    }
  };

  const styleRow = (style: ManagedVideoStyle, canEdit = false) => {
    const active = selected.includes(style.id);
    const pinned = style.id === pinnedTarget;
    const isDeleting = pendingDelete?.id === style.id;
    return (
      <li key={style.id} className="group">
        <VoiceItem
          name={style.name}
          nameBadge={(
            <>
              {style.kind === "custom" && (
                <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-purple-700">
                  Custom
                </span>
              )}
              {style.kind === "builtin" && style.customized && (
                <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-purple-700">
                  Customized
                </span>
              )}
              {pinned && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-green-700">
                  <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 3a1 1 0 011 1v6.28a2 2 0 00.46 1.28L20 15v2h-6v4l-1 1-1-1v-4H6v-2l2.54-3.44A2 2 0 009 10.28V4a1 1 0 011-1h6z" />
                  </svg>
                  Preferred
                </span>
              )}
            </>
          )}
          subtitle={stylePreview(style)}
          hasPreview={false}
          isPlaying={false}
          onPlay={() => undefined}
          isSelected={active}
          className={pinned ? "group !border-green-400 !bg-green-50/60 !shadow-[0_0_0_4px_rgba(22,163,74,0.08)]" : "group"}
          icon={<VideoStyleIcon personalized={style.kind !== "builtin"} />}
          actions={
            <div className="flex items-center gap-0.5 shrink-0">
              {isDeleting ? (
                <div className="flex items-center gap-2 px-2 text-xs font-medium text-red-600" role="status" aria-live="polite">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" aria-hidden="true" />
                  Deleting…
                </div>
              ) : (
                <>
              <button
                type="button"
                disabled={pinning || pinned}
                onClick={() => requestPin(style)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                  pinned
                    ? "text-green-600 disabled:opacity-100"
                    : "text-gray-500 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
                }`}
                title={pinned ? `${style.name} is your preferred style` : `Prefer ${style.name} for saved edits`}
              >
                {pinned ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 3a1 1 0 011 1v6.28a2 2 0 00.46 1.28L20 15v2h-6v4l-1 1-1-1v-4H6v-2l2.54-3.44A2 2 0 009 10.28V4a1 1 0 011-1h6z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 3a1 1 0 011 1v6.28a2 2 0 00.46 1.28L20 15v2h-6v4l-1 1-1-1v-4H6v-2l2.54-3.44A2 2 0 009 10.28V4a1 1 0 011-1h6z" />
                  </svg>
                )}
              </button>
              {canEdit && (
                <button type="button" onClick={() => openEdit(style)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title={`Edit ${style.name}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.732-6.732a2.5 2.5 0 113.536 3.536L12.5 14.572 8 16l1-5zM5 19h14" /></svg>
                </button>
              )}
              {style.kind === "custom" && (
                <button type="button" onClick={() => void removeCustom(style)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors" title={`Delete ${style.name}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
              {style.kind === "learned" && style.available !== false && (
                <button type="button" onClick={() => void removeYourStyle()} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete Your Style">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
              <button type="button" disabled={savingSelection || style.available === false} onClick={() => toggleSelected(style)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-purple-100 hover:text-purple-600"}`} title={active ? "Remove from Video Style step" : "Add to Video Style step"}>
                {active ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" /></svg>
                )}
              </button>
                </>
              )}
            </div>
          }
        />
      </li>
    );
  };

  const showStyleFields = Boolean(editing) || editorMode === "manual" || Boolean(name.trim() || guidance.trim());

  if (loading) return <div className="flex flex-col items-center justify-center gap-4 py-12"><span className="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" /><p className="text-sm text-gray-500">Loading your video styles…</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Video Styles</h1>
        <button type="button" onClick={openCreate} className="flex shrink-0 items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create custom style
        </button>
      </div>
      <p className="max-w-md text-sm text-gray-500">Add custom writing styles. Saved styles appear in the Video Style step when creating a video.</p>

      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
          All styles
        </label>
        <ul className="space-y-2">
          {pendingSaveName && (
            <li className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3" role="status" aria-live="polite">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{pendingSaveName}</p>
                <p className="text-xs text-purple-600">Saving and adding to Step 2…</p>
              </div>
            </li>
          )}
          {orderedStyles.map((style) => styleRow(style, style.editable))}
        </ul>
      </div>

      {editorOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditorOpen(false)} />
          <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:max-h-[calc(100vh-3rem)]">
            <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editing ? `Edit ${editing.name}` : "Create video style"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {editing ? "Update the writing rules used when generating scripts." : "Define how your video scripts should sound, flow, and communicate."}
                </p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!editing && editorMode === "ai" && (
                <section className="mb-6">
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-gray-400">How should your scripts sound?</label>
                  <p className="mb-2 text-xs leading-5 text-gray-500">Describe the tone, pacing, hooks, sentence style, or anything you want the writing to avoid.</p>
                  <textarea rows={2} maxLength={1000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Confident and polished, with concise sentences, strong opening hooks, and no slang or exaggerated sales language." className="w-full min-h-[76px] resize-y rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-3 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100" />
                  <p className="mt-3 text-[11px] text-gray-400">Be specific—the result remains fully editable.</p>
                </section>
              )}

              {showStyleFields && (
                <section className={editorMode === "ai" && !editing ? "border-t border-gray-100 pt-5" : ""}>
                  {!editing && editorMode === "ai" && (
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Review your generated style</h3>
                        <p className="mt-0.5 text-xs text-gray-500">Adjust the name or rules before saving.</p>
                      </div>
                      <button
                        type="button"
                        disabled={generating || prompt.trim().length < 20}
                        onClick={() => void generateDraft()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Regenerate style"
                        aria-label="Regenerate style"
                      >
                        <svg className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 4a8.1 8.1 0 0 0 15.5 2m.5 5v-5h-5" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {(!editing || editing.kind === "custom") && (
                    <label className="mb-4 block">
                      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-gray-400">Style name</span>
                      <input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" placeholder="Example: Polished storyteller" />
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-gray-400">Writing rules</span>
                    <textarea ref={guidanceTextareaRef} rows={1} maxLength={2000} value={guidance} onChange={(event) => setGuidance(event.target.value)} className="w-full min-h-64 resize-none overflow-hidden rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" placeholder={'- Use a warm, conversational tone.\n- Keep sentences concise.\n- Open with an engaging question.'} />
                    <span className="mt-1 block text-right text-[11px] text-gray-400">{guidance.length}/2000</span>
                  </label>
                </section>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-6 py-4">
              <div>
                {editing?.kind === "builtin" && editing.customized && (
                  <button type="button" disabled={saving} onClick={() => void resetBuiltin()} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40">
                    Reset to default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                {!editing && editorMode === "ai" && !showStyleFields ? (
                  <button
                    type="button"
                    disabled={generating || prompt.trim().length < 20}
                    onClick={() => void generateDraft()}
                    className="min-w-32 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
                  >
                    {generating ? "Generating…" : "Generate style"}
                  </button>
                ) : (
                  <button type="button" disabled={saving || generating || !showStyleFields || !guidance.trim() || ((!editing || editing.kind === "custom") && !name.trim())} onClick={() => void saveStyle()} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300">{saving ? "Saving…" : "Save style"}</button>
                )}
              </div>
            </footer>
          </div>
        </div>, document.body,
      )}

      {deleteTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={deleting ? undefined : () => setDeleteTarget(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white px-6 py-6 shadow-2xl" role="alertdialog" aria-modal="true">
            <h3 className="text-base font-semibold text-gray-900">{deleteTarget.title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">{deleteTarget.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60">Cancel</button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  const onConfirm = deleteTarget.onConfirm;
                  setDeleteTarget(null);
                  setDeleting(true);
                  try {
                    await onConfirm();
                  } catch (error) {
                    showError(getErrorMessage(error, "Could not delete this video style."));
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting ? "Deleting…" : deleteTarget.confirmLabel}
              </button>
            </div>
          </div>
        </div>, document.body,
      )}

      {pinTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={pinning ? undefined : () => setPinTarget(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white px-6 py-6 shadow-2xl" role="alertdialog" aria-modal="true">
            <h3 className="text-base font-semibold text-gray-900">Prefer “{pinTarget.name}”?</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              From now on, your accepted script edits will be saved into “{pinTarget.name}” instead of any other style. You can switch this later by preferring a different style.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPinTarget(null)} disabled={pinning} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60">Cancel</button>
              <button
                type="button"
                disabled={pinning}
                onClick={() => void confirmPin()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                {pinning ? "Saving…" : "Yes, prefer this style"}
              </button>
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
