import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  SceneComment,
  listComments,
  addComment,
  deleteComment,
} from "../api/collaboration";
import { relTime } from "../utils/relTime";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  sceneId: number;
  sceneTitle: string;
  /** Current user id — used to show a delete button on their own comments. */
  currentUserId?: number;
  /** Project owner id — owner may delete any comment. */
  ownerId?: number;
  /** Called after add/delete so the parent can refresh comment counts. */
  onChanged?: () => void;
}


/**
 * Per-scene comment thread. Any collaborator (owner or member) can post; a comment
 * can be deleted by its author or the project owner. New/removed comments broadcast
 * live over the collaboration socket, but this modal also reloads on open.
 */
export default function SceneCommentModal({
  open,
  onClose,
  projectId,
  sceneId,
  sceneTitle,
  currentUserId,
  ownerId,
  onChanged,
}: Props) {
  const [comments, setComments] = useState<SceneComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listComments(projectId, sceneId);
      setComments(res.data);
    } catch {
      setError("Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [projectId, sceneId]);

  useEffect(() => {
    if (open) {
      setError(null);
      setBody("");
      load();
    }
  }, [open, load]);

  const handleSubmit = async () => {
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await addComment(projectId, sceneId, text);
      setBody("");
      await load();
      onChanged?.();
    } catch {
      setError("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(projectId, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      onChanged?.();
    } catch {
      setError("Failed to delete comment.");
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-lg w-full mx-4 flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Comments</h3>
            <p className="text-xs text-gray-500 truncate mt-0.5" title={sceneTitle}>{sceneTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400">No comments yet. Be the first to comment.</p>
          ) : (
            comments.map((c) => {
              const canDelete = c.user_id === currentUserId || ownerId === currentUserId;
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  {c.user_picture ? (
                    <img src={c.user_picture} alt={c.user_name ?? ""} className="w-7 h-7 rounded-full shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-medium text-gray-700 shrink-0">
                      {(c.user_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">
                        {c.user_name ?? "Former collaborator"}
                      </span>
                      <span className="text-[11px] text-gray-400">{relTime(c.created_at)}</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-[11px] text-gray-400 hover:text-red-500 ml-auto"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Add a comment…"
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !body.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
