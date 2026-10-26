import { type DynamicModule, Global, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { CONFIG, type Config } from "./config";
import { MailModule } from "./mail/mail.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaService } from "./prisma.service";

@Global()
@Module({})
class CoreModule {
  static with(config: Config): DynamicModule {
    return {
      module: CoreModule,
      providers: [{ provide: CONFIG, useValue: config }, PrismaService],
      exports: [CONFIG, PrismaService],
    };
  }
}

@Module({})
export class AppModule {
  static with(config: Config): DynamicModule {
    return { module: AppModule, imports: [CoreModule.with(config), ScheduleModule.forRoot(), MailModule, AuthModule, OrdersModule, PaymentsModule] };
  }
}
