import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrderStatusService } from "./order-status.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({ imports: [AuthModule], controllers: [OrdersController], providers: [OrdersService, OrderStatusService], exports: [OrdersService, OrderStatusService] })
export class OrdersModule {}
