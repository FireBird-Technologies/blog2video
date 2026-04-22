import { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  sendBlastEmail,
  getCampaignStatus,
  listCampaigns,
  deleteCampaign,
  previewUsers,
  CampaignStatus,
  PreviewUser,
} from "../api/admin";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const ADMIN_PASSWORD = "blog2video-44";
const POLL_INTERVAL_MS = 2000;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{pct}% sent</span>
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
  const map: Record<string, [string, string]> = {
    pending: ["bg-yellow-100 text-yellow-700", "Starting…"],
    running: ["bg-purple-100 text-purple-700", "Sending…"],
    done:    ["bg-green-100 text-green-700",   "Done"],
  };
  const [cls, label] = map[status] ?? ["bg-gray-100 text-gray-600", status];
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    free:     "bg-gray-100 text-gray-500",
    standard: "bg-blue-100 text-blue-700",
    pro:      "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[plan] ?? "bg-gray-100 text-gray-500"}`}>
      {plan}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

type Tab = "compose" | "campaigns";

// ─── Compose tab ──────────────────────────────────────────────────────────────

interface ComposeTabProps {
  initialSubject?: string;
  initialBody?: string;
  initialOffset?: number;
}

function ComposeTab({ initialSubject = "", initialBody = "", initialOffset = 0 }: ComposeTabProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody]       = useState(initialBody);
  const [userFilter, setUserFilter] = useState<"all" | "free" | "paid">("all");
  const [limit, setLimit]   = useState(50);
  const [offset, setOffset] = useState(initialOffset);

  const [previewing, setPreviewing]   = useState(false);
  const [previewList, setPreviewList] = useState<PreviewUser[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewError, setPreviewError] = useState("");

  const [sending, setSending]           = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<CampaignStatus | null>(null);
  const [sendError, setSendError]       = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setSubject(initialSubject); }, [initialSubject]);
  useEffect(() => { setBody(initialBody); }, [initialBody]);
  useEffect(() => { setOffset(initialOffset); }, [initialOffset]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const resetPreview = () => setPreviewList(null);

  const handlePreview = async () => {
    setPreviewError("");
    setPreviewing(true);
    try {
      const res = await previewUsers({ password: ADMIN_PASSWORD, user_filter: userFilter, limit, offset });
      setPreviewList(res.data.users);
      setPreviewTotal(res.data.total);
    } catch {
      setPreviewError("Failed to load recipients. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    setSendError("");
    setSending(true);
    try {
      const res = await sendBlastEmail({
        subject, body, password: ADMIN_PASSWORD,
        user_filter: userFilter, limit, offset,
      });
      const { campaign_id, total_users } = res.data;
      setPreviewList(null);
      setActiveCampaign({
        campaign_id, subject, status: "pending",
        total_users, sent_count: 0, failed_count: 0,
        errors: [], created_at: new Date().toISOString(),
      });
      pollRef.current = setInterval(async () => {
        try {
          const r = await getCampaignStatus(campaign_id, ADMIN_PASSWORD);
          setActiveCampaign(r.data);
          if (r.data.status === "done") { stopPolling(); setSending(false); }
        } catch { stopPolling(); setSending(false); }
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      setSending(false);
      setSendError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to start the email campaign. Please try again."
      );
    }
  };

  return (
    <>
    {/* Full-page sending overlay */}
    {sending && ReactDOM.createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
        <Spinner />
        <p className="mt-4 text-sm font-medium text-gray-600">Sending…</p>
      </div>,
      document.body
    )}

    <div className="space-y-4">
      {/* Targeting */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Targeting</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Audience</label>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value as "all" | "free" | "paid"); resetPreview(); }}
              disabled={sending}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="all">All users</option>
              <option value="free">Free plan</option>
              <option value="paid">Paid plans</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Limit</label>
            <input
              type="number" value={limit} min={0}
              onChange={(e) => { setLimit(Math.max(0, parseInt(e.target.value) || 0)); resetPreview(); }}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={sending}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Offset</label>
            <input
              type="number" value={offset} min={0}
              onChange={(e) => { setOffset(Math.max(0, parseInt(e.target.value) || 0)); resetPreview(); }}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={sending}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Email Content</p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject line</label>
          <input
            type="text" value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
            placeholder="e.g. Exciting news from Blog2Video"
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Message body</label>
          <p className="text-xs text-gray-400 mb-2">
            Separate paragraphs with a blank line. A personalised greeting ("Hi [Name],") is prepended automatically.
            An unsubscribe link is included in the footer of every email.
          </p>
          <textarea
            value={body} rows={10}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending}
            placeholder={`We just shipped a feature you're going to love.\n\nHead over to your dashboard to check it out.\n\n— Arslan & the Blog2Video team`}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:bg-gray-50 resize-y font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* Preview button */}
      {!sending && (
        <button
          onClick={handlePreview}
          disabled={previewing || !subject.trim() || !body.trim()}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {previewing ? <><Spinner /><span>Loading recipients…</span></> : "Preview Recipients →"}
        </button>
      )}

      {previewError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{previewError}</div>
      )}

      {/* Recipient list + confirm */}
      {previewList && !sending && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recipients — {previewList.length} of {previewTotal} {userFilter !== "all" ? (userFilter === "free" ? "free" : "paid") : ""} users
            </p>
            <button onClick={resetPreview} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>

          {previewList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No users match these criteria.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50 mb-4">
              {previewList.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name || "—"}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <PlanBadge plan={u.plan} />
                </div>
              ))}
            </div>
          )}

          {sendError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{sendError}</div>
          )}

          {previewList.length > 0 && (
            <button
              onClick={handleSend}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:shadow-md hover:-translate-y-[1px] transition-all"
            >
              Confirm & Send to {previewList.length} recipients →
            </button>
          )}
        </div>
      )}

      {/* Active campaign progress */}
      {activeCampaign && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Campaign Progress</p>
            <StatusBadge status={activeCampaign.status} />
          </div>

          {sending && activeCampaign.status !== "done" && (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <Spinner />
              <p className="text-sm text-gray-500">Sending…</p>
            </div>
          )}

          {(!sending || activeCampaign.status === "done") && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center rounded-lg bg-gray-50 py-3">
                  <p className="text-xl font-bold text-green-600">{activeCampaign.sent_count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sent</p>
                </div>
                <div className="text-center rounded-lg bg-gray-50 py-3">
                  <p className="text-xl font-bold text-red-500">{activeCampaign.failed_count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Failed</p>
                </div>
              </div>
              <ProgressBar value={activeCampaign.sent_count} max={activeCampaign.total_users} />
              {activeCampaign.status === "done" && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Campaign complete — {activeCampaign.sent_count} sent, {activeCampaign.failed_count} failed.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

// ─── Campaigns tab ────────────────────────────────────────────────────────────

interface CampaignsTabProps {
  onResend: (subject: string, body: string, sentCount: number) => void;
}

function CampaignsTab({ onResend }: CampaignsTabProps) {
  const [campaigns, setCampaigns]         = useState<CampaignStatus[]>([]);
  const [loading, setLoading]             = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCampaigns(ADMIN_PASSWORD);
      setCampaigns(res.data.campaigns);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleDelete = async () => {
    if (confirmDeleteId === null) return;
    await deleteCampaign(confirmDeleteId, ADMIN_PASSWORD);
    setCampaigns((prev) => prev.filter((c) => c.campaign_id !== confirmDeleteId));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center gap-3 text-sm text-gray-400">
        <Spinner />
        <span>Loading campaigns…</span>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
        No campaigns yet. Compose your first one.
      </div>
    );
  }

  const campaignToDelete = campaigns.find((c) => c.campaign_id === confirmDeleteId);

  return (
    <>
      <ConfirmDeleteModal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete campaign?"
        subtitle={campaignToDelete?.subject}
        warningMessage="This will permanently remove the campaign record. This cannot be undone."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleDelete}
      />

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Past Campaigns</p>
          <button onClick={fetchCampaigns} className="text-xs text-purple-600 hover:underline">Refresh</button>
        </div>
        {campaigns.map((c) => (
          <div key={c.campaign_id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-sm font-semibold text-gray-800 truncate flex-1">{c.subject}</p>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {c.created_at
                ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : ""}
              {" · "}
              {c.sent_count} sent · {c.failed_count} failed · {c.total_users} targeted
            </p>
            <ProgressBar value={c.sent_count} max={c.total_users} />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onResend(c.subject, c.body ?? "", c.sent_count)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all"
              >
                Re-use in Compose →
              </button>
              <button
                onClick={() => setConfirmDeleteId(c.campaign_id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminEmailBlast() {
  const [tab, setTab] = useState<Tab>("compose");
  const [resendSubject, setResendSubject] = useState("");
  const [resendBody, setResendBody]       = useState("");
  const [resendOffset, setResendOffset]   = useState(0);
  const [composeKey, setComposeKey]       = useState(0);

  const handleResend = (subject: string, body: string, sentCount: number) => {
    setResendSubject(subject);
    setResendBody(body);
    setResendOffset(sentCount);
    setComposeKey((k) => k + 1);
    setTab("compose");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Blast</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send targeted campaigns to your users</p>
        </div>

        {/* Tab bar — matches Dashboard style */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100/60 rounded-xl">
          {(["compose", "campaigns"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "compose" ? "Compose" : "Campaigns"}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "compose" && (
          <ComposeTab
            key={composeKey}
            initialSubject={resendSubject}
            initialBody={resendBody}
            initialOffset={resendOffset}
          />
        )}
        {tab === "campaigns" && (
          <CampaignsTab onResend={handleResend} />
        )}

      </div>
    </div>
  );
}
