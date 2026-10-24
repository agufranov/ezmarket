import { z } from "zod";

const email = z
  .string({ required_error: "Введите email" })
  .trim()
  .toLowerCase()
  .min(1, "Введите email")
  .max(254, "Проверьте email")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Проверьте email");

export const requestCodeSchema = z.object({
  email,
  mode: z.enum(["login", "register"]).default("login"),
  promo: z
    .string()
    .trim()
    .toUpperCase()
    .max(32)
    .optional()
    .transform((v) => v || undefined),
});

export const verifySchema = z.object({
  email,
  code: z.string({ required_error: "Введите код" }).trim().regex(/^\d{6}$/, "Код - 6 цифр"),
});

export type RequestCodeDto = z.infer<typeof requestCodeSchema>;
export type VerifyDto = z.infer<typeof verifySchema>;
