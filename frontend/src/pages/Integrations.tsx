import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SourceConnectForm from "../components/SourceConnectForm";
import WordPressConnectForm from "../components/WordPressConnectForm";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import MCPConnector from "./MCPConnector";
import {
  INTEGRATION_LABELS,
  INTEGRATION_LOGOS,
  INTEGRATION_PLATFORMS,
  disconnectContentSource,
  getContentSourceConnections,
  getContentSourcesConfig,
  type ContentSourceConnection,
  type IntegrationPlatform,
} from "../api/sources";

const LOGO_SRC = INTEGRATION_LOGOS;

type IntegrationTab = IntegrationPlatform;
const TAB_LABELS = INTEGRATION_LABELS;
/** Page tabs: the content sources, then the MCP "Connect with AI" setup. */
type PageTab = IntegrationTab | "ai";
const TABS: PageTab[] = [...INTEGRATION_PLATFORMS, "ai"];
const PAGE_TAB_LABELS: Record<PageTab, string> = { ...TAB_LABELS, ai: "Connect with AI" };

const BLURB: Record<IntegrationTab, string> = {
  ghost:
    "Turn any Ghost post into a video, including drafts and members-only posts. When it's ready, add it to the original post or publish it as a new draft post.",
  beehiiv:
    "Turn any Beehiiv post into a video, including drafts and premium posts. When it's ready, add a click-to-watch thumbnail to your next newsletter.",
  wordpress:
    "Turn any WordPress post into a video, including drafts and private posts. When it's ready, add it to the original post or publish it as a new draft post.",
};

/** What the first detail column shows for each platform. */
const ACCOUNT_LABEL: Record<IntegrationTab, string> = {
  ghost: "Site",
  beehiiv: "Publication",
  wordpress: "Site",
};

/** Display shape for a connected source. */
interface ConnectionView {
  accountName: string | null;
  avatarUrl: string | null;
  siteUrl: string | null;
  needsReconnect: boolean;
  connectedAt: string | null;
  /** WordPress: "WordPress.com" or "Self-hosted · <username>". */
  kind: string | null;
}

const toView = (c: ContentSourceConnection): ConnectionView => ({
  accountName: c.account_name,
  avatarUrl: c.account_avatar_url,
  siteUrl: c.site_url,
  needsReconnect: c.status !== "active",
  connectedAt: c.connected_at,
  kind:
    c.platform !== "wordpress"
      ? null
      : c.auth_kind === "wpcom_oauth"
        ? "WordPress.com"
        : `Self-hosted${c.username ? ` · ${c.username}` : ""}`,
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });


export default function Integrations() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<ContentSourceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<IntegrationTab | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<IntegrationTab | null>(null);
  const [loadError, setLoadError] = useState(false);
  // ?source=<platform> (from the create form's "Connect" button) opens that tab.
  const [searchParams] = useSearchParams();
  const requestedSource = searchParams.get("source");
  const [activeTab, setActiveTab] = useState<PageTab>(
    TABS.includes(requestedSource as PageTab) ? (requestedSource as PageTab) : "ghost"
  );
  const [wordpressComEnabled, setWordpressComEnabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [cfg, conns] = await Promise.all([
        getContentSourcesConfig(),
        getContentSourceConnections(),
      ]);
      setEnabled(cfg.data.enabled);
      setWordpressComEnabled(!!cfg.data.wordpress_com_enabled);
      setConnections(conns.data.connections);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectionFor = (tab: IntegrationTab): ConnectionView | null => {
    const c = connections.find((x) => x.platform === tab);
    return c?.connected ? toView(c) : null;
  };

  const renderForm = (tab: IntegrationTab, onCancel?: () => void) => {
    // Updating: prefill what we know; the key/password itself is never returned.
    const existing = connections.find((c) => c.platform === tab && c.connected);
    const selfHosted = existing?.auth_kind === "app_password" ? existing : undefined;
    return tab === "wordpress" ? (
      <WordPressConnectForm
        wordpressComEnabled={wordpressComEnabled}
        initialSiteUrl={selfHosted?.site_url}
        initialUsername={selfHosted?.username}
        onConnected={(c) => {
          // WordPress.com connects in a popup, so re-read to pick it up; the
          // self-hosted form hands back the connection and what the role can do.
          if (c) setConnections((prev) => [...prev.filter((x) => x.platform !== c.platform), c]);
          else void refresh();
          setEditing(null);
        }}
        onCancel={onCancel}
      />
    ) : (
      <SourceConnectForm
        platform={tab}
        initialSiteUrl={tab === "ghost" ? existing?.site_url : undefined}
        initialPublicationId={tab === "beehiiv" ? existing?.publication_id : undefined}
        onConnected={(c) => {
          setConnections((prev) => [...prev.filter((x) => x.platform !== c.platform), c]);
          setEditing(null);
        }}
        onCancel={onCancel}
      />
    );
  };

  const renderPanel = (tab: IntegrationTab) => {
    const conn = connectionFor(tab);
    const label = TAB_LABELS[tab];
    const showForm = editing === tab || !conn;
    return (
      <section>
        <div className="flex items-start gap-4">
          <img
            src={LOGO_SRC[tab]}
            alt={label}
            width={36}
            height={36}
            className="w-11 h-11 flex-shrink-0 object-contain rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
            <p className="text-sm text-gray-600 leading-relaxed mt-1 max-w-2xl">{BLURB[tab]}</p>

            {conn && editing !== tab && (
              // Phones: one 2-column grid, so each button sits under a detail column.
              // sm+: details on the left, buttons on the right of the same row.
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-10">
                <dl className="contents sm:flex sm:flex-wrap sm:gap-x-24 sm:gap-y-5 text-sm">
                  <div className="min-w-0 max-w-[16rem]">
                    <dt className="text-xs text-gray-500">{ACCOUNT_LABEL[tab]}</dt>
                    <dd className="mt-1 flex items-center gap-2 font-medium text-gray-900 min-w-0">
                      {conn.avatarUrl && (
                        <img src={conn.avatarUrl} alt="" className="w-6 h-6 rounded flex-shrink-0 object-cover" />
                      )}
                      <span className="truncate">{conn.accountName || "—"}</span>
                    </dd>
                  </div>
                  {/* Beehiiv's API gives no site URL (the publication is known by id). */}
                  {tab !== "beehiiv" && (
                    <div className="min-w-0 max-w-[16rem]">
                      <dt className="text-xs text-gray-500">Site URL</dt>
                      <dd className="mt-1 truncate">
                        {conn.siteUrl ? (
                          <a
                            href={conn.siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline"
                          >
                            {conn.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        ) : (
                          <span className="text-gray-900">—</span>
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-gray-500">Status</dt>
                    <dd className={`mt-1 font-medium ${conn.needsReconnect ? "text-amber-700" : "text-gray-900"}`}>
                      {conn.needsReconnect ? "Needs reconnecting" : "Connected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Connected on</dt>
                    <dd className="mt-1 font-medium text-gray-900">
                      {conn.connectedAt ? formatDate(conn.connectedAt) : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="contents sm:flex sm:items-center sm:gap-3 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(tab)}
                    className="justify-self-start px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {conn.needsReconnect || conn.kind === "WordPress.com"
                      ? "Reconnect"
                      : tab === "wordpress"
                        ? "Update password"
                        : "Update key"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(tab)}
                    className="justify-self-start px-5 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-full hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            {showForm && (
              <div className="mt-6">
                {renderForm(tab, conn ? () => setEditing(null) : undefined)}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
      <p className="text-sm text-gray-600 leading-relaxed mt-2 mb-8 max-w-3xl">
        {activeTab === "ai"
          ? "Use Blog2Video from Claude, ChatGPT or n8n: create, edit and render videos without leaving your AI assistant or automations."
          : `Connect your ${TAB_LABELS[activeTab]} account once and pick any of your posts, drafts included, to turn into a video. No copying and pasting links.`}
      </p>

      {/* Tab bar — same segmented style as the Dashboard tabs */}
      <div className="inline-flex flex-wrap gap-3 p-1 bg-gray-100/60 rounded-xl mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-1 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {PAGE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "ai" ? (
        <MCPConnector embedded />
      ) : loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : loadError ? (
        <div className="text-sm text-red-600">Couldn't load your integrations. Refresh to try again.</div>
      ) : enabled === false ? (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4">
          Integrations aren't available right now.
        </div>
      ) : (
        renderPanel(activeTab)
      )}

      <ConfirmDeleteModal
        open={confirmDisconnect !== null}
        onClose={() => setConfirmDisconnect(null)}
        title={`Disconnect ${confirmDisconnect ? TAB_LABELS[confirmDisconnect] : ""}?`}
        subtitle="Your videos are kept."
        warningMessage={
          confirmDisconnect === "wordpress"
            ? connections.find((c) => c.platform === "wordpress")?.auth_kind === "wpcom_oauth"
              ? "We'll remove this WordPress.com connection. You can reconnect later."
              : "We'll forget the saved application password. It stays on your site. You can reconnect later."
            : confirmDisconnect === "beehiiv"
              ? "We'll remove the saved Beehiiv API key. You can reconnect later."
              : "We'll remove the saved Ghost Admin API key. You can reconnect later."
        }
        confirmLabel="Disconnect"
        confirmLoadingLabel="Disconnecting…"
        iconVariant="warning"
        onConfirm={async () => {
          if (!confirmDisconnect) return;
          await disconnectContentSource(confirmDisconnect);
          await refresh();
        }}
      />
    </div>
  );
}
