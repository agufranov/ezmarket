// Заказ пополнения Steam: сервер (server/src/orders, server/src/payments) или мок, если API не подключен.
// GET /orders/limits -> { minAmount, maxAmount } в минимальных единицах (ТЗ 8.3: лимиты - с бэкенда)
// POST /orders { steamLogin, amount, currency, bonuses? } + Idempotency-Key -> { order } | 422 { field, error } | 409
// POST /orders/:id/pay -> { order, paymentUrl } | 409 { error, status }
import { site } from "@/config/site";
import { api, apiEnabled, type ApiError } from "./api";
import type { TopUpAttempt } from "./topUpAttempt";

export { attemptInput, nextAttempt, type TopUpAttempt } from "./topUpAttempt";

export type TopUpError = Pick<ApiError, "status" | "error"> & { field?: "steamLogin" | "amount" | "currency" };

type Order = { id: string; status: string };

// Заказ в ответах сервера (server/src/orders/orders.service.ts: OrderDto); суммы - в минимальных единицах
export type OrderStatus = "created" | "pending" | "paid" | "processing" | "completed" | "failed" | "canceled" | "expired";
export type OrderDto = {
  id: string;
  steamLogin: string;
  amount: number;
  currency: string;
  payAmount: number;
  // списано бонусов в оплату и начислится за выполненный заказ (1 бонус = 1 ₽)
  bonusSpent: number;
  bonusAccrual: number;
  status: OrderStatus;
  paymentUrl: string | null;
  expiresAt: string;
  createdAt: string;
  history?: { from: OrderStatus | null; to: OrderStatus; reason: string | null; at: string }[];
};

// конечные статусы: по такому заказу оплачивать больше нечего
export const FINAL_STATUSES: OrderStatus[] = ["completed", "failed", "canceled", "expired"];

export const listOrders = async () => (await api<{ orders: OrderDto[] }>("/orders")).orders;
export const getOrder = async (id: string) => (await api<{ order: OrderDto }>(`/orders/${id}`)).order;
export const cancelOrder = async (id: string) => (await api<{ order: OrderDto }>(`/orders/${id}/cancel`, { method: "POST" })).order;
// ссылка на оплату заказа: создает счет для created, для pending отдает тот же
export const payOrder = async (id: string) => (await api<{ paymentUrl: string }>(`/orders/${id}/pay`, { method: "POST" })).paymentUrl;

export type Limits = { minAmount: number; maxAmount: number };

// лимиты суммы в целых единицах, как в поле суммы; без API или при ошибке - из src/config/site.ts
export async function fetchLimits(): Promise<Limits> {
  const fallback = { minAmount: site.steam.minAmount, maxAmount: site.steam.maxAmount };
  if (!apiEnabled) return fallback;
  try {
    const r = await api<Limits>("/orders/limits");
    return { minAmount: Math.ceil(r.minAmount / 100), maxAmount: Math.floor(r.maxAmount / 100) };
  } catch {
    return fallback;
  }
}

// завершен ли заказ попытки (для nextAttempt); без API заказов нет - не завершен
export async function orderFinished(id: string): Promise<boolean> {
  if (!apiEnabled) return false;
  return FINAL_STATUSES.includes((await getOrder(id)).status);
}

// amount - в целых единицах, как в поле суммы; на сервер уходит в минимальных (копейки, центы, тиыны).
// id созданного заказа записывается в попытку сразу - даже если ссылку на оплату получить не удалось
export async function startSteamTopUp(
  data: { steamLogin: string; amount: number; currency: string },
  attempt: TopUpAttempt,
): Promise<{ paymentUrl: string | null }> {
  if (!apiEnabled) {
    // мок (GitHub Pages): как раньше - пауза и окно оплаты-заглушка
    await new Promise((r) => setTimeout(r, 1200));
    return { paymentUrl: null };
  }
  const { order } = await api<{ order: Order }>("/orders", {
    body: { steamLogin: data.steamLogin, amount: Math.round(data.amount * 100), currency: data.currency },
    headers: { "Idempotency-Key": attempt.key },
  });
  attempt.orderId = order.id;
  return { paymentUrl: await payOrder(order.id) };
}
