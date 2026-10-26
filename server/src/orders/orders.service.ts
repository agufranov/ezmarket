import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, type Order, type OrderStatusHistory } from "@prisma/client";
import { ORDER_RULES } from "../config";
import { ApiError } from "../common/http";
import { PrismaService } from "../prisma.service";
import { OrderStatusService, UNPAID } from "./order-status.service";
import type { CreateOrderDto } from "./orders.schemas";

export type OrderDto = {
  id: string;
  steamLogin: string;
  amount: number;
  currency: string;
  payAmount: number;
  status: Order["status"];
  expiresAt: string;
  createdAt: string;
  history?: { from: string | null; to: string; reason: string | null; at: string }[];
};

export const toOrderDto = (o: Order & { history?: OrderStatusHistory[] }): OrderDto => ({
  id: o.id,
  steamLogin: o.steamLogin,
  amount: o.amount,
  currency: o.currency,
  payAmount: o.payAmount,
  status: o.status,
  expiresAt: o.expiresAt.toISOString(),
  createdAt: o.createdAt.toISOString(),
  ...(o.history && {
    history: o.history.map((h) => ({ from: h.fromStatus, to: h.toStatus, reason: h.reason, at: h.createdAt.toISOString() })),
  }),
});

const cancelError: Partial<Record<Order["status"], string>> = {
  paid: "Заказ уже оплачен - отменить нельзя",
  processing: "Заказ уже выполняется - отменить нельзя",
  completed: "Заказ уже выполнен",
  expired: "Заказ истек",
  failed: "Заказ завершился ошибкой",
};

const sameRequest = (o: Order, dto: CreateOrderDto) => o.steamLogin === dto.steamLogin && o.amount === dto.amount && o.currency === dto.currency;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
  ) {}

  // Повтор с тем же ключом отдает тот же заказ (created: false); тот же ключ с другими данными - 409
  async create(userId: string, idempotencyKey: string, dto: CreateOrderDto): Promise<{ order: Order; created: boolean }> {
    const existing = await this.prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (existing) return { order: this.checkSame(existing, dto), created: false };

    try {
      const order = await this.prisma.order.create({
        data: {
          userId,
          idempotencyKey,
          steamLogin: dto.steamLogin,
          amount: dto.amount,
          currency: dto.currency,
          payAmount: dto.amount,
          expiresAt: new Date(Date.now() + ORDER_RULES.ttlMs),
        },
      });
      return { order, created: true };
    } catch (e) {
      // два одновременных запроса с одним ключом: второй упирается в уникальный индекс и отдает заказ первого
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
        return { order: this.checkSame(order, dto), created: false };
      }
      throw e;
    }
  }

  list(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  // Чужой заказ неотличим от несуществующего - 404, без подсказки, что такой id есть
  async get(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: { history: { orderBy: { id: "asc" } } } });
    if (!order) throw new ApiError(HttpStatus.NOT_FOUND, "Заказ не найден");
    return order;
  }

  // Отмена пользователем - только пока заказ не оплачен; повторная отмена отдает тот же отмененный заказ
  async cancel(userId: string, id: string) {
    const order = await this.get(userId, id);
    if (order.status === "canceled") return order;
    const moved = await this.status.move(id, UNPAID, "canceled", "отменен пользователем");
    if (!moved) {
      const now = await this.get(userId, id);
      if (now.status === "canceled") return now;
      throw new ApiError(HttpStatus.CONFLICT, cancelError[now.status] ?? "Заказ уже нельзя отменить", { status: now.status });
    }
    return this.get(userId, id);
  }

  private checkSame(order: Order, dto: CreateOrderDto) {
    if (!sameRequest(order, dto)) {
      throw new ApiError(HttpStatus.CONFLICT, "Этот Idempotency-Key уже использован для другого заказа");
    }
    return order;
  }
}
