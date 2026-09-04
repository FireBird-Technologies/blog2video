import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { UserInfo, getMe, logoutCleanup } from "../api/client";

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const isServer = typeof window === "undefined";
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isServer);
  const userRef = useRef<UserInfo | null>(null);

  // Keep ref in sync so beforeunload handler can read latest value
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const login = useCallback((newToken: string, newUser: UserInfo) => {
    localStorage.setItem("b2v_token", newToken);
    localStorage.setItem("b2v_user", JSON.stringify(newUser));
    // Flag a fresh sign-in so login-only surfaces (e.g. the designer-template
    // marketing popup) can fire on real logins but NOT on page reloads, which
    // restore the session via setUser without calling login().
    try {
      sessionStorage.setItem("b2v_just_logged_in", "1");
    } catch {
      /* ignore */
    }
    setToken(newToken);
    setUser(newUser);
    // Migrate any active anonymous support conversation to this user.
    void (async () => {
      try {
        const { getStoredConversationId, claimConversation } = await import(
          "../api/support"
        );
        const cid = getStoredConversationId();
        if (cid != null) {
          await claimConversation(cid);
        }
      } catch {
        /* best-effort; ignore */
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    // Call backend cleanup for free users before clearing local state
    try {
      await logoutCleanup();
    } catch {
      // ignore — user may already be unauthenticated
    }
    localStorage.removeItem("b2v_token");
    localStorage.removeItem("b2v_user");
    // Reset out-of-videos offer state so next login starts a fresh 5-min window.
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("b2v_out_of_videos_offer_")) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data);
      localStorage.setItem("b2v_user", JSON.stringify(res.data));
    } catch (err: unknown) {
      // Same rule as the mount effect below: only a genuine 401 is a dead token.
      // A network blip or a slow response is not, and logging out on one is
      // especially bad here — refreshUser runs right after an avatar batch is
      // authorized, which is exactly when the connection pool is most contended.
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) logout();
    }
  }, [logout]);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("b2v_token");
    const savedUser = localStorage.getItem("b2v_user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Bad data
      }
      // Verify token is still valid (8s timeout - don't block UI when backend is cold)
      Promise.race([
        getMe(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        ),
      ])
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("b2v_user", JSON.stringify(res.data));
        })
        .catch((err: unknown) => {
          // ONLY a real 401 means the token is dead. This used to log out on ANY
          // rejection, including the 8s timeout above — which exists to stop a
          // cold backend BLOCKING the UI, not to sign anyone out.
          //
          // That distinction is not academic: a reload during an avatar batch
          // fires ~15 concurrent requests while renders hold DB connections
          // against a pool of 5 + 10 overflow, /api/auth/me misses 8s, and the
          // user was silently logged out mid-batch.
          //
          // On a timeout the cached session (already read from localStorage and
          // applied above) stays put and the next call re-verifies. A genuine 401
          // is still handled either way — api's response interceptor clears
          // storage and redirects — so this only has to catch the case the
          // interceptor cannot see.
          const status = (err as { response?: { status?: number } })?.response
            ?.status;
          if (status === 401) logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [logout]);

  // Free-tier data is cleaned up after 24 hours by the backend periodic task.
  // No need for a beforeunload warning — users can close the tab safely.

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
