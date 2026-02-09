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
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<UserInfo | null>(null);

  // Keep ref in sync so beforeunload handler can read latest value
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const login = useCallback((newToken: string, newUser: UserInfo) => {
    localStorage.setItem("b2v_token", newToken);
    localStorage.setItem("b2v_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
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
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data);
      localStorage.setItem("b2v_user", JSON.stringify(res.data));
    } catch {
      // Token may be invalid
      logout();
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
        .catch(() => {
          logout();
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
