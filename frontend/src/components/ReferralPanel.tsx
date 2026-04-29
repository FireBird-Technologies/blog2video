import { useState, useEffect, useCallback } from "react";
import { getAffiliateStats, sendAffiliateInvites, AffiliateStats } from "../api/client";

export default function ReferralPanel() {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await getAffiliateStats();
      setStats(res.data);
    } catch {
      // silently ignore — non-critical
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleCopy = () => {
    if (!stats?.link) return;
    navigator.clipboard.writeText(stats.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendInvites = async () => {
    setError(null);
    setSendResult(null);
    const emails = emailInput
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!emails.length) {
      setError("Enter at least one email address.");
      return;
    }
    setSending(true);
    try {
      const res = await sendAffiliateInvites(emails);
      setSendResult(res.data);
      setEmailInput("");
      await loadStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to send invites. Try again.");
    } finally {
      setSending(false);
    }
  };

  const signupsCount = stats?.signups_count ?? 0;
  const maxSignups = stats?.max_signups ?? 10;
  const bonusEarned = stats?.bonus_earned ?? 0;
  const bonusPerSignup = stats?.bonus_per_signup ?? 3;

  return (
    <section className="glass-card p-6">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
        Refer Friends
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        Share your link. Each friend who signs up gets{" "}
        <span className="font-semibold text-purple-600">+{bonusPerSignup} free videos</span>.
        You earn{" "}
        <span className="font-semibold text-purple-600">+{bonusPerSignup} videos</span> per
        signup (up to {maxSignups} referrals).
      </p>

      {/* Stats row */}
      <div className="flex gap-6 mb-5">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {signupsCount}
            <span className="text-sm font-normal text-gray-400">/{maxSignups}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Signups</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{bonusEarned}</p>
          <p className="text-xs text-gray-500 mt-0.5">Bonus videos earned</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Your referral link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={stats?.link ?? "Loading…"}
            className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Email invite */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Send invite emails</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="friend@example.com, another@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendInvites()}
            className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <button
            onClick={handleSendInvites}
            disabled={sending}
            className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        {sendResult && (
          <p className="text-xs text-green-600 mt-1.5">
            {sendResult.sent > 0 && `${sendResult.sent} invite${sendResult.sent !== 1 ? "s" : ""} sent.`}
            {sendResult.failed > 0 && ` ${sendResult.failed} failed.`}
          </p>
        )}
      </div>
    </section>
  );
}
