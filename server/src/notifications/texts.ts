import type { BonusKind, Order, OrderStatus } from "@prisma/client";
import { ORDER_RULES } from "../config";

// Тексты уведомлений - кусками: жирные части отдельно, без HTML (так их рисует колокольчик, src/data/user.ts).
// Образцы из макета: «Steam пополнен на 1 000 ₽», «Начислено +31 бонус за покупку»
export type Piece = { t: string; b?: boolean };

// 1 000 ₽ - без копеек, если их нет
export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency, minimumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

const plural = (n: number, forms: [string, string, string]) => {
  const a = n % 100;
  const b = n % 10;
  return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
};
const bonuses = (n: number) => `${n.toLocaleString("ru-RU")} ${plural(n, ["бонус", "бонуса", "бонусов"])}`;

// смена статуса заказа пополнения Steam (created - только для полноты: о создании заказа уведомления нет)
export function orderText(status: OrderStatus, o: Pick<Order, "amount" | "currency">): Piece[] {
  const sum = { t: money(o.amount, o.currency), b: true };
  switch (status) {
    case "created":
      return [{ t: "Заказ на " }, sum, { t: " создан" }];
    case "pending":
      return [{ t: "Заказ на " }, sum, { t: " ждет оплаты" }];
    case "paid":
      return [{ t: "Оплата получена - пополняем Steam на " }, sum];
    case "processing":
      return [{ t: "Пополняем Steam на " }, sum];
    case "completed":
      return [{ t: "Steam пополнен на " }, sum];
    case "failed":
      return [{ t: "Не удалось пополнить Steam на " }, sum];
    case "canceled":
      return [{ t: "Заказ на " }, sum, { t: " отменен" }];
    case "expired":
      return [{ t: "Заказ на " }, sum, { t: ` не оплачен за ${ORDER_RULES.ttlMs / 60_000} минут и закрыт` }];
  }
}

// движение бонусов (1 бонус = 1 ₽)
export function bonusText(kind: BonusKind, delta: number): Piece[] {
  const n = Math.abs(delta);
  switch (kind) {
    case "signup":
      return [{ t: "Начислено " }, { t: `+${bonuses(n)}`, b: true }, { t: " за регистрацию" }];
    case "accrual":
      return [{ t: "Начислено " }, { t: `+${bonuses(n)}`, b: true }, { t: " за покупку" }];
    case "refund":
      return [{ t: "Вернули " }, { t: bonuses(n), b: true }, { t: " - заказ не выполнен" }];
    case "spend":
      return [{ t: "Списано " }, { t: bonuses(n), b: true }, { t: " в оплату заказа" }];
  }
}

export const plain = (pieces: Piece[]) => pieces.map((p) => p.t).join("");

// Письмо об итоге оплаченного заказа - те же тексты, что в колокольчике
export function orderEmail(
  o: Pick<Order, "id" | "steamLogin" | "amount" | "currency" | "bonusSpent" | "bonusAccrual">,
  status: "completed" | "failed",
) {
  const title = plain(orderText(status, o));
  const lines = [`${title} (аккаунт ${o.steamLogin}).`];
  if (status === "completed" && o.bonusAccrual > 0) lines.push(`${plain(bonusText("accrual", o.bonusAccrual))}.`);
  if (status === "failed") {
    if (o.bonusSpent > 0) lines.push(`${plain(bonusText("refund", o.bonusSpent))}.`);
    lines.push("Напишите в поддержку - разберемся с оплатой.");
  }
  lines.push("", `Заказ ${o.id}`);
  return { subject: `${title} - EzMarket`, text: lines.join("\n") };
}
