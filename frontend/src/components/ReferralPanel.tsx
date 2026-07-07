// Share B2V (referral/invite) disabled — this component is no longer rendered.
// Its referral client calls are commented out in api/client.ts; @ts-nocheck keeps
// the preserved code from failing the build on those now-missing imports.
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
// import { getAffiliateStats, sendAffiliateInvites, AffiliateStats } from "../api/client";

export default function ReferralPanel() {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await getAffiliateStats();
      setStats(res.data);
    } catch {
      // silently ignore — non-critical
    } finally {
      setLoadingStats(false);
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

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const mergeUniqueEmails = (existing: string[], incoming: string[]) => {
    const seen = new Set(existing.map((email) => email.toLowerCase()));
    const next = [...existing];
    for (const email of incoming) {
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        next.push(email);
      }
    }
    return next;
  };

  const processInputEmails = () => {
    const tokens = emailInput
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!tokens.length) return { added: 0, invalid: 0 };

    const valid: string[] = [];
    const invalid: string[] = [];
    for (const token of tokens) {
      if (isValidEmail(token)) valid.push(token);
      else invalid.push(token);
    }

    if (valid.length) {
      setPendingEmails((prev) => mergeUniqueEmails(prev, valid));
    }
    setEmailInput("");

    if (invalid.length) {
      setError(
        `${invalid.length} invalid email${invalid.length === 1 ? "" : "s"} ignored.`
      );
    } else {
      setError(null);
    }

    return { added: valid.length, invalid: invalid.length };
  };

  const removePendingEmail = (emailToRemove: string) => {
    setPendingEmails((prev) =>
      prev.filter((email) => email.toLowerCase() !== emailToRemove.toLowerCase())
    );
  };

  const handleSendInvites = async () => {
    setSendResult(null);

    processInputEmails();

    const emailsToSend = (() => {
      const tokens = emailInput
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const validTokens = tokens.filter((token) => isValidEmail(token));
      return mergeUniqueEmails(pendingEmails, validTokens);
    })();

    if (!emailsToSend.length) {
      setError("Enter at least one email address.");
      return;
    }

    setSending(true);
    try {
      const res = await sendAffiliateInvites(emailsToSend);
      setSendResult(res.data);
      setEmailInput("");
      setPendingEmails([]);
      setError(null);
      setTimeout(() => setSendResult(null), 3000);
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
  const bonusPerSignup = stats?.bonus_per_signup ?? 5;
  const maxReferralReached = signupsCount >= maxSignups;

  return (
    <section className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Refer Friends
        </h2>
        <div className="flex items-baseline gap-1.5 shrink-0">
          {loadingStats ? (
            <div className="h-5 w-8 bg-gray-100 rounded animate-pulse flex items-center justify-center gap-1.5">
              <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse" />
              <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse delay-100" />
              <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse delay-200" />
            </div>
          ) : (
            <span className="text-lg font-bold text-gray-900 leading-none">{bonusEarned}</span>
          )}
          <span className="text-[11px] text-gray-500">bonus videos earned</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Share your link. For every friend who signs up, you both get{" "}
        <span className="font-semibold text-purple-600">+{bonusPerSignup} free videos</span>.
      </p>

      {maxReferralReached && (
        <p className="text-xs text-green-600 mb-5">
          You have availed max referral bonuses.
        </p>
      )}

      {/* Referral link */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Your referral link</p>
        {loadingStats ? (
          <div className="h-[34px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center gap-1.5">
            <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse" />
            <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse delay-100" />
            <span className="w-[5px] h-[5px] bg-gray-400 rounded-full animate-pulse delay-200" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={stats?.link ?? ""}
              className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Email invite */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Send invite emails to claim your bonus</p>
        {pendingEmails.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2.5 py-1 text-[11px]"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removePendingEmail(email)}
                  className="text-purple-500 hover:text-purple-700"
                  aria-label={`Remove ${email}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="friend@example.com, another@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                processInputEmails();
              }
            }}
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
        {pendingEmails.length > 0 && !sendResult && (
          <p className="text-xs text-yellow-600 mt-1.5">
            Click the Send button to send invite emails.
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        {sendResult && (
          <p className="text-xs text-green-600 mt-1.5">
            {sendResult.sent > 0 && "Once your friends signup, you both will receive bonuses."}
            {sendResult.failed > 0 && ` ${sendResult.failed} failed.`}
          </p>
        )}
      </div>
    </section>
  );
}
