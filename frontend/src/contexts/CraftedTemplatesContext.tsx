import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { listCraftedTemplates, type CraftedTemplateItem } from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface CraftedTemplatesContextValue {
  craftedTemplates: CraftedTemplateItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const CACHE_KEY = "b2v_crafted_templates_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CraftedTemplatesCachePayload {
  userId: number;
  fetchedAt: number;
  templates: CraftedTemplateItem[];
}

const CraftedTemplatesContext = createContext<CraftedTemplatesContextValue>({
  craftedTemplates: [],
  loading: false,
  refresh: async () => {},
});

function readCache(userId: number): CraftedTemplatesCachePayload | null {
  try {
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

function writeCache(userId: number, templates: CraftedTemplateItem[]) {
  try {
    const payload: CraftedTemplatesCachePayload = {
      userId,
      fetchedAt: Date.now(),
      templates,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures (private mode / quota).
  }
}

export function CraftedTemplatesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [craftedTemplates, setCraftedTemplates] = useState<CraftedTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCraftedTemplates([]);
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return inFlightRef.current;
    setLoading(true);
    const req = listCraftedTemplates()
      .then((res) => {
        const next = res.data || [];
        setCraftedTemplates(next);
        writeCache(user.id, next);
      })
      .catch(() => {
        setCraftedTemplates([]);
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = null;
      });
    inFlightRef.current = req;
    return req;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setCraftedTemplates([]);
      setLoading(false);
      return;
    }
    const cached = readCache(user.id);
    if (cached) {
      setCraftedTemplates(cached.templates);
      setLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, user?.id, refresh]);

  return (
    <CraftedTemplatesContext.Provider value={{ craftedTemplates, loading, refresh }}>
      {children}
    </CraftedTemplatesContext.Provider>
  );
}

export function useCraftedTemplates() {
  return useContext(CraftedTemplatesContext);
}

