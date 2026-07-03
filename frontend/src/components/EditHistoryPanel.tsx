import { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  ChangeSet,
  FieldChange,
  getProjectHistory,
  getSceneHistory,
  revertChangeSet,
  SceneComment,
  listComments,
  deleteComment,
} from "../api/collaboration";
import type { SceneRef } from "./CollabContext";
import { relTime } from "../utils/relTime";
import { diffFieldValue, LeafChange } from "../utils/fieldDiff";
import { fieldLabel, pathLabel } from "../utils/fieldLabels";

/** Longer than this collapses behind an expand arrow. */
const PREVIEW_LIMIT = 48;

/** One changed value (old → new), collapsible when long. */
function ValueDelta({ change }: { change: LeafChange }) {
  const [expanded, setExpanded] = useState(false);
  const long = change.old.length > PREVIEW_LIMIT || change.new.length > PREVIEW_LIMIT;
  const clip = (s: string) => (expanded || !long ? s : s.length > PREVIEW_LIMIT ? s.slice(0, PREVIEW_LIMIT) + "…" : s);

  return (
    <div className="min-w-0">
      {change.path && <span className="font-medium text-gray-700">{pathLabel(change.path)}</span>}
      {change.path && " "}
      <span className={`text-gray-400 line-through ${expanded ? "break-all whitespace-pre-wrap" : ""}`}>{clip(change.old)}</span>{" "}
      → <span className={`text-gray-700 ${expanded ? "break-all whitespace-pre-wrap" : ""}`}>{clip(change.new)}</span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex align-middle ml-1 text-[#7C3AED] hover:text-[#6D28D9]"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={expanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
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

type Tab = "project" | "scene" | "comments";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** Scenes to page through, in display order. */
  scenes: SceneRef[];
  /** Only owners can revert changes. */
  isOwner: boolean;
  /** Called after a successful revert so the parent can refetch project data. */
  onReverted?: () => void;
  /** Current user id — for showing delete on their own comments. */
  currentUserId?: number;
  /** Project owner id — owner may delete any comment. */
  ownerId?: number;
}

/** Whether a change-set is a bulk event entry (no field diff, non-revertable). */
function isEvent(cs: ChangeSet): boolean {
  return !cs.revertable && cs.changes.every((c) => c.old_value == null && c.new_value == null);
}

/**
 * Activity drawer with three tabs: Project edits (project-wide), Scene edits
 * (per-scene, with a scene navigator), and Comments (per-scene). Field edits can be
 * reverted by the owner; bulk operations (script/template/audio regen) are shown for
 * visibility but can't be reverted.
 */
export default function EditHistoryPanel({
  open,
  onClose,
  projectId,
  scenes,
  isOwner,
  onReverted,
  currentUserId,
  ownerId,
}: Props) {
  const [tab, setTab] = useState<Tab>("project");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [projectEdits, setProjectEdits] = useState<ChangeSet[]>([]);
  const [sceneEdits, setSceneEdits] = useState<ChangeSet[]>([]);
  const [comments, setComments] = useState<SceneComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);

  // Clamp the active scene index if the scene list changes (e.g. a scene deleted).
  const safeIndex = scenes.length ? Math.min(sceneIndex, scenes.length - 1) : 0;
  const activeScene = scenes[safeIndex];
  const activeSceneId = activeScene?.id;

  // The scene navigator only applies to the per-scene tabs.
  const perScene = tab === "scene" || tab === "comments";

  // Reset to the first scene each time the panel is opened.
  useEffect(() => {
    if (open) setSceneIndex(0);
  }, [open]);

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

  const loadComments = useCallback(async () => {
    if (activeSceneId == null) {
      setComments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listComments(projectId, activeSceneId);
      setComments(res.data);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeSceneId]);

  useEffect(() => {
    if (!open) return;
    if (tab === "project") loadProjectEdits();
    else if (tab === "scene") loadSceneEdits();
    else loadComments();
  }, [open, tab, loadProjectEdits, loadSceneEdits, loadComments]);

  const handleDeleteComment = async (id: number) => {
    try {
      await deleteComment(projectId, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
  };

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

  const TABS: { id: Tab; label: string }[] = [
    { id: "project", label: "Project edits" },
    { id: "scene", label: "Scene edits" },
    { id: "comments", label: "Comments" },
  ];

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
              {cs.change_set_id && cs.revertable && isOwner && (
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
        className="relative bg-white w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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

        {/* Pill tabs (styled like the project view tabs) */}
        <div className="px-5 py-3">
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all text-center whitespace-nowrap ${
                  tab === t.id
                    ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scene navigator — only for the per-scene tabs */}
        {perScene && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-y border-gray-100 bg-gray-50/70">
            <button
              type="button"
              onClick={() => setSceneIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex <= 0}
              className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous scene"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0 text-center">
              {activeScene ? (
                <>
                  <span className="text-xs font-semibold text-purple-600">Scene {activeScene.order}</span>
                  <span className="block text-xs text-gray-600 truncate" title={activeScene.title}>
                    {activeScene.title}
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-400">No scenes</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSceneIndex((i) => Math.min(scenes.length - 1, i + 1))}
              disabled={safeIndex >= scenes.length - 1}
              className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next scene"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "project" && renderChangeSets(projectEdits)}
          {tab === "scene" && renderChangeSets(sceneEdits)}
          {tab === "comments" &&
            (loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No comments yet.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => {
                  const canDelete = c.user_id === currentUserId || ownerId === currentUserId;
                  return (
                    <li key={c.id} className="flex items-start gap-2.5">
                      {c.user_picture ? (
                        <img src={c.user_picture} alt="" className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 shrink-0">
                          {(c.user_name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {c.user_name || "Former collaborator"}
                          </span>
                          <span className="text-xs text-gray-400">{relTime(c.created_at)}</span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 ml-auto"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">
                          {c.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
