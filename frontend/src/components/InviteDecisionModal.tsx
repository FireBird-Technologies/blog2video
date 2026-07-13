import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listMyInvites, acceptInvite, rejectInvite, PendingInvite } from "../api/collaboration";

/**
 * Global watcher that pops an Accept/Reject modal whenever the signed-in user has
 * a pending collaboration invite — no matter what page they're on. The dedicated
 * /invite/:token page handles the link-click flow; this covers the "already logged
 * in" case (e.g. they land on the dashboard with an invite waiting).
 */
export default function InviteDecisionModal() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setInvite(null);
      return;
    }
    try {
      const res = await listMyInvites();
      setInvite(res.data[0] ?? null);
    } catch {
      /* ignore — transient; will retry on next navigation */
    }
  }, [user]);

  // Check on login and on route changes (cheap; surfaces invites promptly).
  // Skip the dedicated invite page — it owns that flow itself.
  useEffect(() => {
    if (location.pathname.startsWith("/invite/")) {
      setInvite(null);
      return;
    }
    refresh();
  }, [user, location.pathname, refresh]);

  if (!invite || location.pathname.startsWith("/invite/")) return null;

  const handleAccept = async () => {
    setBusy("accept");
    try {
      const res = await acceptInvite(invite.invite_token);
      setInvite(null);
      navigate(`/project/${res.data.project_id}`, { replace: true });
    } catch {
      // Likely already handled elsewhere — drop it and re-check.
      setInvite(null);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy("reject");
    try {
      await rejectInvite(invite.invite_token);
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
      setInvite(null);
      refresh();
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-2xl max-w-md w-full p-8 text-center"
        role="dialog"
        aria-modal="true"
        aria-label="Collaboration invite"
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#7C3AED]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l2 2 4-4M13 7a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">You're invited to collaborate</h2>
        <p className="text-base font-semibold text-gray-900 mb-1">"{invite.project_name}"</p>
        {invite.invited_by && (
          <p className="text-sm text-gray-500 mb-2">Invited by {invite.invited_by}</p>
        )}
        <p className="text-xs text-gray-500 mb-6">
          You'll be able to co-edit this video's scenes.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={handleReject}
            disabled={busy !== null}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-60"
          >
            {busy === "reject" ? "Declining…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy !== null}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors disabled:opacity-60"
          >
            {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
