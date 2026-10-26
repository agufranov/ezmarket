import { z } from "zod";

// Переменные окружения. У секретов нет значений по умолчанию: без них сервер не стартует.
const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  // секрет для HMAC кодов входа: в базе только хеш, без секрета код не подобрать по дампу
  AUTH_CODE_SECRET: z.string().min(32, "AUTH_CODE_SECRET - не короче 32 символов"),
  // false - для http://localhost без HTTPS; в проде всегда true
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("EzMarket <no-reply@ezmarket.local>"),
  // повторный код - не раньше чем через N секунд и не больше M кодов в час на email (для локальных проверок - меньше/больше)
  AUTH_RESEND_SECONDS: z.coerce.number().int().min(0).default(60),
  AUTH_CODES_PER_HOUR: z.coerce.number().int().min(1).default(5),
  // демо-стенд без почты: код возвращается в ответе на запрос кода и фронт подставляет его сам. В проде - false
  AUTH_DEMO_CODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // секрет HMAC, которым платежная система подписывает уведомления об оплате (заголовок X-Signature)
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, "PAYMENT_WEBHOOK_SECRET - не короче 32 символов"),
  // платежная система: fake - встроенная тестовая (страница /api/payments/fake/:id), cryptopay - Crypto Pay (@CryptoBot)
  PAYMENT_PROVIDER: z.enum(["fake", "cryptopay"]).default("fake"),
  // Crypto Pay: токен приложения (Crypto Pay -> My Apps в боте), сеть testnet (@CryptoTestnetBot) или mainnet
  CRYPTOPAY_TOKEN: z.string().optional(),
  CRYPTOPAY_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  // адрес API вместо стандартного (для тестов - подставной сервер)
  CRYPTOPAY_API_URL: z.string().url().optional(),
  // адрес сайта: кнопка «Вернуться в магазин» после оплаты в боте
  SITE_URL: z.string().url().optional(),
  // минимальная сумма заказа в минимальных единицах (по умолчанию 10000 = 100 ₽/$/₸); меньше - только для проверок оплаты
  ORDER_MIN_AMOUNT: z.coerce.number().int().min(1).default(10_000),
  // фоновые задачи (отправка писем) - выключаются в тестах, там их зовут вручную
  WORKERS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

const schema = base.superRefine((c, ctx) => {
  if (c.PAYMENT_PROVIDER === "cryptopay" && !c.CRYPTOPAY_TOKEN) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CRYPTOPAY_TOKEN"], message: "нужен для PAYMENT_PROVIDER=cryptopay" });
  }
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = schema.safeParse(env);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Неверные переменные окружения:\n${lines}`);
  }
  return r.data;
}

export const CONFIG = Symbol("CONFIG");

// Правила заказа пополнения Steam. Суммы - в минимальных единицах валюты (100 = 1 ₽ / $1 / 1 ₸).
// Минимум меняется настройкой ORDER_MIN_AMOUNT, фронт берет лимиты с сервера (GET /api/orders/limits)
export const ORDER_RULES = {
  currencies: ["RUB", "USD", "KZT"] as const,
  maxAmount: 50_000_00,
  // неоплаченный заказ истекает через 30 минут
  ttlMs: 30 * 60 * 1000,
} as const;

// Правила входа по коду (критерии из плана недели)
export const AUTH_RULES = {
  codeTtlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  cookieName: "ez_session",
} as const;
