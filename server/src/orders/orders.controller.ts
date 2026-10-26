import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { ApiError, ZodPipe } from "../common/http";
import { CurrentUser, SessionGuard } from "../auth/session.guard";
import { createOrderSchema, idempotencyKeySchema, type CreateOrderDto } from "./orders.schemas";
import { OrdersService, toOrderDto } from "./orders.service";

const notFound = () => new ApiError(HttpStatus.NOT_FOUND, "Заказ не найден");

@Controller("orders")
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // POST /api/orders { steamLogin, amount, currency } + Idempotency-Key
  //   -> 201 { order } новый | 200 { order } повтор того же запроса | 409 ключ занят другим заказом | 422 { field, error }
  @Post()
  async create(
    @CurrentUser() user: User,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Body(new ZodPipe(createOrderSchema)) body: CreateOrderDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const key = new ZodPipe(idempotencyKeySchema).transform(rawKey) as string;
    const { order, created } = await this.orders.create(user.id, key, body);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { order: toOrderDto(order) };
  }

  // GET /api/orders -> 200 { orders } свои, новые сверху
  @Get()
  async list(@CurrentUser() user: User) {
    return { orders: (await this.orders.list(user.id)).map((o) => toOrderDto(o)) };
  }

  // POST /api/orders/:id/cancel -> 200 { order } | 409 { error, status } уже оплачен/истек | 404
  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(@CurrentUser() user: User, @Param("id", new ParseUUIDPipe({ exceptionFactory: notFound })) id: string) {
    return { order: toOrderDto(await this.orders.cancel(user.id, id)) };
  }

  // GET /api/orders/:id -> 200 { order } с историей статусов | 404 (и для чужого)
  @Get(":id")
  async get(@CurrentUser() user: User, @Param("id", new ParseUUIDPipe({ exceptionFactory: notFound })) id: string) {
    return { order: toOrderDto(await this.orders.get(user.id, id)) };
  }
}
