"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mockUser, type User } from "@/data/user";

// Авторизация на моках (ТЗ 12.4): пользователь в localStorage.ez_mock_auth.
// Для демо - ?auth=1 / ?auth=0 в адресе. API позже: GET /me, POST /auth/logout.
const KEY = "ez_mock_auth";

type Ctx = {
  // undefined - еще не прочитали (до гидрации), null - гость
  user: User | null | undefined;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function read(): User | null {
  try {
    const flag = new URLSearchParams(window.location.search).get("auth");
    if (flag === "1") localStorage.setItem(KEY, JSON.stringify(mockUser));
    if (flag === "0") localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => setUser(read()), []);

  const login = useCallback(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(mockUser));
    } catch {}
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem("ez_auth_email");
    } catch {}
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
