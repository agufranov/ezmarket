import { Injectable } from "@nestjs/common";
import type { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type Tx = Prisma.TransactionClient;

// Единственное место, где меняется статус заказа.
// Переход - условный UPDATE: из двух одновременных попыток проходит одна, вторая получает false.
// Причина уходит в историю через триггер (set_config действует до конца транзакции).
@Injectable()
export class OrderStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async move(
    id: string,
    from: OrderStatus[],
    to: OrderStatus,
    reason: string,
    data: Prisma.OrderUpdateManyMutationInput = {},
    tx?: Tx,
  ): Promise<boolean> {
    const run = async (db: Tx) => {
      await db.$executeRaw`SELECT set_config('ezmarket.status_reason', ${reason}, true)`;
      const r = await db.order.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
      return r.count === 1;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }
}

// Статусы, из которых заказ еще можно отменить или он может истечь
export const UNPAID: OrderStatus[] = ["created", "pending"];
