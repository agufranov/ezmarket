// Вход по коду из письма: сервер (server/src/auth) или моки, если API не подключен.
// POST /auth/code { email, mode, promo? } -> { resendIn, demoCode? } | 422 { field, error } | 429 { error, retryIn }
// POST /auth/verify { email, code } -> { user } + cookie сессии | 422 { field: "code", error, attemptsLeft? }
// GET /me -> { user } | 401;  POST /auth/logout -> 204
import type { User } from "@/data/user";
import { api, apiEnabled, type ApiError } from "./api";
import * as mock from "./auth.mock";

export type AuthError = Pick<ApiError, "error" | "retryIn" | "attemptsLeft"> & { field?: "email" | "promo" | "code" };
export type Mode = "login" | "register";

// demoCode - только на демо-стенде (AUTH_DEMO_CODE): код подставляется в поле без похода в почту
export type CodeSent = { resendIn: number; demoCode?: string };

export function requestCode(email: string, mode: Mode, promo?: string): Promise<CodeSent> {
  if (!apiEnabled) return mock.requestCode(email, promo);
  return api("/auth/code", { body: { email, mode, promo } });
}

export async function verifyCode(email: string, code: string): Promise<User> {
  const { user } = await api<{ user: User }>("/auth/verify", { body: { email, code } });
  return user;
}

// Текущий пользователь по cookie сессии; null - гость
export async function fetchMe(): Promise<User | null> {
  try {
    return (await api<{ user: User }>("/me")).user;
  } catch (e) {
    if ((e as ApiError).status === 401) return null;
    throw e;
  }
}

export const logoutRequest = () => api<void>("/auth/logout", { method: "POST" });

export const oauthLogin = mock.oauthLogin;
