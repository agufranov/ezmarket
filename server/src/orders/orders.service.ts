import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, type Order, type OrderStatusHistory } from "@prisma/client";
import { ORDER_RULES } from "../config";
import { ApiError } from "../common/http";
import { CryptoPayError, type CryptoPayClient } from "../payments/cryptopay.client";
import { CRYPTOPAY } from "../payments/cryptopay.module";
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
  // куда идти платить - только пока заказ ждет оплаты
  paymentUrl: string | null;
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
  paymentUrl: o.status === "pending" ? o.paymentUrl : null,
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
  private readonly log = new Logger("orders");

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    @Inject(CRYPTOPAY) private readonly cryptoPay: CryptoPayClient | null,
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
    if (order.status === "pending" && order.paymentProvider === "cryptopay" && order.paymentId) await this.closeInvoice(order.paymentId);
    const moved = await this.status.move(id, UNPAID, "canceled", "отменен пользователем");
    if (!moved) {
      const now = await this.get(userId, id);
      if (now.status === "canceled") return now;
      throw new ApiError(HttpStatus.CONFLICT, cancelError[now.status] ?? "Заказ уже нельзя отменить", { status: now.status });
    }
    return this.get(userId, id);
  }

  // Перед отменой счет в Crypto Pay должен стать неоплачиваемым: иначе по старой ссылке в боте можно заплатить
  // за отмененный заказ. Оплачен - не отменяем (опрос проведет оплату); активен - удаляем; нет ответа - просим повторить
  private async closeInvoice(paymentId: string) {
    if (!this.cryptoPay) return;
    try {
      const [invoice] = await this.cryptoPay.getInvoices([paymentId]);
      if (invoice?.status === "paid") {
        throw new ApiError(HttpStatus.CONFLICT, "Заказ уже оплачен - статус обновится через несколько секунд", { status: "paid" });
      }
      if (invoice?.status === "active") await this.cryptoPay.deleteInvoice(paymentId);
    } catch (e) {
      if (!(e instanceof CryptoPayError)) throw e;
      this.log.warn(`отмена: счет ${paymentId} не закрыт (${e.message})`);
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Не удалось отменить: платежная система не ответила. Попробуйте еще раз");
    }
  }

  private checkSame(order: Order, dto: CreateOrderDto) {
    if (!sameRequest(order, dto)) {
      throw new ApiError(HttpStatus.CONFLICT, "Этот Idempotency-Key уже использован для другого заказа");
    }
    return order;
  }
}
