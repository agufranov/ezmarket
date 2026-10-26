// Заказ пополнения Steam: сервер (server/src/orders, server/src/payments) или мок, если API не подключен.
// POST /orders { steamLogin, amount, currency } + Idempotency-Key -> { order } | 422 { field, error } | 409
// POST /orders/:id/pay -> { order, paymentUrl } | 409 { error, status }
import { api, apiEnabled, type ApiError } from "./api";

export type TopUpError = Pick<ApiError, "status" | "error"> & { field?: "steamLogin" | "amount" | "currency" };

type Order = { id: string; status: string };

// amount - в целых единицах, как в поле суммы; на сервер уходит в минимальных (копейки, центы, тиыны)
export async function startSteamTopUp(
  data: { steamLogin: string; amount: number; currency: string },
  idempotencyKey: string,
): Promise<{ paymentUrl: string | null }> {
  if (!apiEnabled) {
    // мок (GitHub Pages): как раньше - пауза и окно оплаты-заглушка
    await new Promise((r) => setTimeout(r, 1200));
    return { paymentUrl: null };
  }
  const { order } = await api<{ order: Order }>("/orders", {
    body: { steamLogin: data.steamLogin, amount: Math.round(data.amount * 100), currency: data.currency },
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const { paymentUrl } = await api<{ paymentUrl: string }>(`/orders/${order.id}/pay`, { method: "POST" });
  return { paymentUrl };
}

// Ключ повтора на одну попытку оплаты: тот же запрос (двойной клик, повтор после ошибки сети) - тот же заказ
export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
