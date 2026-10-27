// Бонусы пользователя (server/src/bonuses): 1 бонус = 1 ₽.
// GET /bonuses -> { balance, history } - свои, новые сверху (до 50)
import { api } from "./api";

// signup - за регистрацию, spend - оплата заказа, refund - возврат по невыполненному заказу, accrual - кэшбэк
export type BonusKind = "signup" | "spend" | "refund" | "accrual";
export type BonusEntry = { id: string; kind: BonusKind; delta: number; balanceAfter: number; orderId: string | null; at: string };
export type Bonuses = { balance: number; history: BonusEntry[] };

export const getBonuses = () => api<Bonuses>("/bonuses");
