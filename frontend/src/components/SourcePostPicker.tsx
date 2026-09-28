import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  INTEGRATION_LABELS,
  INTEGRATION_LOGOS,
  INTEGRATION_PLATFORMS,
  isSourceConnectionUsable,
  sourceErrorMessage,
  type ContentSourceConnection,
  type IntegrationPlatform,
  type SourcePost,
  type SourcePostsPage,
} from "../api/sources";
import { createSourcePostsCache, type SourcePostsCache } from "./sourcePostsCache";

type AspectRatio = "landscape" | "portrait";

interface Props {
  platform: IntegrationPlatform;
  onPlatformChange: (platform: IntegrationPlatform) => void;
  selected: SourcePost[];
  onSelectedChange: (posts: SourcePost[]) => void;
  /** Upper bound on a multi-select; the create form passes its Multi Link limit (server caps at 20). */
  maxSelect?: number;
  /** Owned by the create form so posts survive step changes; a private one is used if omitted. */
  cache?: SourcePostsCache;
  /** Per-video format, indexed like `selected`; shown inline once several posts are selected. */
  aspectRatios?: AspectRatio[];
  onAspectRatioChange?: (index: number, value: AspectRatio) => void;
}

/** Posts shown per view; the arrows page through them. */
const PER_VIEW = 4;

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const flattenPages = (pages: SourcePostsPage[]) => pages.flatMap((p) => p.posts);

const STATUS_STYLE: Record<string, string> = {
  published: "bg-green-50 text-green-700 border-green-100",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-100",
  // WordPress
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  private: "bg-purple-50 text-purple-700 border-purple-100",
};

/**
 * Step-1 panel of the create form's "Integrations" tab: pick a connected
 * source, search its posts (drafts included), and select one or several.
 * Posts are shown PER_VIEW at a time; the server pages (20) are fetched on
 * demand as the user arrows forward. Everything loaded goes through `cache`,
 * so remounting (step 2 → back to step 1) restores the list without refetching. Connecting (or reconnecting) links out to
 * the Integrations page.
 *
 * Thumbnails are plain lazy <img> tags — never a player — to keep the list
 * cheap on mobile Safari.
 */
export default function SourcePostPicker({
  platform,
  onPlatformChange,
  selected,
  onSelectedChange,
  maxSelect = 20,
  cache: cacheProp,
  aspectRatios,
  onAspectRatioChange,
}: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cache = useMemo(() => cacheProp ?? createSourcePostsCache(), []);
  // Hydrate from the cache so a remount paints the same list and page instantly.
  const cachedConns = cache.peekConnections();
  const initialUi = cache.getUi(platform);
  const initialPages = cache.peekPages(platform, initialUi.search.trim());
  const lastInitialPage = initialPages?.[initialPages.length - 1];

  const [enabled, setEnabled] = useState(cachedConns?.enabled ?? true);
  const [connections, setConnections] = useState<ContentSourceConnection[] | null>(
    cachedConns?.connections ?? null
  );
  const [posts, setPosts] = useState<SourcePost[]>(() => (initialPages ? flattenPages(initialPages) : []));
  const [page, setPage] = useState(lastInitialPage?.page ?? 1);
  const [hasMore, setHasMore] = useState(lastInitialPage?.has_more ?? false);
  const [search, setSearch] = useState(initialUi.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialUi.search.trim());
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState(initialPages ? initialUi.view : 0);
  const [total, setTotal] = useState<number | null>(lastInitialPage?.total ?? null);
  const requestSeq = useRef(0);
  // Arrow position to restore once, on the first post load after mounting.
  const restoreView = useRef(initialUi.view);

  useEffect(() => {
    cache.setUi(platform, { search, view });
  }, [cache, platform, search, view]);

  const connection = connections?.find((c) => c.platform === platform) ?? null;
  const usable = isSourceConnectionUsable(connection);
  // Connecting happens on the Integrations page, opened on this platform's tab.
  const integrationsHref = `/dashboard?tab=integrations&source=${platform}`;

  const loadConnections = useCallback(async () => {
    try {
      const res = await cache.loadConnections();
      setEnabled(res.enabled);
      setConnections(res.connections);
      // Land on whichever source is actually connected — once per form, so
      // coming back to step 1 keeps the tab the user picked.
      const connected = res.connections.filter(isSourceConnectionUsable);
      if (!cache.landed && connected.length === 1 && connected[0].platform !== platform) {
        onPlatformChange(connected[0].platform);
      }
      cache.landed = true;
    } catch {
      setConnections([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean): Promise<boolean> => {
      const seq = ++requestSeq.current;
      setLoadingPosts(true);
      setError(null);
      try {
        const data = await cache.loadPage(platform, debouncedSearch, nextPage);
        if (seq !== requestSeq.current) return false;
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
        setPage(data.page);
        setHasMore(data.has_more);
        setTotal(data.total);
        return true;
      } catch (err) {
        if (seq !== requestSeq.current) return false;
        setError(sourceErrorMessage(err, "Couldn't load your posts."));
        const code = (err as { response?: { data?: { detail?: { error_code?: string } } } })
          ?.response?.data?.detail?.error_code;
        if (code === "invalid_key" || code === "not_connected" || code === "auth_header_stripped") {
          cache.invalidate(platform);
          void loadConnections();
        }
        return false;
      } finally {
        if (seq === requestSeq.current) setLoadingPosts(false);
      }
    },
    [cache, platform, debouncedSearch, loadConnections]
  );

  useEffect(() => {
    if (!usable) {
      setView(0);
      return;
    }
    const restore = restoreView.current;
    restoreView.current = 0;
    const cached = cache.peekPages(platform, debouncedSearch);
    if (cached) {
      // Already loaded this form session: show it, cancel any in-flight fetch.
      requestSeq.current++;
      setLoadingPosts(false);
      const all = flattenPages(cached);
      const last = cached[cached.length - 1];
      setPosts(all);
      setPage(last.page);
      setHasMore(last.has_more);
      setTotal(last.total);
      setView(restore * PER_VIEW < all.length ? restore : 0);
      return;
    }
    setView(0);
    setPosts([]);
    setTotal(null);
    void fetchPage(1, true);
  }, [cache, usable, platform, debouncedSearch, fetchPage]);

  const toggle = (post: SourcePost) => {
    const isSelected = selected.some((p) => p.id === post.id);
    if (isSelected) {
      onSelectedChange(selected.filter((p) => p.id !== post.id));
    } else if (selected.length < maxSelect) {
      onSelectedChange([...selected, post]);
    }
  };

  const switchPlatform = (p: IntegrationPlatform) => {
    if (p === platform) return;
    onSelectedChange([]);
    setSearch("");
    setPosts([]);
    setView(0);
    onPlatformChange(p);
  };

  const visiblePosts = posts.slice(view * PER_VIEW, view * PER_VIEW + PER_VIEW);
  const canPrev = view > 0;
  const canNext = (view + 1) * PER_VIEW < posts.length || hasMore;
  const goNext = async () => {
    if (!canNext || loadingPosts) return;
    if ((view + 1) * PER_VIEW >= posts.length) {
      const ok = await fetchPage(page + 1, false);
      if (!ok) return;
    }
    setView((v) => v + 1);
  };
  const rangeStart = posts.length === 0 ? 0 : view * PER_VIEW + 1;
  const rangeEnd = view * PER_VIEW + visiblePosts.length;

  if (!enabled) {
    return (
      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
        Importing from integrations isn't available right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
        {INTEGRATION_PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => switchPlatform(p)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              platform === p
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {INTEGRATION_LABELS[p]}
          </button>
        ))}
      </div>

      {connections === null ? (
        <div className="text-xs text-gray-400 py-6 text-center">Loading…</div>
      ) : !usable ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-4 text-center">
          <img
            src={INTEGRATION_LOGOS[platform]}
            alt=""
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
          />
          <p className="text-[11px] text-gray-500">
          {connection && connection.status !== "active"
            ? `Your ${
                platform !== "wordpress"
                  ? `${INTEGRATION_LABELS[platform]} key`
                  : connection.auth_kind === "wpcom_oauth"
                    ? "WordPress.com connection"
                    : "WordPress application password"
              } stopped working. Reconnect to keep importing posts.`
            : `Connect your ${INTEGRATION_LABELS[platform]} account to pick posts here, drafts included.`}
          </p>
          <Link
            to={integrationsHref}
            className="text-xs font-medium text-purple-600 hover:text-purple-700 underline underline-offset-2 transition-colors"
          >
            {connection && connection.status !== "active" ? "Reconnect" : `Connect ${INTEGRATION_LABELS[platform]}`}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
            <span className="truncate">
              {connection?.account_name}
            </span>
            <Link to={integrationsHref} className="text-purple-600 hover:underline shrink-0">
              Manage
            </Link>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={platform === "beehiiv" ? "Filter posts on this page…" : "Search posts…"}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
          />

          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {visiblePosts.map((post) => {
              const selectedIndex = selected.findIndex((p) => p.id === post.id);
              const isSelected = selectedIndex !== -1;
              const disabled = !isSelected && selected.length >= maxSelect;
              // With several posts, each selected row shows its video number
              // (matching the "Video #n" tabs) and its own format toggle.
              const multi = selected.length > 1;
              const ar = aspectRatios?.[selectedIndex] ?? "landscape";
              return (
                <div
                  key={post.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    isSelected ? "bg-purple-50/60" : "hover:bg-gray-50"
                  } ${disabled ? "opacity-50" : ""}`}
                >
                  <label
                    className={`flex flex-1 min-w-0 items-center gap-3 select-none ${
                      disabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggle(post)}
                      className="w-4 h-4 shrink-0 rounded border-gray-300 accent-purple-600"
                    />
                    {multi && (
                      <span className="w-4 shrink-0 text-xs font-semibold text-purple-600 tabular-nums">
                        {isSelected ? selectedIndex + 1 : ""}
                      </span>
                    )}
                    {post.feature_image ? (
                      <img
                        src={post.feature_image}
                        alt=""
                        loading="lazy"
                        className="w-12 h-8 rounded object-cover shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900 truncate">{post.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] px-1.5 rounded-full border capitalize ${
                            STATUS_STYLE[post.status] ?? STATUS_STYLE.draft
                          }`}
                        >
                          {post.status}
                        </span>
                        {post.paid && (
                          <span className="text-[10px] px-1.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                            Paid
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 truncate">
                          {formatDate(post.published_at || post.updated_at)}
                        </span>
                      </div>
                    </div>
                  </label>
                  {multi && isSelected && onAspectRatioChange && (
                    <div className="flex shrink-0 gap-1 p-1 bg-gray-100/60 rounded-xl">
                      <button
                        type="button"
                        title="Landscape for Desktop/Youtube Videos"
                        onClick={() => onAspectRatioChange(selectedIndex, "landscape")}
                        className={`px-2.5 py-1 rounded-lg flex items-center transition-all ${
                          ar === "landscape"
                            ? "bg-white text-purple-600 shadow-sm"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Portrait for tiktok/instagram/mobile videos"
                        onClick={() => onAspectRatioChange(selectedIndex, "portrait")}
                        className={`px-2.5 py-1 rounded-lg flex items-center transition-all ${
                          ar === "portrait"
                            ? "bg-white text-purple-600 shadow-sm"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="7" y="2" width="10" height="20" rx="2" />
                          <circle cx="12" cy="18" r="1" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!loadingPosts && posts.length === 0 && !error && (
              <div className="text-xs text-gray-400 py-6 text-center">
                {debouncedSearch ? "No posts match that search." : "No posts yet."}
              </div>
            )}
            {loadingPosts && visiblePosts.length === 0 && (
              <div className="text-xs text-gray-400 py-3 text-center">Loading posts…</div>
            )}
          </div>
          {(canPrev || canNext) && (
            <nav className="flex items-center justify-center gap-2" aria-label="Post pages">
              <button
                type="button"
                onClick={() => setView((v) => Math.max(0, v - 1))}
                disabled={!canPrev}
                aria-label="Previous posts"
                title="Previous posts"
                className="inline-flex items-center justify-center min-w-[32px] px-2 py-1.5 text-purple-600 border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[64px] text-center text-[11px] text-gray-400 tabular-nums">
                {rangeStart}–{rangeEnd}
                {total != null ? ` of ${total}` : ""}
              </span>
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={!canNext || loadingPosts}
                aria-label="Next posts"
                title="Next posts"
                className="inline-flex items-center justify-center min-w-[32px] px-2 py-1.5 text-purple-600 border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </nav>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-gray-400">
            {selected.length === 0
              ? "Select a post to turn into a video."
              : selected.length >= maxSelect
                ? `${selected.length} selected, the maximum. Each post becomes its own video and uses one video credit.`
                : `${selected.length} selected. Each post becomes its own video and uses one video credit.`}
          </p>
        </>
      )}
    </div>
  );
}
