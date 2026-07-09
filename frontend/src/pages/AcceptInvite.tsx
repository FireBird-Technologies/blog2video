import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";
import { googleLogin } from "../api/client";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import { acceptInvite, rejectInvite, getInviteByToken, PendingInvite } from "../api/collaboration";

/**
 * Landing page for a collaboration invite link (/invite/:token).
 *
 * Works whether or not someone is signed in — it never bounces to the marketing
 * landing page. Signed out (or signed in with the wrong account), it prompts the
 * user to sign in with the invited email. Once the signed-in email matches, the
 * invite is shown for an explicit Accept / Reject (never auto-accepted).
 */
export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, login, logout } = useAuth();
  const navigate = useNavigate();
  const { showError } = useErrorModal();

  const [phase, setPhase] = useState<
    "loading" | "signed_out" | "decide" | "wrong_account" | "error"
  >("loading");
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  // Bumped by "Try again" to re-fetch the invite — recovers a stale error page
  // (e.g. the owner canceled then resent) without a full reload.
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch invite details (public — works signed out / as any user) so we can always
  // show which project + email this link is for, then decide which UI to render.
  useEffect(() => {
    if (!token || authLoading) return;

    let cancelled = false;
    setPhase("loading");
    (async () => {
      try {
        const res = await getInviteByToken(token);
        if (cancelled) return;
        const inv = res.data;
        setInvite(inv);

        if (inv.status === "accepted") {
          navigate(`/project/${inv.project_id}`, { replace: true });
          return;
        }
        if (!user) {
          setPhase("signed_out");
        } else if (user.email.toLowerCase() === inv.invited_email.toLowerCase()) {
          setPhase("decide");
        } else {
          setPhase("wrong_account");
          setMessage(
            `This invite was sent to ${inv.invited_email}. Sign in with that email to accept it.`,
          );
        }
      } catch (err) {
        if (cancelled) return;
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          "We couldn't load this invitation. It may have been revoked or removed.";
        setMessage(detail);
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading, navigate, reloadKey]);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    try {
      const res = await googleLogin(response.credential, false);
      login(res.data.access_token, res.data.user);
      // The user effect re-runs and moves us to decide / wrong_account.
    } catch (err) {
      showError(getErrorMessage(err, "Sign-in failed. Please try again."));
    } finally {
      setSigningIn(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    setBusy("accept");
    try {
      const res = await acceptInvite(token);
      navigate(`/project/${res.data.project_id}`, { replace: true });
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "This invitation could not be accepted.";
      setMessage(detail);
      setPhase("error");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!token) return;
    setBusy("reject");
    try {
      await rejectInvite(token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "This invitation could not be declined.";
      setMessage(detail);
      setPhase("error");
    } finally {
      setBusy(null);
    }
  };

  const inviteIcon = (
    <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-purple-100 flex items-center justify-center">
      <svg className="w-7 h-7 text-[#7C3AED]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l2 2 4-4M13 7a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0" />
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/60 to-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {phase === "loading" && (
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Loading your invitation…</p>
          </div>
        )}

        {phase === "signed_out" && invite && (
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 text-center">
            {inviteIcon}
            <h2 className="text-xl font-semibold text-gray-900 mb-1.5">You've been invited to collaborate</h2>
            <p className="text-sm text-gray-500 mb-1">on the video</p>
            <p className="text-base font-semibold text-gray-900 mb-1">"{invite.project_name}"</p>
            {invite.invited_by && (
              <p className="text-sm text-gray-500 mb-4">Invited by {invite.invited_by}</p>
            )}
            <p className={`text-sm text-gray-500 leading-relaxed ${invite.invited_by ? "" : "mt-3"}`}>
              Sign in with this email to accept and start co-editing the video's scenes.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 mt-3 mb-6 max-w-full">
              <svg className="w-4 h-4 text-[#7C3AED] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-purple-800 truncate">{invite.invited_email}</span>
            </div>
            <div className="flex justify-center">
              {signingIn ? (
                <div className="inline-flex items-center gap-2 text-sm text-gray-500 py-3">
                  <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </div>
              ) : (
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in was cancelled or failed.")}
                  text="continue_with"
                />
              )}
            </div>
          </div>
        )}

        {phase === "decide" && invite && (
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 text-center">
            {inviteIcon}
            <p className="text-sm text-gray-500 mb-1">You've been invited to co-edit</p>
            <p className="text-lg font-semibold text-gray-900 mb-1">"{invite.project_name}"</p>
            {invite.invited_by && (
              <p className="text-sm text-gray-500 mb-1">Invited by {invite.invited_by}</p>
            )}
            <div className="inline-flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 mt-3 max-w-full">
              <svg className="w-4 h-4 text-[#7C3AED] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-purple-800 truncate">{invite.invited_email}</span>
            </div>
            <div className="flex gap-3 justify-center mt-6">
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
                {busy === "accept" ? "Accepting…" : "Accept invite"}
              </button>
            </div>
          </div>
        )}

        {phase === "wrong_account" && invite && (
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 text-center">
            {inviteIcon}
            <h2 className="text-xl font-semibold text-gray-900 mb-1.5">Switch account</h2>
            <p className="text-sm text-gray-500 mb-1">You've been invited to collaborate on the video</p>
            <p className="text-base font-semibold text-gray-900 mb-1">"{invite.project_name}"</p>
            {invite.invited_by && (
              <p className="text-sm text-gray-500 mb-4">Invited by {invite.invited_by}</p>
            )}
            <p className="text-sm text-gray-500 leading-relaxed">
              This invite is for a different email. Sign in with the invited email to accept it:
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 mt-3 mb-6 max-w-full">
              <svg className="w-4 h-4 text-[#7C3AED] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-purple-800 truncate">{invite.invited_email}</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              {signingIn ? (
                <div className="inline-flex items-center gap-2 text-sm text-gray-500 py-3">
                  <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </div>
              ) : (
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in was cancelled or failed.")}
                  text="signin_with"
                />
              )}
              <button
                type="button"
                onClick={logout}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Sign out of the current account
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-1.5">Invitation problem</h2>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 rounded-lg"
              >
                Try again
              </button>
              <button
                onClick={() => navigate(user ? "/dashboard" : "/")}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg"
              >
                {user ? "Go to dashboard" : "Go home"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
