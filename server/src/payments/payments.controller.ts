import { Controller, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards, type RawBodyRequest } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { ApiError } from "../common/http";
import { CurrentUser, SessionGuard } from "../auth/session.guard";
import { toOrderDto } from "../orders/orders.service";
import { PaymentsService } from "./payments.service";

const notFound = () => new ApiError(HttpStatus.NOT_FOUND, "Заказ не найден");

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // POST /api/orders/:id/pay -> 200 { order, paymentUrl } (заказ в pending) | 409 { error, status } | 404
  @Post("orders/:id/pay")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async pay(@CurrentUser() user: User, @Param("id", new ParseUUIDPipe({ exceptionFactory: notFound })) id: string) {
    const { order, paymentUrl } = await this.payments.start(user.id, id);
    return { order: toOrderDto(order), paymentUrl };
  }

  // POST /api/payments/webhook (от платежной системы) + X-Signature -> 200 { ok, result } | 401 подпись | 400 формат
  @Post("payments/webhook")
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<FastifyRequest>, @Headers("x-signature") signature: string | undefined) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
