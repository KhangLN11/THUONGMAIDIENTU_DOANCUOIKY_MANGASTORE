import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as service from "../services/authService";

type AuthState = {
  user: service.AuthUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<service.AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUser(await service.getSession()); setError(null); }
    catch (error) { setUser(null); setError(error instanceof service.AuthError ? error.code : "NETWORK_ERROR"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function signIn(email: string, password: string) {
    const result = await service.login(email, password);
    if (!result) throw new service.AuthError("INVALID_RESPONSE");
    setUser(result); setError(null);
  }
  async function signOut() { await service.logout(); setUser(null); setError(null); }
  return <Context.Provider value={{ user, loading, error, refresh, signIn, signOut }}>{children}</Context.Provider>;
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
/** UI guard only; every protected PHP endpoint must also call Auth::requireUser/Admin. */
export function AuthGuard({ children, role, fallback = null }: { children: ReactNode; role?: "admin"; fallback?: ReactNode }) {
  const { user, loading, error } = useAuth();
  return !loading && !error && user && (!role || user.role === role) ? children : fallback;
}
