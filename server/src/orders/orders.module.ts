import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrderStatusService } from "./order-status.service";
import { OrderLimitsController, OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrdersWorker } from "./orders.worker";
import { SteamTopUpService } from "./steam-topup.service";

@Module({ imports: [AuthModule], controllers: [OrderLimitsController, OrdersController], providers: [OrdersService, OrderStatusService, OrdersWorker, SteamTopUpService], exports: [OrdersService, OrderStatusService] })
export class OrdersModule {}
