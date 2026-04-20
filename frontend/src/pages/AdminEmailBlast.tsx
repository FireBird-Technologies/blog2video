import { useState, useRef, useEffect, useCallback } from "react";
import {
  sendBlastEmail,
  getCampaignStatus,
  listCampaigns,
  sendNextBatch,
  CampaignStatus,
} from "../api/admin";

const ADMIN_PASSWORD = "blog2video-44";
const POLL_INTERVAL_MS = 2000;

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{pct}% reached</span>
        <span>{value} / {max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    running: "bg-purple-100 text-purple-700",
    done: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    pending: "Starting…",
    running: "Sending…",
    done: "Done",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function AdminEmailBlast() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [activeCampaign, setActiveCampaign] = useState<CampaignStatus | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignStatus[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await listCampaigns(ADMIN_PASSWORD);
      setCampaigns(res.data.campaigns);
      setTotalUsers(res.data.total_users);
    } catch {
      // silently ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const startPolling = (campaignId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await getCampaignStatus(campaignId, ADMIN_PASSWORD);
        setActiveCampaign(res.data);
        if (res.data.status === "done") {
          stopPolling();
          setSending(false);
          fetchHistory();
        }
      } catch {
        stopPolling();
        setSending(false);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setError("");
    setSending(true);
    setActiveCampaign(null);

    try {
      const res = await sendBlastEmail({ subject, body, password: ADMIN_PASSWORD });
      const { campaign_id, total_users } = res.data;
      setTotalUsers(total_users);
      setActiveCampaign({
        campaign_id,
        subject,
        status: "pending",
        total_users,
        sent_count: 0,
        failed_count: 0,
        already_reached: 0,
        remaining: total_users,
        errors: [],
        created_at: new Date().toISOString(),
      });
      startPolling(campaign_id);
    } catch (err: unknown) {
      setSending(false);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to start email blast.";
      setError(msg);
    }
  };

  const handleSendNext = async (campaign: CampaignStatus) => {
    if (campaign.remaining === 0) return;
    setSending(true);
    setActiveCampaign({ ...campaign, status: "pending" });
    try {
      await sendNextBatch(campaign.campaign_id, ADMIN_PASSWORD);
      startPolling(campaign.campaign_id);
    } catch (err: unknown) {
      setSending(false);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to resume campaign.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 text-lg">
            📢
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Email Blast</h1>
            <p className="text-sm text-gray-500">
              {totalUsers > 0 ? `${totalUsers} active users in database · ` : ""}Sends 50 at a time
            </p>
          </div>
        </div>

        {/* Compose card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl p-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">New Campaign</h2>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              placeholder="e.g. Exciting news from Blog2Video 🚀"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400
                disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Message Body
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Blank line between paragraphs. Each user gets "Hi [FirstName]," prepended automatically.
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={10}
              placeholder={`We just released something you've been waiting for...\n\nHead over to your dashboard to check it out.\n\n— Arslan & the Blog2Video team`}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400
                disabled:opacity-50 disabled:bg-gray-50 resize-y font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-r from-purple-600 to-purple-700
              hover:shadow-lg hover:-translate-y-[1px] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {sending ? "Sending…" : `Send to next 50 users →`}
          </button>
        </div>

        {/* Active campaign progress */}
        {activeCampaign && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Current Send</h2>
              <StatusBadge status={activeCampaign.status} />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: "Sent this batch", value: activeCampaign.sent_count, color: "text-green-600" },
                { label: "Failed", value: activeCampaign.failed_count, color: "text-red-500" },
                { label: "Remaining", value: activeCampaign.remaining, color: "text-gray-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center rounded-xl bg-gray-50 py-3 px-2">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <ProgressBar value={activeCampaign.already_reached} max={activeCampaign.total_users} />

            {activeCampaign.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-red-500 mb-2">
                  Failed deliveries
                </p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-red-50 border border-red-100 p-3 space-y-1">
                  {activeCampaign.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 font-mono">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {activeCampaign.status === "done" && activeCampaign.remaining > 0 && (
              <div className="mt-5 p-4 rounded-xl bg-purple-50 border border-purple-100">
                <p className="text-sm text-purple-800 font-medium mb-1">
                  {activeCampaign.remaining} users still haven't received this email.
                </p>
                <p className="text-xs text-purple-600 mb-3">
                  Come back tomorrow and click "Send next 50" to continue.
                </p>
              </div>
            )}

            {activeCampaign.status === "done" && activeCampaign.remaining === 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All users have received this campaign.
              </div>
            )}
          </div>
        )}

        {/* Past campaigns */}
        {!loadingHistory && campaigns.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl p-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-5">Past Campaigns</h2>
            <div className="space-y-4">
              {campaigns.map((c) => (
                <div key={c.campaign_id} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        {" · "}Reached {c.already_reached} of {c.total_users} users
                      </p>
                    </div>
                    <StatusBadge status={c.remaining === 0 ? "done" : c.status} />
                  </div>

                  <ProgressBar value={c.already_reached} max={c.total_users} />

                  {c.remaining > 0 && c.status !== "running" && (
                    <button
                      onClick={() => handleSendNext(c)}
                      disabled={sending}
                      className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold text-white
                        bg-gradient-to-r from-purple-600 to-purple-700
                        hover:shadow-md transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send next 50 →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
