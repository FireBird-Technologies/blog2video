import { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Member,
  listMembers,
  inviteMember,
  revokeMember,
} from "../api/collaboration";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  /** Whether the current user owns the project (only owners can invite/revoke). */
  isOwner: boolean;
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
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      load();
    }
  }, [open, load]);

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

  const handleRevoke = async (memberId: number) => {
    try {
      await revokeMember(projectId, memberId);
      await load();
    } catch {
      setError("Failed to remove collaborator.");
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <h3 id="share-title" className="text-base font-semibold text-gray-900 mb-1">
          Share “{projectName}”
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Invite people to co-edit this video. Collaborators can edit scenes; only you can finalise
          and delete.
        </p>

        {isOwner && (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="collaborator@email.com"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
                disabled={inviting}
              />
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || !email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {inviting ? "Sending…" : "Invite"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto -mx-1 px-1">
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
                  {isOwner && m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(m.id)}
                      className="text-xs text-gray-400 hover:text-red-600 flex-shrink-0"
                      title="Remove access"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
