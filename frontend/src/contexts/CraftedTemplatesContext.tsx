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
  refresh: () => Promise<void>;
  ensureCraftedTemplateDetail: (templateId: string) => Promise<CraftedTemplateDetail | null>;
}

// v3: summary now carries preview_file source (bundled marquee preview).
const CACHE_KEY = "b2v_crafted_templates_cache_v3";
const LEGACY_CACHE_KEYS = ["b2v_crafted_templates_cache_v2", "b2v_crafted_templates_cache"];
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
  refresh: async () => {},
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
  // URLs) live ONLY in this in-memory map. They are intentionally never
  // persisted to localStorage — the list summary + bundled preview source is
  // all that gets cached on disk. Reload the tab → details are re-fetched
  // from R2 on demand.
  const [detailsById, setDetailsById] = useState<Record<string, CraftedTemplateDetail>>({});
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const detailInFlightRef = useRef<Map<string, Promise<CraftedTemplateDetail | null>>>(new Map());

  const craftedTemplates = useMemo<CraftedTemplateItem[]>(
    () => summaries.map((item) => ({ ...item, ...(detailsById[item.id] || {}) })),
    [summaries, detailsById]
  );

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSummaries([]);
      setDetailsById({});
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return inFlightRef.current;
    setLoading(true);
    const req = listCraftedTemplates()
      .then((res) => {
        const next = res.data || [];
        setSummaries(next);
        writeCache(user.id, next);
      })
      .catch(() => {
        setSummaries([]);
      })
      .finally(() => {
        setLoading(false);
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

