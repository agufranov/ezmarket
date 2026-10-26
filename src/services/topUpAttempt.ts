// Попытка оплаты в плашке Steam: ключ повтора, заказ, который по нему создан, и данные формы, для которых она начата.
// Без внешних импортов - логика проверяется unit-тестом (topUpAttempt.test.mjs, npm test).

export type TopUpAttempt = { key: string; input: string; orderId?: string };

// данные формы одной строкой: попытка относится только к ним
export const attemptInput = (d: { steamLogin: string; amount: number; currency: string }) => `${d.steamLogin}\n${d.amount}\n${d.currency}`;

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

// Попытка для этих данных формы. Прежняя подходит, только если начата для тех же данных и ее заказ не завершен:
// тот же ключ - тот же заказ (двойной клик, повтор после ошибки сети). Данные другие - в том числе если форму
// поменяли, пока шел прошлый запрос (ревью F10), - или заказ завершен: новая попытка.
// Статус заказа узнать не удалось - прежняя попытка (сервер с тем же ключом вернет тот же заказ, дубля не будет).
export async function nextAttempt(
  prev: TopUpAttempt | null,
  input: string,
  isFinished: (orderId: string) => Promise<boolean>,
): Promise<TopUpAttempt> {
  if (!prev || prev.input !== input) return { key: newIdempotencyKey(), input };
  if (prev.orderId && (await isFinished(prev.orderId).catch(() => false))) return { key: newIdempotencyKey(), input };
  return prev;
}
