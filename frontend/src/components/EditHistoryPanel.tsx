import { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  ChangeSet,
  FieldChange,
  getProjectHistory,
  getSceneHistory,
  revertChangeSet,
} from "../api/collaboration";
import type { SceneRef } from "./CollabContext";
import { relTime } from "../utils/relTime";
import { diffFieldValue, LeafChange } from "../utils/fieldDiff";
import { fieldLabel, pathLabel } from "../utils/fieldLabels";

/** Longer than this collapses behind an expand arrow. */
const PREVIEW_LIMIT = 48;

/** Matches CSS colors we can preview as a swatch (#hex, rgb(), rgba()). */
const COLOR_RE = /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([\d.,\s%]+\))$/i;

/** A changed value rendered as its literal text, with a color swatch when it's a color. */
function ValueText({ value, className }: { value: string; className: string }) {
  const color = COLOR_RE.test(value.trim()) ? value.trim() : null;
  if (!color) return <span className={className}>{value}</span>;
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <span
        className="inline-block w-3 h-3 rounded-sm border border-gray-300 flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{value}</span>
    </span>
  );
}

/** One changed value (old → new), collapsible when long. */
function ValueDelta({ change }: { change: LeafChange }) {
  const [expanded, setExpanded] = useState(false);
  const long = change.old.length > PREVIEW_LIMIT || change.new.length > PREVIEW_LIMIT;
  const clip = (s: string) => (expanded || !long ? s : s.length > PREVIEW_LIMIT ? s.slice(0, PREVIEW_LIMIT) + "…" : s);

  return (
    <div className="min-w-0">
      {change.path && <span className="font-medium text-gray-700">{pathLabel(change.path)}</span>}
      {change.path && " "}
      <ValueText value={clip(change.old)} className={`text-gray-400 line-through ${expanded ? "break-all whitespace-pre-wrap" : ""}`} />{" "}
      → <ValueText value={clip(change.new)} className={`text-gray-700 ${expanded ? "break-all whitespace-pre-wrap" : ""}`} />
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-0.5 align-middle ml-1 text-[11px] font-medium text-[#7C3AED] hover:text-[#6D28D9]"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={expanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

/** A single field's changes: only the sub-fields that actually changed. */
function FieldChangeRow({ change }: { change: FieldChange }) {
  const leaves = diffFieldValue(change.old_value, change.new_value);
  return (
    <li>
      <span className="font-medium text-gray-700">
        {fieldLabel(change.field_name)}
      </span>
      <div className="mt-0.5 space-y-0.5 pl-1">
        {leaves.map((lf, i) => (
          <ValueDelta key={i} change={lf} />
        ))}
      </div>
    </li>
  );
}

type Tab = "project" | "scene";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** Scenes to page through, in display order. */
  scenes: SceneRef[];
  /** Owners can revert/redo any change; collaborators only their own. */
  isOwner: boolean;
  /** Current user id — used to let collaborators revert their own changes. */
  currentUserId?: number;
  /** Called after a successful revert so the parent can refetch project data. */
  onReverted?: () => void;
}

/** Whether a change-set is a bulk event entry (no field diff, non-revertable). */
function isEvent(cs: ChangeSet): boolean {
  return !cs.revertable && cs.changes.every((c) => c.old_value == null && c.new_value == null);
}

/**
 * Activity drawer with two tabs: Global edits (project-wide) and Scene edits
 * (per-scene, with a scene selector). Field edits can be reverted by the owner;
 * bulk operations (script/template/audio regen) are shown for visibility but
 * can't be reverted.
 */
export default function EditHistoryPanel({
  open,
  onClose,
  projectId,
  scenes,
  isOwner,
  currentUserId,
  onReverted,
}: Props) {
  // Default to the first scene; "Global edits" sits above it in the selector.
  const [tab, setTab] = useState<Tab>("scene");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [projectEdits, setProjectEdits] = useState<ChangeSet[]>([]);
  const [sceneEdits, setSceneEdits] = useState<ChangeSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Clamp the active scene index if the scene list changes (e.g. a scene deleted).
  const safeIndex = scenes.length ? Math.min(sceneIndex, scenes.length - 1) : 0;
  const activeScene = scenes[safeIndex];
  const activeSceneId = activeScene?.id;

  // Reset to the first scene each time the panel is opened.
  useEffect(() => {
    if (open) {
      setTab(scenes.length ? "scene" : "project");
      setSceneIndex(0);
    }
  }, [open, scenes.length]);

  // Selector value: "global" for project-wide edits, otherwise the scene index.
  const selectorValue = tab === "project" ? "global" : String(safeIndex);
  const selectorLabel =
    tab === "project"
      ? "Global Edits"
      : activeScene
      ? `Scene ${activeScene.order}${activeScene.title ? ` — ${activeScene.title}` : ""}`
      : "Global Edits";
  const onSelectorChange = (value: string) => {
    if (value === "global") {
      setTab("project");
    } else {
      setTab("scene");
      setSceneIndex(Number(value));
    }
    setSelectOpen(false);
  };

  // Close the custom dropdown on outside click.
  useEffect(() => {
    if (!selectOpen) return;
    const onClickOutside = (evt: MouseEvent) => {
      if (!selectRef.current?.contains(evt.target as Node)) setSelectOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [selectOpen]);

  const loadProjectEdits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectHistory(projectId);
      setProjectEdits(res.data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadSceneEdits = useCallback(async () => {
    if (activeSceneId == null) {
      setSceneEdits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getSceneHistory(projectId, activeSceneId);
      setSceneEdits(res.data);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeSceneId]);

  useEffect(() => {
    if (!open) return;
    if (tab === "project") loadProjectEdits();
    else loadSceneEdits();
  }, [open, tab, loadProjectEdits, loadSceneEdits]);

  const handleRevert = async (cs: ChangeSet) => {
    if (!cs.change_set_id) return;
    setReverting(cs.change_set_id);
    try {
      await revertChangeSet(projectId, cs.change_set_id);
      if (tab === "project") await loadProjectEdits();
      else await loadSceneEdits();
      onReverted?.();
    } catch {
      /* surfaced via reload; keep panel open */
    } finally {
      setReverting(null);
    }
  };

  if (!open) return null;

  const renderChangeSets = (list: ChangeSet[]) =>
    loading ? (
      <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
    ) : list.length === 0 ? (
      <p className="text-sm text-gray-400 text-center py-8">Nothing here yet.</p>
    ) : (
      <ul className="space-y-3 divide-y divide-gray-100">
        {list.map((cs, i) => {
          const event = isEvent(cs);
          return (
            <li key={cs.change_set_id || i} className="relative pl-6 pt-3 first:pt-0">
              <span className={`absolute left-1 top-2 w-1.5 h-1.5 rounded-full ${event ? "bg-gray-300" : "bg-[#7C3AED]"}`} />
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {cs.user_picture ? (
                  <img src={cs.user_picture} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                    {(cs.user_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {cs.user_name || "Former collaborator"}
                </span>
                <span className="text-xs text-gray-400">{relTime(cs.edited_at)}</span>
                {cs.is_ai_assisted && !event && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">AI</span>
                )}
                {cs.reverted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">reverted</span>
                )}
              </div>
              {event ? (
                <p className="text-xs text-gray-600 mb-1.5">{cs.changes[0]?.field_name || "Action"}</p>
              ) : (
                <ul className="text-xs text-gray-600 space-y-1.5 mb-1.5">
                  {cs.changes.map((c, j) => (
                    <FieldChangeRow key={j} change={c} />
                  ))}
                </ul>
              )}
              {cs.change_set_id && cs.revertable && (isOwner || cs.user_id === currentUserId) && (
                <button
                  type="button"
                  onClick={() => handleRevert(cs)}
                  disabled={reverting === cs.change_set_id}
                  className="text-xs font-medium text-[#7C3AED] hover:text-[#6D28D9] disabled:opacity-50"
                >
                  {reverting === cs.change_set_id ? "Reverting…" : cs.reverted ? "Redo" : "Revert"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Activity"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Activity</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Selector: "Global Edits" first, then each scene */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-xs text-gray-500 mb-2">
            Choose whether to view project-wide edits or a specific scene’s history.
          </p>
          <div className="relative" ref={selectRef}>
            <button
              type="button"
              onClick={() => setSelectOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={selectOpen}
              className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 flex items-center justify-between gap-2"
            >
              <span className="truncate text-left">{selectorLabel}</span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${selectOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {selectOpen && (
              <div
                role="listbox"
                aria-label="Select what to view"
                className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 max-h-60 overflow-y-auto"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectorValue === "global"}
                  onClick={() => onSelectorChange("global")}
                  className={`w-full text-left px-2.5 py-3 text-xs rounded-lg transition-colors ${
                    selectorValue === "global" ? "bg-purple-50 text-purple-700 font-medium" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Global Edits
                </button>
                {scenes.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={selectorValue === String(i)}
                    onClick={() => onSelectorChange(String(i))}
                    className={`w-full text-left px-2.5 py-3 text-xs rounded-lg transition-colors ${
                      selectorValue === String(i) ? "bg-purple-50 text-purple-700 font-medium" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    Scene {s.order}
                    {s.title ? ` — ${s.title}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "project" && renderChangeSets(projectEdits)}
          {tab === "scene" && renderChangeSets(sceneEdits)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
