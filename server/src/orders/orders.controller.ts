import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Res, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { CONFIG, ORDER_RULES, type Config } from "../config";
import { ApiError, ZodPipe } from "../common/http";
import { CurrentUser, SessionGuard } from "../auth/session.guard";
import { createOrderSchema, idempotencyKeySchema, type CreateOrderDto } from "./orders.schemas";
import { OrdersService, toOrderDto } from "./orders.service";

const notFound = () => new ApiError(HttpStatus.NOT_FOUND, "Заказ не найден");

// GET /api/orders/limits -> { minAmount, maxAmount, currencies, bonus } - лимиты для плашки Steam, без входа
@Controller("orders/limits")
export class OrderLimitsController {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  @Get()
  limits() {
    return {
      minAmount: this.config.ORDER_MIN_AMOUNT,
      maxAmount: ORDER_RULES.maxAmount,
      currencies: ORDER_RULES.currencies,
      // бонусы: валюта, доля суммы, которую можно оплатить бонусами, кэшбэк и бонус за регистрацию
      bonus: {
        currency: ORDER_RULES.bonusCurrency,
        maxPercent: ORDER_RULES.bonusMaxPercent,
        cashbackPercent: this.config.BONUS_CASHBACK_PERCENT,
        signup: this.config.BONUS_SIGNUP,
      },
    };
  }
}

@Controller("orders")
@UseGuards(SessionGuard)
export class OrdersController {
  private readonly bodyPipe: ZodPipe;

  constructor(
    private readonly orders: OrdersService,
    @Inject(CONFIG) config: Config,
  ) {
    this.bodyPipe = new ZodPipe(createOrderSchema(config.ORDER_MIN_AMOUNT));
  }

  // POST /api/orders { steamLogin, amount, currency } + Idempotency-Key
  //   -> 201 { order } новый | 200 { order } повтор того же запроса | 409 ключ занят другим заказом | 422 { field, error }
  @Post()
  async create(
    @CurrentUser() user: User,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const key = new ZodPipe(idempotencyKeySchema).transform(rawKey) as string;
    const body = this.bodyPipe.transform(rawBody) as CreateOrderDto;
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
