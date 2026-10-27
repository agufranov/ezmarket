import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, type Order, type OrderStatusHistory } from "@prisma/client";
import { CONFIG, ORDER_RULES, type Config } from "../config";
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
  // списано бонусов в оплату и начислится за выполненный заказ (1 бонус = 1 ₽)
  bonusSpent: number;
  bonusAccrual: number;
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
  bonusSpent: o.bonusSpent,
  bonusAccrual: o.bonusAccrual,
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

const sameRequest = (o: Order, dto: CreateOrderDto) =>
  o.steamLogin === dto.steamLogin && o.amount === dto.amount && o.currency === dto.currency && o.bonusSpent === dto.bonuses;

// сколько бонусов можно списать в заказ: не больше 30% суммы (сумма в копейках, бонус = 1 ₽ = 100 копеек)
export const maxBonuses = (amount: number) => Math.floor((amount * ORDER_RULES.bonusMaxPercent) / 100 / 100);

@Injectable()
export class OrdersService {
  private readonly log = new Logger("orders");

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    @Inject(CRYPTOPAY) private readonly cryptoPay: CryptoPayClient | null,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // Повтор с тем же ключом отдает тот же заказ (created: false); тот же ключ с другими данными - 409.
  // Бонусы списываются в той же транзакции, что и создается заказ: не хватило - нет ни заказа, ни списания;
  // повтор с тем же ключом (в том числе одновременный) откатывается на уникальном индексе - второго списания нет
  async create(userId: string, idempotencyKey: string, dto: CreateOrderDto): Promise<{ order: Order; created: boolean }> {
    const existing = await this.prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (existing) return { order: this.checkSame(existing, dto), created: false };

    const bonuses = dto.bonuses;
    if (bonuses > 0) this.checkBonuses(dto);
    const payAmount = dto.amount - bonuses * 100;
    // кэшбэк - от оплаченного деньгами, только за заказы в рублях; начислит триггер при completed
    const bonusAccrual = dto.currency === ORDER_RULES.bonusCurrency ? Math.floor((payAmount * this.config.BONUS_CASHBACK_PERCENT) / 10000) : 0;

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId,
            idempotencyKey,
            steamLogin: dto.steamLogin,
            amount: dto.amount,
            currency: dto.currency,
            payAmount,
            bonusSpent: bonuses,
            bonusAccrual,
            expiresAt: new Date(Date.now() + ORDER_RULES.ttlMs),
          },
        });
        if (bonuses > 0) {
          // условный UPDATE: одновременные заказы на один остаток проходят, только пока его хватает (баланс не ниже 0)
          const [row] = await tx.$queryRaw<{ bonus_balance: number }[]>`
            UPDATE "users" SET "bonus_balance" = "bonus_balance" - ${bonuses}
            WHERE "id" = ${userId} AND "bonus_balance" >= ${bonuses}
            RETURNING "bonus_balance"`;
          if (!row) {
            const { bonusBalance } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { bonusBalance: true } });
            throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, `Недостаточно бонусов - доступно ${bonusBalance}`, {
              field: "bonuses",
              available: bonusBalance,
            });
          }
          await tx.bonusTransaction.create({ data: { userId, orderId: order.id, kind: "spend", delta: -bonuses, balanceAfter: row.bonus_balance } });
        }
        return order;
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

  // Отмена пользователем - только пока заказ не оплачен; повторная отмена отдает тот же отмененный заказ.
  // Переход - только из прочитанного статуса: если параллельный /pay успел создать счет (created -> pending),
  // отмена перечитывает заказ и сначала закрывает этот счет - иначе по нему можно было бы заплатить за отмененный заказ
  async cancel(userId: string, id: string) {
    for (let step = 0; step < 3; step++) {
      const order = await this.get(userId, id);
      if (order.status === "canceled") return order;
      if (!UNPAID.includes(order.status)) {
        throw new ApiError(HttpStatus.CONFLICT, cancelError[order.status] ?? "Заказ уже нельзя отменить", { status: order.status });
      }
      if (order.status === "pending" && order.paymentProvider === "cryptopay" && order.paymentId) await this.closeInvoice(order.paymentId);
      if (await this.status.move(id, [order.status], "canceled", "отменен пользователем")) return this.get(userId, id);
    }
    throw new ApiError(HttpStatus.CONFLICT, "Заказ меняется прямо сейчас - попробуйте еще раз");
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

  // правила списания: только рубли (1 бонус = 1 ₽), не больше 30% суммы; хватает ли остатка - решает условный UPDATE
  private checkBonuses(dto: CreateOrderDto) {
    if (dto.currency !== ORDER_RULES.bonusCurrency) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Бонусами можно оплатить только пополнение в рублях", { field: "bonuses" });
    }
    const max = maxBonuses(dto.amount);
    if (dto.bonuses > max) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, `Бонусами можно оплатить не больше ${ORDER_RULES.bonusMaxPercent}% заказа - до ${max}`, {
        field: "bonuses",
        max,
      });
    }
  }

  private checkSame(order: Order, dto: CreateOrderDto) {
    if (!sameRequest(order, dto)) {
      throw new ApiError(HttpStatus.CONFLICT, "Этот Idempotency-Key уже использован для другого заказа");
    }
    return order;
  }
}
