"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiRequestError } from "./api";

export type SessionUser = {
  id: number; name: string; email: string | null; phone: string | null; role: "customer" | "driver" | "admin"; locale: string;
  roles?: string[]; permissions?: string[]; two_factor_enabled?: boolean; driver_id?: number | null; driver_status?: string | null;
};

type Ctx = { user: SessionUser | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; can: (perm: string) => boolean };
const AuthContext = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, logout: async () => {}, can: () => false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const me = await api<SessionUser>("/auth/me");
      setUser(me);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* token may already be gone */ }
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
  }, []);
  const can = useCallback((perm: string) => Boolean(user?.permissions?.includes(perm)), [user]);
  return <AuthContext.Provider value={{ user, loading, refresh, logout, can }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Persist a freshly issued token in the httpOnly session cookie. */
export async function storeSession(token: string, expiresAt?: string | null) {
  const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, expires_at: expiresAt }) });
  if (!res.ok) throw new Error("Gagal menyimpan sesi");
}
