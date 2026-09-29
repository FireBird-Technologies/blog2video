import {
  INTEGRATION_PLATFORMS,
  getContentSourceConnections,
  getContentSourcesConfig,
  isSourceConnectionUsable,
  listSourcePosts,
  type ContentSourceConnection,
  type ContentSourcePlatform,
  type IntegrationPlatform,
  type SourcePostsPage,
} from "../api/sources";

export interface SourceConnectionsState {
  enabled: boolean;
  connections: ContentSourceConnection[];
}

/** Picker position restored when step 1 remounts. */
export interface SourcePickerUi {
  search: string;
  view: number;
}

/**
 * Connections and post pages for the create form's Connect tab, kept for as
 * long as the form is open. The form creates one per mount, so closing it
 * drops the cache; going step 1 → 2 → 1 reuses it with no refetch.
 *
 * Promises are memoized (not just results) so the on-open prefetch and the
 * picker share one request. Failed requests are forgotten so a retry refetches.
 */
export function createSourcePostsCache() {
  let connectionsPromise: Promise<SourceConnectionsState> | null = null;
  let connections: SourceConnectionsState | null = null;
  const pagePromises = new Map<string, Promise<SourcePostsPage>>();
  const pages = new Map<string, SourcePostsPage>();
  const ui = new Map<IntegrationPlatform, SourcePickerUi>();

  const pageKey = (platform: ContentSourcePlatform, search: string, page: number) =>
    `${platform}|${search}|${page}`;

  const loadConnections = () => {
    if (!connectionsPromise) {
      connectionsPromise = Promise.all([getContentSourcesConfig(), getContentSourceConnections()])
        .then(([cfg, conns]) => {
          connections = { enabled: cfg.data.enabled, connections: conns.data.connections };
          return connections;
        })
        .catch((err) => {
          connectionsPromise = null;
          throw err;
        });
    }
    return connectionsPromise;
  };

  const loadPage = (platform: ContentSourcePlatform, search: string, page: number) => {
    const key = pageKey(platform, search, page);
    let p = pagePromises.get(key);
    if (!p) {
      p = listSourcePosts(platform, { page, search })
        .then(({ data }) => {
          pages.set(key, data);
          return data;
        })
        .catch((err) => {
          pagePromises.delete(key);
          throw err;
        });
      pagePromises.set(key, p);
    }
    return p;
  };

  return {
    /** Set once the picker has auto-switched to the connected source, so it doesn't again on remount. */
    landed: false,
    loadConnections,
    loadPage,

    /** Forget connections and this platform's posts (e.g. after a revoked key). */
    invalidate(platform?: ContentSourcePlatform) {
      connectionsPromise = null;
      connections = null;
      if (!platform) return;
      for (const key of [...pagePromises.keys()]) {
        if (key.startsWith(`${platform}|`)) {
          pagePromises.delete(key);
          pages.delete(key);
        }
      }
    },

    peekConnections: () => connections,

    /** Consecutive already-loaded pages 1..n for this search, or null if page 1 isn't loaded. */
    peekPages(platform: ContentSourcePlatform, search: string): SourcePostsPage[] | null {
      const out: SourcePostsPage[] = [];
      for (let n = 1; ; n++) {
        const pg = pages.get(pageKey(platform, search, n));
        if (!pg) break;
        out.push(pg);
        if (!pg.has_more) break;
      }
      return out.length ? out : null;
    },

    getUi: (platform: IntegrationPlatform): SourcePickerUi => ui.get(platform) ?? { search: "", view: 0 },
    setUi: (platform: IntegrationPlatform, next: SourcePickerUi) => ui.set(platform, next),

    /** Start loading as soon as the form opens: connections, then page 1 of each connected source. */
    prefetch() {
      loadConnections()
        .then(({ enabled, connections: conns }) => {
          if (!enabled) return;
          for (const p of INTEGRATION_PLATFORMS) {
            if (isSourceConnectionUsable(conns.find((c) => c.platform === p))) {
              loadPage(p, "", 1).catch(() => {});
            }
          }
        })
        .catch(() => {});
    },
  };
}

export type SourcePostsCache = ReturnType<typeof createSourcePostsCache>;
