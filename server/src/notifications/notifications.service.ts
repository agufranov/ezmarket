import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { bonusText, orderEmail, orderText, type Piece } from "./texts";

type Tx = Prisma.TransactionClient;

const LIST_LIMIT = 50;
const withSource = {
  order: { select: { amount: true, currency: true } },
  history: { select: { toStatus: true } },
  bonusTx: { select: { kind: true, delta: true } },
} satisfies Prisma.NotificationInclude;
type Row = Prisma.NotificationGetPayload<{ include: typeof withSource }>;

export type NotificationDto = {
  id: string;
  type: Row["type"];
  text: Piece[];
  // значок: steam - заказ пополнения, coin - бонусы (картинки - на фронте)
  icon: "steam" | "coin";
  orderId: string | null;
  read: boolean;
  at: string;
};

// текст - из источника: статус заказа из строки истории, вид и сумма бонусов из истории бонусов
const toDto = (n: Row): NotificationDto => ({
  id: String(n.id),
  type: n.type,
  text: n.history && n.order ? orderText(n.history.toStatus, n.order) : n.bonusTx ? bonusText(n.bonusTx.kind, n.bonusTx.delta) : [],
  icon: n.type === "order" ? "steam" : "coin",
  orderId: n.orderId,
  read: n.readAt !== null,
  at: n.createdAt.toISOString(),
});

// Уведомления создают триггеры базы (миграция 20261027150000_notifications) - здесь чтение, отметка о прочтении
// и письмо об итоге заказа
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<{ unread: number; items: NotificationDto[] }> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { id: "desc" }, take: LIST_LIMIT, include: withSource }),
      this.unread(userId),
    ]);
    return { unread, items: rows.map(toDto) };
  }

  unread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  // свои уведомления: ids - выбранные (чужие и несуществующие просто не найдутся), без ids - все
  async markRead(userId: string, ids?: bigint[]): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    return { unread: await this.unread(userId) };
  }

  // Письмо об итоге оплаченного заказа - в той же транзакции, что и переход: письмо уходит из очереди email_outbox,
  // сбой почты не откатывает заказ, воркер почты повторит отправку
  async enqueueOrderEmail(tx: Tx, orderId: string, status: "completed" | "failed") {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: { select: { email: true } } } });
    await tx.emailOutbox.create({ data: { to: order.user.email, ...orderEmail(order, status) } });
  }
}
