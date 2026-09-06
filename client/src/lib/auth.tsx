import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type AppConfig, type User } from './api';

type AuthState = {
  user: User | null;
  config: AppConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [me, cfg] = await Promise.all([api.me(), api.config()]);
    setUser(me.user);
    setConfig(cfg);
  }, []);

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      config,
      loading,
      refresh,
      async login(email, password) {
        const res = await api.login({ email, password });
        setUser(res.user);
      },
      async register(email, password, displayName) {
        const res = await api.register({ email, password, displayName });
        setUser(res.user);
      },
      async logout() {
        await api.logout();
        setUser(null);
      },
    }),
    [user, config, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
