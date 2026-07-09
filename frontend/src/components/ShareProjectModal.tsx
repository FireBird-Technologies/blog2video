import { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Member,
  listMembers,
  inviteMember,
  revokeMember,
  leaveProject,
} from "../api/collaboration";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  /** Whether the current user owns the project (only owners can invite/revoke). */
  isOwner: boolean;
  /** Called after the current user leaves the project — navigate away from it. */
  onLeft?: () => void;
}

/**
 * Google-Docs-style share dialog: invite collaborators by email, see who has
 * access + their status, and (for owners) revoke access.
 */
export default function ShareProjectModal({
  open,
  onClose,
  projectId,
  projectName,
  isOwner,
  onLeft,
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);
  const [pendingLeave, setPendingLeave] = useState<Member | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resentId, setResentId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openMenu = (id: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpenMenuId(id);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMembers(projectId);
      setMembers(res.data);
    } catch {
      setError("Failed to load collaborators.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      setError(null);
      setEmail("");
      setOpenMenuId(null);
      load();
    }
  }, [open, load]);

  // Close the row action menu on any outside click.
  useEffect(() => {
    if (openMenuId === null) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenuId]);

  const handleResend = async (m: Member) => {
    setOpenMenuId(null);
    setResendingId(m.id);
    setError(null);
    try {
      await inviteMember(projectId, m.email);
      setResentId(m.id);
      setTimeout(() => setResentId((cur) => (cur === m.id ? null : cur)), 2500);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not resend the invite.";
      setError(detail);
    } finally {
      setResendingId(null);
    }
  };

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    setError(null);
    try {
      await inviteMember(projectId, trimmed);
      setEmail("");
      await load();
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not send the invite.";
      setError(detail);
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoval) return;
    try {
      await revokeMember(projectId, pendingRemoval.id);
      await load();
    } catch {
      setError("Failed to remove collaborator.");
      throw new Error("revoke failed"); // keep the confirm modal open on failure
    }
  };

  const handleConfirmLeave = async () => {
    try {
      await leaveProject(projectId);
    } catch {
      setError("Failed to leave the project.");
      throw new Error("leave failed"); // keep the confirm modal open on failure
    }
    // Access is gone — close the dialog and let the parent navigate away.
    setPendingLeave(null);
    onClose();
    onLeft?.();
  };

  if (!open) return null;

  // Owner is not a collaborator; cap collaborators at 5.
  const collaboratorCount = members.filter((m) => m.role !== "owner").length;
  const atLimit = collaboratorCount >= 5;

  return (
    <>
      {ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <h3 id="share-title" className="text-base font-semibold text-gray-900 mb-1">
          {isOwner ? `Share “${projectName}”` : `“${projectName}”`}
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          {isOwner
            ? "Invite people to co-edit this video. Collaborators can edit scenes; only you can finalise and delete."
            : "You’re a collaborator on this video. You can edit scenes or leave the project from below menu."}
        </p>

        {isOwner && (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !atLimit && handleInvite()}
                placeholder="collaborator@email.com"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 disabled:bg-gray-50 disabled:text-gray-400"
                disabled={inviting || atLimit}
              />
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || atLimit || !email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {inviting ? "Sending…" : "Invite"}
              </button>
            </div>
            {atLimit && (
              <p className="text-xs text-red-600 mt-2">
                Maximum of 5 collaborators reached. Remove someone to invite another.
              </p>
            )}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}

        <div
          className="max-h-64 overflow-y-auto -mx-1 px-1"
          onScroll={() => openMenuId !== null && setOpenMenuId(null)}
        >
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  {m.picture ? (
                    <img src={m.picture} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                      {(m.name || m.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.name || m.email}
                      {m.is_you && <span className="text-gray-400 font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      m.role === "owner"
                        ? "bg-purple-100 text-purple-700"
                        : m.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {m.role === "owner" ? "Owner" : m.status === "pending" ? "Pending" : "Editor"}
                  </span>
                  {/* Owner manages others; a collaborator only gets a menu on their
                      own row (to leave). The owner row never has a menu. */}
                  {m.role !== "owner" && (isOwner || m.is_you) && (
                    <div className="flex-shrink-0">
                      {resentId === m.id ? (
                        <span className="text-[11px] text-green-600">Sent ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => openMenu(m.id, e)}
                          disabled={resendingId === m.id}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          title="More options"
                          aria-label="More options"
                        >
                          {resendingId === m.id ? (
                            <span className="text-[11px]">…</span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                              <circle cx="8" cy="3" r="1.4" />
                              <circle cx="8" cy="8" r="1.4" />
                              <circle cx="8" cy="13" r="1.4" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-5">
          <p className="text-xs text-amber-600 flex-1 min-w-0">
            {isOwner
              ? "Collaborators can use your credits when regenerating or editing this video."
              : "Regenerating or editing this video uses the owner’s credits and plan."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
        document.body
      )}

      {openMenuId !== null && menuPos && (() => {
        const m = members.find((x) => x.id === openMenuId);
        if (!m) return null;
        return ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed z-[110] w-40 bg-white border border-gray-200 rounded-lg shadow-xl py-1"
            style={{ top: menuPos.top, right: menuPos.right }}
            role="menu"
          >
            {m.is_you && !isOwner ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenuId(null);
                  setPendingLeave(m);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Leave project
              </button>
            ) : m.status === "pending" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleResend(m)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Resend invite
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenuId(null);
                    setPendingRemoval(m);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Cancel invite
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenuId(null);
                  setPendingRemoval(m);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Remove collaborator
              </button>
            )}
          </div>,
          document.body,
        );
      })()}

      <ConfirmDeleteModal
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        title={pendingRemoval?.status === "pending" ? "Cancel invite?" : "Remove collaborator?"}
        subtitle={pendingRemoval ? pendingRemoval.name || pendingRemoval.email : undefined}
        warningMessage={
          pendingRemoval?.status === "pending"
            ? "Their invite link will stop working. You can invite them again later."
            : "They'll lose access to this video immediately. You can re-invite them later."
        }
        confirmLabel={pendingRemoval?.status === "pending" ? "Cancel invite" : "Remove"}
        confirmLoadingLabel={pendingRemoval?.status === "pending" ? "Canceling…" : "Removing…"}
        iconVariant="warning"
        onConfirm={handleConfirmRemove}
      />

      <ConfirmDeleteModal
        open={pendingLeave !== null}
        onClose={() => setPendingLeave(null)}
        title="Leave project?"
        subtitle={projectName}
        warningMessage="You'll lose access to this video immediately. The owner can re-invite you later."
        confirmLabel="Leave"
        confirmLoadingLabel="Leaving…"
        iconVariant="warning"
        onConfirm={handleConfirmLeave}
      />
    </>
  );
}
