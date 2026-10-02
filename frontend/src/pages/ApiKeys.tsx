import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  BACKEND_URL,
  createApiKey,
  listApiKeys,
  revealApiKey,
  revokeApiKey,
  rotateApiKey,
  type ApiKeyInfo,
  type CreatedApiKey,
} from "../api/client";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { useAuth } from "../hooks/useAuth";
import { isPaidPlan } from "../lib/plan";

const MAX_ACTIVE_KEYS = 10;

function apiHost(): string {
  return BACKEND_URL || window.location.origin;
}

function parseUtc(value: string): Date {
  return new Date(/Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const seconds = Math.round((Date.now() - parseUtc(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return parseUtc(value).toLocaleDateString();
}

function shortDate(value: string): string {
  return parseUtc(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

type CopyFn = (id: string, text: string | Promise<string>) => Promise<void>;

/**
 * Copy text (or text still being fetched) and flag which button did it.
 *
 * A pending value goes through ClipboardItem so the write starts inside the
 * click itself: Safari rejects clipboard writes that happen after an await.
 */
function useCopy(): [string | null, CopyFn] {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const copy = useCallback<CopyFn>(async (id, text) => {
    if (typeof text !== "string" && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
    setCopiedId(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedId(null), 2000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [copiedId, copy];
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeWidth={2.2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function KeyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}

function KeyRevealModal({
  revealed,
  copied,
  onCopy,
  onClose,
}: {
  revealed: { key: CreatedApiKey; rotated: boolean };
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-reveal-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <KeyIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="key-reveal-title" className="text-base font-semibold text-gray-900">
              {revealed.rotated ? "API key rotated" : "API key created"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {revealed.rotated
                ? `"${revealed.key.name}" has a new key. The previous key no longer works; update your application.`
                : `"${revealed.key.name}" is ready to use. Keep it secret and store it securely.`}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-stretch gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-gray-200/60 bg-gray-50 px-4 py-2.5 font-mono text-xs text-gray-800">
            {revealed.key.key}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className={`inline-flex shrink-0 items-center gap-1.5 px-4 text-xs font-medium rounded-xl transition-colors ${
              copied ? "text-green-600 bg-green-50" : "text-white bg-purple-600 hover:bg-purple-700"
            }`}
          >
            <CopyIcon done={copied} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">You can copy this key again later from Your keys.</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ApiKeys() {
  const { user } = useAuth();
  const paid = isPaidPlan(user?.plan);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed] = useState<{ key: CreatedApiKey; rotated: boolean } | null>(null);
  const [toRotate, setToRotate] = useState<ApiKeyInfo | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiKeyInfo | null>(null);
  const [copiedId, copy] = useCopy();
  const base = apiHost();
  const atLimit = keys.length >= MAX_ACTIVE_KEYS;

  const load = useCallback(async () => {
    try {
      const res = await listApiKeys();
      setKeys(res.data);
    } catch (err) {
      setError(errorMessage(err, "Could not load your API keys."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (creating) return;
    if (!name) {
      nameInput.current?.focus();
      return;
    }
    setCreating(true);
    try {
      const res = await createApiKey(name);
      setRevealed({ key: res.data, rotated: false });
      setNewName("");
      setError(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not create the API key."));
    } finally {
      setCreating(false);
    }
  };

  const copyStoredKey = (key: ApiKeyInfo) => {
    if (!key.can_reveal) {
      setNotice(`"${key.name}" was created before keys could be copied again. Rotate it once to get a key you can copy anytime.`);
      return;
    }
    setNotice(null);
    setError(null);
    copy(
      `row-${key.id}`,
      revealApiKey(key.id).then((res) => res.data.key),
    ).catch((err) => setError(errorMessage(err, "Could not copy the key. Please try again.")));
  };

  const handleRotate = async () => {
    if (!toRotate) return;
    try {
      const res = await rotateApiKey(toRotate.id);
      setNotice(null);
      setRevealed({ key: res.data, rotated: true });
      setError(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not rotate the API key."));
      throw err;
    }
  };

  const handleRevoke = async () => {
    if (!toRevoke) return;
    try {
      await revokeApiKey(toRevoke.id);
      if (revealed?.key.id === toRevoke.id) setRevealed(null);
      setError(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not revoke the API key."));
      throw err;
    }
  };

  const sectionTitle = "text-sm font-medium text-gray-500 uppercase tracking-wider";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-900 transition-colors mb-4 flex w-fit items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-400 mt-1">
            Use API keys to access the Blog2Video API from your applications. Usage counts toward your plan,
            including videos your app creates for its own users. Keep keys on your server.
          </p>
        </div>
        <Link
          to="/api-docs"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          API Documentation
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>

      {/* Summary */}
      {paid && (
        <div className="grid gap-4 sm:grid-cols-3">
          <section className="glass-card p-5">
            <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Base URL</h2>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{base}</code>
              <button
                type="button"
                onClick={() => copy("base", base).catch(() => undefined)}
                className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
                  copiedId === "base"
                    ? "text-green-700 bg-green-50 border-green-200"
                    : "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
                }`}
                aria-label="Copy base URL"
                title={copiedId === "base" ? "Copied" : "Copy base URL"}
              >
                <CopyIcon done={copiedId === "base"} />
              </button>
            </div>
          </section>
          <section className="glass-card p-5">
            <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Active keys</h2>
            <p className="text-2xl font-bold text-gray-900">
              {keys.length}
              <span className="ml-1 text-sm font-normal text-gray-400">/ {MAX_ACTIVE_KEYS}</span>
            </p>
          </section>
          <section className="glass-card p-5">
            <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Videos this period</h2>
            <p className="text-2xl font-bold text-gray-900">
              {user?.videos_used_this_period ?? 0}
              <span className="ml-1 text-sm font-normal text-gray-400">/ {user?.video_limit ?? 0}</span>
            </p>
          </section>
        </div>
      )}

      {/* Create an API key */}
      {paid && (
        <section className="glass-card p-6">
          <form onSubmit={handleCreate}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <KeyIcon className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="api-key-name" className="block text-base font-semibold text-gray-900">
                  Create an API key
                </label>
                <p className="text-sm text-gray-500 mt-0.5">Name it after the application that will use it.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                id="api-key-name"
                ref={nameInput}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                disabled={atLimit}
                placeholder={atLimit ? `You can have at most ${MAX_ACTIVE_KEYS} active keys` : "e.g. Production CMS"}
                className="min-w-0 flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={atLimit || creating}
                className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Upgrade prompt */}
      {!paid && (
        <section className="glass-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <KeyIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">API access is included with every paid plan</p>
              <p className="text-xs text-gray-400 mt-1">Upgrade to create API keys and generate videos from your applications.</p>
            </div>
            <Link
              to="/subscription"
              className="inline-flex justify-center px-5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              View Plans
            </Link>
          </div>
        </section>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="flex items-start justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-amber-700 hover:text-amber-900" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Keys */}
      {paid && (
        <section className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className={sectionTitle}>Your keys</h2>
            {atLimit && (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
                Key limit reached
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <KeyIcon className="w-6 h-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">No API keys yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a key above to get started.</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-12 gap-4 border-b border-gray-100 pb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 md:grid">
                <span className="col-span-3">Name</span>
                <span className="col-span-4">Key</span>
                <span className="col-span-2">Created</span>
                <span className="col-span-1">Last used</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {keys.map((key) => {
                  const copied = copiedId === `row-${key.id}`;
                  return (
                    <li key={key.id} className="grid grid-cols-1 gap-2 py-3.5 md:grid-cols-12 md:items-center md:gap-4">
                      <p className="truncate text-sm font-medium text-gray-900 md:col-span-3">{key.name}</p>
                      <div className="flex items-center gap-2 md:col-span-4">
                        <code className="whitespace-nowrap rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                          {key.prefix}…{key.last4}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyStoredKey(key)}
                          title={key.can_reveal ? "Copy the full key" : "Rotate this key once to make it copyable"}
                          aria-label={`Copy ${key.name} key`}
                          className={`inline-flex shrink-0 items-center gap-1.5 py-1 text-xs font-semibold transition-colors ${
                            copied ? "text-green-700" : "text-gray-900 hover:text-gray-600"
                          }`}
                        >
                          <CopyIcon done={copied} />
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 md:col-span-2">
                        <span className="md:hidden">Created </span>
                        {shortDate(key.created_at)}
                      </p>
                      <p className="text-xs text-gray-400 md:col-span-1">
                        <span className="md:hidden">Last used </span>
                        {relativeTime(key.last_used_at)}
                      </p>
                      <div className="flex gap-2 md:col-span-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => setToRotate(key)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Rotate
                        </button>
                        <button
                          type="button"
                          onClick={() => setToRevoke(key)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {revealed && (
        <KeyRevealModal
          revealed={revealed}
          copied={copiedId === "revealed"}
          onCopy={() => copy("revealed", revealed.key.key).catch(() => undefined)}
          onClose={() => setRevealed(null)}
        />
      )}
      <ConfirmDeleteModal
        open={toRotate !== null}
        onClose={() => setToRotate(null)}
        title={`Rotate "${toRotate?.name ?? ""}"?`}
        subtitle="You'll get a new key with the same name."
        warningMessage="The current key stops working immediately. Update your app with the new key right after rotating."
        confirmLabel="Rotate key"
        confirmLoadingLabel="Rotating…"
        iconVariant="warning"
        onConfirm={handleRotate}
      />
      <ConfirmDeleteModal
        open={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        title={`Revoke "${toRevoke?.name ?? ""}"?`}
        subtitle="Apps using this key will stop working immediately."
        confirmLabel="Revoke key"
        confirmLoadingLabel="Revoking…"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
