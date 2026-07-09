import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  SceneComment,
  listComments,
  addComment,
  deleteComment,
} from "../api/collaboration";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
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

/** A comment plus its nested replies, for recursive rendering. */
interface CommentNode extends SceneComment {
  replies: CommentNode[];
}

/** Deepest visual indentation tier (root = 0). Replies deeper than this flatten here. */
const MAX_INDENT = 2;

/** Build a parent→children tree from the flat comment list. Roots newest-first;
 *  replies oldest-first so a thread reads top-down. */
function buildTree(comments: SceneComment[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  comments.forEach((c) => byId.set(c.id, { ...c, replies: [] }));
  const roots: CommentNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  });
  const asc = (a: CommentNode, b: CommentNode) =>
    a.created_at.localeCompare(b.created_at);
  byId.forEach((n) => n.replies.sort(asc));
  roots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return roots;
}

/** Total number of replies nested under a comment, at any depth. */
function countDescendants(node: CommentNode): number {
  return node.replies.reduce((sum, r) => sum + 1 + countDescendants(r), 0);
}

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
  // Inline reply composer: which comment is being replied to + its draft.
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  // Comment ids whose replies are expanded (collapsed by default).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      setReplyingTo(null);
      setReplyBody("");
      setExpanded(new Set());
      load();
    }
  }, [open, load]);

  const tree = useMemo(() => buildTree(comments), [comments]);

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

  const handleReply = async (parentId: number) => {
    const text = replyBody.trim();
    if (!text || replySubmitting) return;
    setReplySubmitting(true);
    setError(null);
    try {
      await addComment(projectId, sceneId, text, parentId);
      setReplyBody("");
      setReplyingTo(null);
      // Expand the parent so the new reply is visible.
      setExpanded((prev) => new Set(prev).add(parentId));
      await load();
      onChanged?.();
    } catch {
      setError("Failed to post reply.");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(projectId, id);
      await load();
      onChanged?.();
    } catch {
      setError("Failed to delete comment.");
    }
  };

  const renderNode = (c: CommentNode, depth: number) => {
    const canDelete = c.user_id === currentUserId || ownerId === currentUserId;
    const replyCount = c.replies.length;
    // Toggle shows the total nested reply count (all descendants, any depth).
    const totalReplies = countDescendants(c);
    // Only level 0 and level 1 get a collapse arrow. Level 2 and deeper are always
    // shown once their level-1 ancestor is expanded.
    const hasToggle = depth < MAX_INDENT;
    const isExpanded = hasToggle ? expanded.has(c.id) : true;
    return (
      <div key={c.id}>
        <div className="flex items-start gap-2.5">
          {c.user_picture ? (
            <img src={c.user_picture} alt={c.user_name ?? ""} className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-medium text-gray-700 shrink-0">
              {(c.user_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-900">
                {c.user_name ?? "Former collaborator"}
              </span>
              <span className="text-[11px] text-gray-400">{relTime(c.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
            <div className="flex items-center gap-3 mt-1">
              {/* Replies are capped at level 2 — only levels 0 and 1 can be replied to. */}
              {depth < MAX_INDENT && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo((prev) => (prev === c.id ? null : c.id));
                    setReplyBody("");
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7C3AED] hover:text-[#6D28D9]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                  </svg>
                  Reply
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setDeletingCommentId(c.id)}
                  className="text-gray-400 hover:text-red-500"
                  aria-label="Delete comment"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {hasToggle && replyCount > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(c.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700"
                  aria-expanded={isExpanded}
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {isExpanded
                    ? "Hide replies"
                    : `${totalReplies} ${totalReplies === 1 ? "reply" : "replies"}`}
                </button>
              )}
            </div>

            {replyingTo === c.id && (
              <div className="mt-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleReply(c.id);
                    }
                  }}
                  placeholder="Reply this comment…"
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex justify-end gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyBody("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReply(c.id)}
                    disabled={replySubmitting || !replyBody.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {replySubmitting ? "Posting…" : "Reply"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {replyCount > 0 && isExpanded && (
          <div
            className={
              depth < MAX_INDENT
                ? "mt-3 ml-3.5 pl-3 border-l border-gray-100 space-y-3"
                : "mt-3 space-y-3"
            }
          >
            {c.replies.map((r) => renderNode(r, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
      {ReactDOM.createPortal(
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
              ) : tree.length === 0 ? (
                <p className="text-sm text-gray-400">No comments yet. Be the first to comment.</p>
              ) : (
                tree.map((c) => renderNode(c, 0))
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
      )}
      <ConfirmDeleteModal
        open={deletingCommentId !== null}
        onClose={() => setDeletingCommentId(null)}
        title="Delete comment?"
        warningMessage="This comment and any replies to it will be permanently deleted."
        confirmLabel="Delete comment"
        confirmLoadingLabel="Deleting..."
        iconVariant="danger"
        onConfirm={async () => {
          if (deletingCommentId === null) return;
          await handleDelete(deletingCommentId);
        }}
      />
    </>
  );
}
