import { useEffect, useState, type ReactNode } from "react";

import { authApi, getStoredToken, setStoredToken, type AuthUser } from "../api";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load, check the saved token with the server. An expired or invalid token is cleared.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!getStoredToken()) {
        setLoading(false);
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        setStoredToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: loggedInUser } = await authApi.login(email, password);
    setStoredToken(token);
    setUser(loggedInUser);
  };

  const register = async (name: string, email: string, password: string) => {
    await authApi.register(name, email, password);
    await login(email, password);
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  const value: AuthContextValue = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
