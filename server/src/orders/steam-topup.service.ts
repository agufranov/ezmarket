import { Injectable } from "@nestjs/common";
import type { Order } from "@prisma/client";

export class TopUpError extends Error {}

// Пополнение Steam у поставщика. Пока заглушка: отвечает успехом через 200 мс.
// Для проверки ошибки на демо: логин, начинающийся с fail_, - поставщик отказывает.
// id заказа уходит поставщику ключом повтора: повторный вызов не пополнит дважды.
@Injectable()
export class SteamTopUpService {
  async topUp(order: Pick<Order, "id" | "steamLogin" | "amount" | "currency">): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    if (order.steamLogin.toLowerCase().startsWith("fail_")) throw new TopUpError("Steam не нашел аккаунт с таким логином");
  }
}
