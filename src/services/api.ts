// Клиент API. NEXT_PUBLIC_API_URL задан (Docker: "/api") - запросы идут на сервер,
// не задан (GitHub Pages) - сервисы работают на моках.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const apiEnabled = BASE !== "";

// Ошибка API в формате сервера: { error, field?, retryIn?, attemptsLeft? } + HTTP-статус
export type ApiError = { status: number; error: string; field?: string; retryIn?: number; attemptsLeft?: number };

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      // сессия - в httpOnly cookie того же адреса
      credentials: "include",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw { status: 0, error: "Нет связи с сервером. Проверьте интернет" } satisfies ApiError;
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, error: data.error ?? "Что-то пошло не так. Попробуйте еще раз", ...data } satisfies ApiError;
  return data as T;
}
