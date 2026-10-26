import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma, type Order } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CONFIG, type Config } from "../config";
import { ApiError } from "../common/http";
import { OrderStatusService, UNPAID } from "../orders/order-status.service";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma.service";
import { validSignature } from "./signature";

// Уведомление платежной системы (формат встроенной тестовой; настоящая ляжет сюда же через адаптер)
export const webhookSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["payment.succeeded", "payment.canceled"]),
  payment: z.object({
    id: z.string().min(1).max(128),
    amount: z.number().int().nonnegative(),
    currency: z.string().min(3).max(3),
  }),
});
export type WebhookEvent = z.infer<typeof webhookSchema>;

export type WebhookResult = "applied" | "already_paid" | "late" | "amount_mismatch" | "unknown_payment" | "duplicate";

const payError: Partial<Record<Order["status"], string>> = {
  paid: "Заказ уже оплачен",
  processing: "Заказ уже оплачен",
  completed: "Заказ уже выполнен",
  canceled: "Заказ отменен",
  expired: "Заказ истек - создайте новый",
  failed: "Заказ завершился ошибкой",
};

@Injectable()
export class PaymentsService {
  private readonly log = new Logger("payments");

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly status: OrderStatusService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // Ссылка на оплату. Платеж создается один раз: повторное нажатие отдает ту же ссылку
  async start(userId: string, orderId: string): Promise<{ order: Order; paymentUrl: string }> {
    let order = await this.orders.get(userId, orderId);
    if (order.status === "created" || order.status === "pending") {
      if (order.expiresAt.getTime() <= Date.now()) {
        await this.status.move(order.id, UNPAID, "expired", "истек срок оплаты");
        throw new ApiError(HttpStatus.CONFLICT, payError.expired!, { status: "expired" });
      }
    }
    if (order.status === "created") {
      // платеж у тестовой платежной системы - просто новый id; у настоящей здесь будет запрос к ее API
      const paymentId = randomUUID();
      await this.status.move(order.id, ["created"], "pending", "создан платеж", { paymentId });
      order = await this.orders.get(userId, orderId);
    }
    if (order.status !== "pending" || !order.paymentId) {
      throw new ApiError(HttpStatus.CONFLICT, payError[order.status] ?? "Заказ нельзя оплатить", { status: order.status });
    }
    return { order, paymentUrl: this.paymentUrl(order.paymentId) };
  }

  paymentUrl(paymentId: string) {
    return `/api/payments/fake/${paymentId}`;
  }

  // Уведомление об оплате: подпись, затем ровно одна обработка на id события.
  // Сумма и валюта сверяются с заказом; оплачивается только заказ в pending (условный переход).
  async handleWebhook(raw: Buffer | undefined, signature: string | undefined): Promise<{ ok: true; result: WebhookResult }> {
    if (!raw || !validSignature(this.config.PAYMENT_WEBHOOK_SECRET, raw, signature)) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Неверная подпись уведомления");
    }
    let parsed: WebhookEvent;
    try {
      parsed = webhookSchema.parse(JSON.parse(raw.toString("utf8")));
    } catch {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Неверный формат уведомления");
    }
    const event = parsed;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { paymentId: event.payment.id } });
        const result = await this.apply(tx, order, event);
        await tx.paymentEvent.create({
          data: {
            providerEventId: event.id,
            paymentId: event.payment.id,
            orderId: order?.id,
            type: event.type,
            amount: event.payment.amount,
            currency: event.payment.currency,
            result,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });
        return result;
      });
      if (result !== "applied" && result !== "already_paid") {
        this.log.warn(`уведомление ${event.id} по платежу ${event.payment.id}: ${result}`);
      }
      return { ok: true, result };
    } catch (e) {
      // то же уведомление уже обработано (повтор, в том числе одновременный) - отвечаем 200, чтобы платежка перестала слать
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, result: "duplicate" };
      throw e;
    }
  }

  private async apply(tx: Prisma.TransactionClient, order: Order | null, event: WebhookEvent): Promise<WebhookResult> {
    if (!order) return "unknown_payment";

    if (event.type === "payment.canceled") {
      const moved = await this.status.move(order.id, ["pending"], "canceled", "платеж отменен в платежной системе", {}, tx);
      return moved ? "applied" : "late";
    }

    if (event.payment.amount !== order.payAmount || event.payment.currency !== order.currency) return "amount_mismatch";
    const moved = await this.status.move(order.id, ["pending"], "paid", "оплата подтверждена платежной системой", {}, tx);
    if (moved) return "applied";
    // заказ уже оплачен этим же платежом (другое событие) или успел отмениться/истечь - деньги вернуть вручную
    const now = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    return ["paid", "processing", "completed"].includes(now.status) ? "already_paid" : "late";
  }
}
