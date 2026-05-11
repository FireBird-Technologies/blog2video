import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getCraftedTemplateDetail,
  listCraftedTemplates,
  type CraftedTemplateDetail,
  type CraftedTemplateItem,
  type CraftedTemplateSummary,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface CraftedTemplatesContextValue {
  craftedTemplates: CraftedTemplateItem[];
  loading: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  ensureCraftedTemplateDetail: (templateId: string) => Promise<CraftedTemplateDetail | null>;
}

// v4: summaries cached without preview/layout source (those stay in memory only).
const CACHE_KEY = "b2v_crafted_templates_cache_v4";
const LEGACY_CACHE_KEYS = [
  "b2v_crafted_templates_cache_v3",
  "b2v_crafted_templates_cache_v2",
  "b2v_crafted_templates_cache",
];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CraftedTemplatesCachePayload {
  userId: number;
  fetchedAt: number;
  templates: CraftedTemplateSummary[];
}

/**
 * Fields that belong to the *full* template package (the layout bundle
 * fetched only when the user opens the video preview) and must never be
 * written to localStorage. Persisting these would defeat the purpose of
 * the lazy-fetch split and balloon the cache toward the browser quota.
 *
 * The list endpoint already omits these, but stripping them here is a
 * belt-and-suspenders guard so accidental shape drift can't leak the
 * bundle to disk.
 */
const BUNDLE_FIELDS_TO_STRIP = [
  "intro_code",
  "outro_code",
  "content_codes",
  "content_archetype_ids",
  "frontend_files",
  "frontend_entry_rel",
  "frontend_layout_index_rel",
  "frontend_mount_id",
  "public_asset_urls",
  /** Marquee preview TS — fetch from API / keep in RAM; never persist (privacy + quota). */
  "preview_file",
  "preview_file_rel",
  /** Layout field defs source — same as preview: entitlement-sensitive, refetch after cache hit. */
  "layout_fields",
  "layout_fields_rel",
] as const;

function sanitizeForCache(template: CraftedTemplateSummary): CraftedTemplateSummary {
  const safe = { ...template } as Record<string, unknown>;
  for (const key of BUNDLE_FIELDS_TO_STRIP) {
    delete safe[key];
  }
  return safe as unknown as CraftedTemplateSummary;
}

const CraftedTemplatesContext = createContext<CraftedTemplatesContextValue>({
  craftedTemplates: [],
  loading: false,
  refresh: async () => undefined,
  ensureCraftedTemplateDetail: async () => null,
});

function readCache(userId: number): CraftedTemplatesCachePayload | null {
  try {
    // Drop any older cache shapes once per session so users don't get stuck
    // with summaries missing preview_file after a frontend deploy.
    for (const legacy of LEGACY_CACHE_KEYS) {
      try { localStorage.removeItem(legacy); } catch { /* quota/private mode */ }
    }
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CraftedTemplatesCachePayload;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.templates)) return null;
    if (Date.now() - Number(parsed.fetchedAt || 0) > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(userId: number, templates: CraftedTemplateSummary[]) {
  try {
    const payload: CraftedTemplatesCachePayload = {
      userId,
      fetchedAt: Date.now(),
      templates: templates.map(sanitizeForCache),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures (private mode / quota).
  }
}

export function CraftedTemplatesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [summaries, setSummaries] = useState<CraftedTemplateSummary[]>([]);
  // Full template bundles (layout files, intro/outro/content code, public asset
  // URLs) live ONLY in this in-memory map. Preview / layout_fields sources are
  // also memory-only: localStorage holds metadata (names, theme, schema refs)
  // so switching accounts or devices never leaves another user's preview code
  // on disk. Reload → silent revalidate or explicit refresh repopulates.
  const [detailsById, setDetailsById] = useState<Record<string, CraftedTemplateDetail>>({});
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const detailInFlightRef = useRef<Map<string, Promise<CraftedTemplateDetail | null>>>(new Map());

  const craftedTemplates = useMemo<CraftedTemplateItem[]>(
    () => summaries.map((item) => ({ ...item, ...(detailsById[item.id] || {}) })),
    [summaries, detailsById]
  );

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id) {
      setSummaries([]);
      setDetailsById({});
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return inFlightRef.current;
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    const req = listCraftedTemplates()
      .then((res) => {
        const next = res.data || [];
        setSummaries(next);
        // Full crafted bundles are memory-only. When the list is refreshed,
        // drop any previously compiled/fetched detail so browser previews pick
        // up freshly uploaded frontend files from R2 instead of stale chrome.
        setDetailsById({});
        writeCache(user.id, next);
      })
      .catch(() => {
        if (!silent) setSummaries([]);
      })
      .finally(() => {
        if (!silent) setLoading(false);
        inFlightRef.current = null;
      });
    inFlightRef.current = req;
    return req;
  }, [user?.id]);

  const ensureCraftedTemplateDetail = useCallback(
    async (templateId: string): Promise<CraftedTemplateDetail | null> => {
      if (!user?.id || !templateId || !templateId.startsWith("crafted_")) return null;
      const existing = detailsById[templateId];
      if (existing) return existing;
      const inFlight = detailInFlightRef.current.get(templateId);
      if (inFlight) return inFlight;
      const req = getCraftedTemplateDetail(templateId)
        .then((res) => {
          const detail = res.data;
          if (detail?.id) {
            setDetailsById((prev) => ({ ...prev, [detail.id]: detail }));
          }
          return detail ?? null;
        })
        .catch(() => null)
        .finally(() => {
          detailInFlightRef.current.delete(templateId);
        });
      detailInFlightRef.current.set(templateId, req);
      return req;
    },
    [detailsById, user?.id]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setSummaries([]);
      setDetailsById({});
      setLoading(false);
      return;
    }
    const cached = readCache(user.id);
    if (cached) {
      setSummaries(cached.templates);
      setLoading(false);
      void refresh({ silent: true });
      return;
    }
    void refresh();
  }, [authLoading, user?.id, refresh]);

  return (
    <CraftedTemplatesContext.Provider value={{ craftedTemplates, loading, refresh, ensureCraftedTemplateDetail }}>
      {children}
    </CraftedTemplatesContext.Provider>
  );
}

export function useCraftedTemplates() {
  return useContext(CraftedTemplatesContext);
}

