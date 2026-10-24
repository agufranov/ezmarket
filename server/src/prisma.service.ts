import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CONFIG, type Config } from "./config";

// Адрес базы - из проверенного конфига, а не напрямую из окружения (тесты подменяют конфиг)
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(CONFIG) config: Config) {
    super({ datasources: { db: { url: config.DATABASE_URL } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
