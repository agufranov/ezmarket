import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { CryptoPayModule } from "./cryptopay.module";
import { FakeProviderController } from "./fake-provider.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({ imports: [AuthModule, OrdersModule, CryptoPayModule], controllers: [PaymentsController, FakeProviderController], providers: [PaymentsService] })
export class PaymentsModule {}
