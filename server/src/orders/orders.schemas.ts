import { z } from "zod";
import { ORDER_RULES } from "../config";

const fmt = (minor: number) => (minor / 100).toLocaleString("ru-RU");

// минимум суммы - из настройки ORDER_MIN_AMOUNT, поэтому схема собирается при старте
export const createOrderSchema = (minAmount: number) =>
  z.object({
    // логин Steam: 3-32 символа, латиница, цифры и _
    steamLogin: z
      .string({ required_error: "Введите логин Steam" })
      .trim()
      .min(1, "Введите логин Steam")
      .regex(/^[A-Za-z0-9_]{3,32}$/, "Проверьте логин Steam"),
    amount: z
      .number({ required_error: "Введите сумму", invalid_type_error: "Введите сумму" })
      .int("Сумма - целым числом в копейках")
      .min(minAmount, `Минимум ${fmt(minAmount)}`)
      .max(ORDER_RULES.maxAmount, `Максимум ${fmt(ORDER_RULES.maxAmount)}`),
    currency: z.enum(ORDER_RULES.currencies, { errorMap: () => ({ message: "Выберите валюту" }) }),
  });

// ключ повтора - заголовок Idempotency-Key, его генерирует клиент на одно нажатие «Оплатить»
export const idempotencyKeySchema = z
  .string({ required_error: "Нужен заголовок Idempotency-Key" })
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "Idempotency-Key - от 8 до 64 символов: латиница, цифры, - и _");

export type CreateOrderDto = z.infer<ReturnType<typeof createOrderSchema>>;
