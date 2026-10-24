"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mockUser, type User } from "@/data/user";
import { apiEnabled } from "@/services/api";
import { fetchMe, logoutRequest } from "@/services/auth";

// Авторизация (ТЗ 12.4). С API - сессия на сервере (GET /me, POST /auth/logout).
// Без API (GitHub Pages) - моки: пользователь в localStorage.ez_mock_auth, для демо ?auth=1 / ?auth=0.
const KEY = "ez_mock_auth";

type Ctx = {
  // undefined - еще не прочитали (до гидрации), null - гость
  user: User | null | undefined;
  // вход: пользователь из ответа сервера; без аргумента - мок-пользователь
  login: (user?: User) => void;
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

  useEffect(() => {
    if (!apiEnabled) return setUser(read());
    // сервер недоступен - показываем гостя, а не вечный скелет шапки
    fetchMe().then(setUser, () => setUser(null));
  }, []);

  const login = useCallback((u?: User) => {
    if (apiEnabled && u) return setUser(u);
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
    if (apiEnabled) logoutRequest().catch(() => {});
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
