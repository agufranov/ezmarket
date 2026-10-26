import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Writable } from "node:stream";
import { createApp } from "../src/app.factory";
import { loadConfig, type Config } from "../src/config";
import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma.service";

export type TestApp = { app: NestFastifyApplication; prisma: PrismaService; logs: string[]; config: Config; url: string };

const DEFAULT_TEST_DB = "postgresql://ezmarket:ezmarket@localhost:5433/ezmarket_test";

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: process.env.TEST_DATABASE_URL || DEFAULT_TEST_DB,
    AUTH_CODE_SECRET: "test-secret-test-secret-test-secret-123",
    COOKIE_SECURE: "false",
    WORKERS: "false",
    // SMTP в тестах - закрытый порт: письма остаются в очереди, их текст читается из базы
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1",
    ...overrides,
  });
}

// Приложение с логами в массив - чтобы проверить, что код входа в них не попадает
export async function startApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const logs: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      logs.push(chunk.toString());
      cb();
    },
  });
  const config = testConfig(overrides);
  const app = await createApp(config, stream);
  // один слушающий сервер на все запросы теста
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  return { app, prisma: app.get(PrismaService), logs, config, url: url.replace("[::1]", "127.0.0.1") };
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`TRUNCATE "order_status_history", "orders", "sessions", "auth_codes", "email_outbox", "users" CASCADE`);
}

// Код «из письма»: последнее письмо на адрес в очереди
export async function codeFromMail(prisma: PrismaService, email: string) {
  const mail = await prisma.emailOutbox.findFirst({ where: { to: email }, orderBy: { createdAt: "desc" } });
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`нет письма с кодом для ${email}`);
  return code;
}

// Сдвиг кодов email в прошлое - вместо ожидания минут и часов
export async function ageCodes(prisma: PrismaService, email: string, ms: number) {
  const secs = ms / 1000;
  await prisma.$executeRaw`
    UPDATE "auth_codes"
    SET "created_at" = "created_at" - make_interval(secs => ${secs}::double precision),
        "expires_at" = "expires_at" - make_interval(secs => ${secs}::double precision)
    WHERE "email" = ${email}`;
}

export const mail = (app: NestFastifyApplication) => app.get(MailService);
