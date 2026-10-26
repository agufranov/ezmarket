import fastifyCookie from "@fastify/cookie";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Writable } from "node:stream";
import { AppModule } from "./app.module";
import type { Config } from "./config";

// Сборка приложения - общая для main.ts и тестов (тесты подменяют поток логов)
export async function createApp(config: Config, logStream?: Writable): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    // в логе запроса - метод, адрес и статус; тело и cookie не пишутся (в них код и токен сессии)
    logger: config.NODE_ENV === "test" && !logStream ? false : { level: "info", stream: logStream, redact: ["req.headers.cookie", "res.headers['set-cookie']"] },
    trustProxy: true,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.with(config), adapter, {
    logger: config.NODE_ENV === "test" ? ["error", "warn"] : undefined,
    // подпись уведомления об оплате считается по телу байт в байт - нужен исходный буфер (req.rawBody)
    rawBody: true,
  });
  await app.register(fastifyCookie);
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  return app;
}
