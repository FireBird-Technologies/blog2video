import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { approveWordPressConnection, getPendingWordPressConnection } from "../api/client";
import { useLoginModal } from "../contexts/LoginModalContext";
import { useAuth } from "../hooks/useAuth";

export default function WordPressConnect() {
  const [params] = useSearchParams();
  const connectionRequest = useMemo(
    () => (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
    [params]
  );
  const [busy, setBusy] = useState(false);
  const [loadingSite, setLoadingSite] = useState(true);
  const [connectedSite, setConnectedSite] = useState<string | null>(null);
  const [site, setSite] = useState<{ site_name: string; site_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { openLogin } = useLoginModal();

  useEffect(() => {
    if (connectionRequest.length !== 8) {
      setSite(null);
      setLoadingSite(false);
      setError("This approval link is invalid or incomplete. Start again from the Blog2Video plugin in WordPress.");
      return;
    }
    let current = true;
    setLoadingSite(true);
    getPendingWordPressConnection(connectionRequest)
      .then((result) => {
        if (current) {
          setSite(result);
          setError(null);
        }
      })
      .catch(() => {
        if (current) {
          setSite(null);
          setError("This connection request is invalid or has expired. Start again from WordPress.");
        }
      })
      .finally(() => {
        if (current) setLoadingSite(false);
      });
    return () => { current = false; };
  }, [connectionRequest]);

  const connect = async () => {
    if (!user) {
      openLogin({
        title: "Sign in to connect WordPress",
        subtitle: "Use the Blog2Video account that should own videos created from this site.",
        onSuccess: () => {},
      });
      return;
    }
    if (connectionRequest.length !== 8 || !site) {
      setError("This connection request is invalid or has expired. Start again from WordPress.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await approveWordPressConnection(connectionRequest);
      setConnectedSite(result.site_name || result.site_url);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "The connection could not be approved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-5 py-16">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <img
          src="/b2v-logo.png"
          alt="Blog2Video"
          className="mb-6 h-14 w-14 rounded-2xl object-contain shadow-sm"
        />
        <h1 className="text-2xl font-semibold text-slate-900">Approve WordPress connection</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Confirm that you recognize the site below. Approval lets it create and manage videos in your
          Blog2Video account without sharing your password.
        </p>

        {connectedSite ? (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-medium">Connection approved for {connectedSite}.</p>
            <p className="mt-1 text-sm">You can close this tab and return to WordPress. The plugin will finish connecting automatically.</p>
          </div>
        ) : (
          <div className="mt-7">
            {loadingSite ? (
              <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-4 w-2/5 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-3/4 rounded bg-slate-200" />
              </div>
            ) : site ? (
              <div className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7c3aed]">WordPress site</p>
                <p className="mt-2 font-semibold text-slate-900">{site.site_name}</p>
                <p className="mt-1 break-all text-sm text-slate-600">{site.site_url}</p>
              </div>
            ) : null}
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={connect}
              disabled={busy || loadingSite || !site}
              className="mt-5 w-full rounded-xl bg-[#7c3aed] px-4 py-3 font-medium text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Approving…" : user ? "Approve" : "Sign in to approve"}
            </button>
          </div>
        )}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Only approve a connection you started from a WordPress site you administer. You can revoke access later from WordPress.
        </p>
      </section>
    </main>
  );
}
