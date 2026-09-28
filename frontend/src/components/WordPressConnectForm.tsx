import { useState } from "react";
import { useErrorModal } from "../contexts/ErrorModalContext";
import SecretInput from "./SecretInput";
import {
  connectWordPress,
  getWordPressComConnectUrl,
  sourceErrorMessage,
  type ContentSourceConnection,
  type WordPressCapabilities,
} from "../api/sources";
import { useOAuthPopup } from "../hooks/useOAuthPopup";

const HELP = [
  "In WordPress Admin, open Users → Profile.",
  "Scroll to “Application Passwords”, enter Blog2Video as the name and click “Add New Application Password”.",
  "Copy the generated password (shown only once) and enter it below with your WordPress username.",
];

interface Props {
  /** WordPress.com connect is disabled when the server has no OAuth app. */
  wordpressComEnabled: boolean;
  /** Called after either kind connects. Self-hosted also reports what the role can do. */
  onConnected: (connection: ContentSourceConnection | null, capabilities?: WordPressCapabilities) => void;
  onCancel?: () => void;
  /** Updating a self-hosted connection: its site URL and username. The
   *  application password is never sent to the client, so it starts empty. */
  initialSiteUrl?: string | null;
  initialUsername?: string | null;
}

/**
 * Connect a WordPress site, either way in:
 *  - WordPress.com — an OAuth popup; WordPress.com's own screen picks the site.
 *  - Application password — self-hosted (WordPress.org) sites, and WordPress.com
 *    paid plans with hosting features activated: site URL + username + an
 *    application password (core since 5.6), sent as HTTP Basic auth. Needs https.
 * Both end as the one "wordpress" connection. Styled to match SourceConnectForm.
 */
export default function WordPressConnectForm({
  wordpressComEnabled,
  onConnected,
  onCancel,
  initialSiteUrl,
  initialUsername,
}: Props) {
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Connection failures go to the app's "Oops" modal, not an inline box.
  const { showError } = useErrorModal();
  const fail = (message: string) => showError(message, { variant: "warning" });

  const popup = useOAuthPopup("wordpress", ({ ok, error: err, closed }) => {
    if (ok || closed) {
      // A closed popup may still have connected (the message can be lost when
      // the opener lost focus): let the page re-read the connection.
      onConnected(null);
      return;
    }
    fail(err || "Couldn't connect WordPress.com.");
  });

  const connectWpcom = async () => {
    popup.setConnecting(true);
    try {
      const { data } = await getWordPressComConnectUrl();
      popup.open(data.authorize_url);
    } catch (err) {
      popup.setConnecting(false);
      fail(sourceErrorMessage(err, "Connecting WordPress.com isn't available right now."));
    }
  };

  const canSubmit =
    !submitting && siteUrl.trim().length > 0 && username.trim().length > 0 && appPassword.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data } = await connectWordPress({
        site_url: siteUrl.trim(),
        username: username.trim(),
        app_password: appPassword,
      });
      setAppPassword("");
      onConnected(data.connection, data.capabilities);
    } catch (err) {
      fail(sourceErrorMessage(err, "Couldn't connect your WordPress site."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1";
  // Side by side on wide screens (WordPress.com narrower, it's only a button),
  // stretched to the same height; stacked on phones.
  const cardClass = "rounded-xl border border-gray-200 bg-white p-4 flex flex-col h-full min-w-0";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch">
      {/* WordPress.com */}
      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-900">WordPress.com</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">
          Use this if your site is hosted on WordPress.com (yoursite.wordpress.com or a custom domain),
          on any plan. Sign in with your WordPress.com account and choose the site.
        </p>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 mb-4">
          <p className="text-[11px] font-medium text-gray-700 mb-1.5">What goes into your posts</p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-600">
            <li>
              <span className="font-medium text-gray-700">Premium, Business and Commerce:</span> the video
              itself, uploaded to your site.
            </li>
            <li>
              <span className="font-medium text-gray-700">Personal:</span> an embedded video player, once
              hosting features are activated.
            </li>
            <li>
              <span className="font-medium text-gray-700">Free (or Personal without hosting features):</span> a
              click-to-watch thumbnail that opens the video.
            </li>
          </ul>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          No password to copy. You can remove access any time in your WordPress.com account settings.
        </p>
        <button
          type="button"
          onClick={() => void connectWpcom()}
          disabled={!wordpressComEnabled || popup.connecting}
          className="mt-auto self-start px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {popup.connecting ? "Connecting…" : "Connect with WordPress.com"}
        </button>
        {!wordpressComEnabled && (
          <p className="text-[11px] text-gray-400 mt-2">Connecting WordPress.com isn't available right now.</p>
        )}
        {popup.blockedUrl && (
          <p className="text-xs text-gray-600 mt-2">
            Your browser blocked the popup.{" "}
            <a href={popup.blockedUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">
              Open WordPress.com to connect
            </a>
            , then come back here.
          </p>
        )}
      </section>

      {/* Self-hosted */}
      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-900">Application password</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">
          Use this if you run WordPress on your own hosting (WordPress.org), or have a WordPress.com
          site on a paid plan with hosting features activated. Your site needs https.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className={labelClass}>Site URL</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yourblog.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={labelClass}>Username</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Your WordPress username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Application password</span>
            <SecretInput
              placeholder="abcd efgh ijkl mnop qrst uvwx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
          </div>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs text-purple-600 hover:text-purple-700"
          >
            {showHelp ? "Hide help" : "Where do I find this?"}
          </button>
          {showHelp && (
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
              {HELP.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? "Connecting…" : "Connect"}
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
            Your application password is encrypted and only used to read your posts and, when you ask, add videos to them.
          </p>
        </form>
      </section>
    </div>
  );
}
