import { useState } from "react";
import { useErrorModal } from "../contexts/ErrorModalContext";
import SecretInput from "./SecretInput";
import {
  connectContentSource,
  sourceErrorMessage,
  type BeehiivPublication,
  type ContentSourceConnection,
  type ContentSourcePlatform,
} from "../api/sources";

/** API-key sources. WordPress has its own form (WordPressConnectForm). */
type KeySourcePlatform = Exclude<ContentSourcePlatform, "wordpress">;

interface Props {
  platform: KeySourcePlatform;
  onConnected: (connection: ContentSourceConnection) => void;
  onCancel?: () => void;
  /** Updating an existing connection: its site URL (Ghost) / publication (Beehiiv).
   *  The key itself is never sent to the client, so it always starts empty. */
  initialSiteUrl?: string | null;
  initialPublicationId?: string | null;
}

const HELP: Record<KeySourcePlatform, string[]> = {
  ghost: [
    "In Ghost Admin, open Settings → Integrations.",
    "Click “Add custom integration” and name it Blog2Video.",
    "Copy the Admin API key (it looks like id:secret) and your site URL.",
  ],
  beehiiv: [
    "In Beehiiv, open Settings → Workspace settings → API.",
    "Click “Create new API key” and name it Blog2Video.",
    "Copy the key. It's only shown once.",
  ],
};

/**
 * Paste-a-key connect form for a content source, used on the Integrations page
 * (the create form's import tab links there instead of connecting inline).
 *
 * Beehiiv keys are workspace-wide, so a workspace with several publications
 * comes back with `needs_publication` and the user picks one here.
 */
export default function SourceConnectForm({
  platform,
  onConnected,
  onCancel,
  initialSiteUrl,
  initialPublicationId,
}: Props) {
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [publications, setPublications] = useState<BeehiivPublication[] | null>(null);
  const [publicationId, setPublicationId] = useState(initialPublicationId ?? "");
  const [submitting, setSubmitting] = useState(false);
  // Connection failures go to the app's "Oops" modal, not an inline box.
  const { showError } = useErrorModal();
  const [showHelp, setShowHelp] = useState(false);

  const isGhost = platform === "ghost";
  const canSubmit =
    apiKey.trim().length > 0 &&
    (!isGhost || siteUrl.trim().length > 0) &&
    (!publications || publicationId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await connectContentSource(platform, {
        api_key: apiKey.trim(),
        ...(isGhost ? { site_url: siteUrl.trim() } : {}),
        ...(publicationId ? { publication_id: publicationId } : {}),
      });
      if ("needs_publication" in data) {
        setPublications(data.needs_publication);
        setPublicationId(data.needs_publication[0]?.id ?? "");
        return;
      }
      setApiKey("");
      onConnected(data.connection);
    } catch (err) {
      showError(sourceErrorMessage(err, "Couldn't connect. Check the details and try again."), {
        variant: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={submit} className="space-y-3">
      {isGhost && (
        <label className="block">
          <span className={labelClass}>Site URL</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourblog.ghost.io"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className="block">
        <span className={labelClass}>
          {isGhost ? "Admin API key" : "API key"}
        </span>
        <SecretInput
          placeholder={isGhost ? "65f1…:a1b2c3…" : "Paste your Beehiiv API key"}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            // A different key may see different publications: re-ask only if
            // we were showing a list (keeps a prefilled publication otherwise).
            if (publications) {
              setPublications(null);
              setPublicationId("");
            }
          }}
          className={`${inputClass} font-mono`}
        />
      </label>

      {publications && (
        <label className="block">
          <span className={labelClass}>Publication</span>
          <select
            value={publicationId}
            onChange={(e) => setPublicationId(e.target.value)}
            className={inputClass}
          >
            {publications.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="text-xs text-purple-600 hover:text-purple-700"
      >
        {showHelp ? "Hide help" : "Where do I find this?"}
      </button>
      {showHelp && (
        <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
          {HELP[platform].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {submitting ? "Connecting…" : publications ? "Connect publication" : "Connect"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        Your key is encrypted and only used to read your posts
        {isGhost ? " and, when you ask, add videos to them" : ""}.
      </p>
    </form>
  );
}
