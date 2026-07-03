import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { acceptInvite } from "../api/collaboration";

/**
 * Landing page for a collaboration invite link (/invite/:token).
 *
 * Requires login. If unauthenticated, we stash the token and send the user to
 * sign in, then this page auto-accepts on return. On success we redirect into the
 * shared project.
 */
export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Accepting your invitation…");

  useEffect(() => {
    if (!token) return;

    // Not logged in: remember where to return and go sign in.
    if (!user) {
      localStorage.setItem("b2v_pending_invite", token);
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await acceptInvite(token);
        if (cancelled) return;
        localStorage.removeItem("b2v_pending_invite");
        navigate(`/project/${res.data.project_id}`, { replace: true });
      } catch (err) {
        if (cancelled) return;
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          "This invitation could not be accepted.";
        setMessage(detail);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {status === "working" ? (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">{message}</p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitation problem</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
