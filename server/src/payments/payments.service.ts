import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma, type Order } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CONFIG, type Config } from "../config";
import { ApiError } from "../common/http";
import { OrderStatusService, UNPAID } from "../orders/order-status.service";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma.service";
import { CryptoPayClient, CryptoPayError, fromMinor, toMinor, validCryptoPaySignature, type CryptoPayInvoice } from "./cryptopay.client";
import { validSignature } from "./signature";

// Событие платежной системы в общем виде: в него переводятся уведомления и тестовой платежки, и Crypto Pay
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

// уведомление Crypto Pay: пока бывает только invoice_paid
const cryptoPayUpdateSchema = z.object({
  update_type: z.string(),
  payload: z.object({ invoice_id: z.number(), status: z.string(), fiat: z.string().optional(), amount: z.string() }).passthrough(),
});

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
  private readonly cryptoPay: CryptoPayClient | null;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly status: OrderStatusService,
    @Inject(CONFIG) private readonly config: Config,
  ) {
    this.cryptoPay =
      config.PAYMENT_PROVIDER === "cryptopay" && config.CRYPTOPAY_TOKEN
        ? new CryptoPayClient(config.CRYPTOPAY_TOKEN, config.CRYPTOPAY_NETWORK, config.CRYPTOPAY_API_URL)
        : null;
  }

  // Ссылка на оплату. Платеж создается один раз: повторное нажатие отдает ту же ссылку
  async start(userId: string, orderId: string): Promise<{ order: Order; paymentUrl: string }> {
    let order = await this.orders.get(userId, orderId);
    if ((order.status === "created" || order.status === "pending") && order.expiresAt.getTime() <= Date.now()) {
      await this.status.move(order.id, UNPAID, "expired", "истек срок оплаты");
      throw new ApiError(HttpStatus.CONFLICT, payError.expired!, { status: "expired" });
    }
    if (order.status === "created") {
      const payment = await this.createPayment(order);
      const moved = await this.status.move(order.id, ["created"], "pending", "создан платеж", {
        paymentProvider: this.config.PAYMENT_PROVIDER,
        paymentId: payment.id,
        paymentUrl: payment.url,
      });
      // одновременное нажатие: платеж уже создал другой запрос - лишний счет удаляем
      if (!moved && this.cryptoPay) await this.cryptoPay.deleteInvoice(payment.id).catch(() => {});
      order = await this.orders.get(userId, orderId);
    }
    if (order.status !== "pending" || !order.paymentUrl) {
      throw new ApiError(HttpStatus.CONFLICT, payError[order.status] ?? "Заказ нельзя оплатить", { status: order.status });
    }
    return { order, paymentUrl: order.paymentUrl };
  }

  private async createPayment(order: Order): Promise<{ id: string; url: string }> {
    if (!this.cryptoPay) {
      // тестовая платежка: платеж - просто новый id, страница оплаты у нас же
      const id = randomUUID();
      return { id, url: `/api/payments/fake/${id}` };
    }
    try {
      const invoice = await this.cryptoPay.createInvoice({
        fiat: order.currency,
        amount: fromMinor(order.payAmount),
        description: `Пополнение Steam ${order.steamLogin}`,
        payload: order.id,
        // счет живет не дольше заказа
        expiresIn: Math.max(60, Math.ceil((order.expiresAt.getTime() - Date.now()) / 1000)),
        returnUrl: this.config.SITE_URL,
      });
      return { id: String(invoice.invoice_id), url: invoice.bot_invoice_url };
    } catch (e) {
      this.log.error(`счет для заказа ${order.id} не создан: ${e instanceof Error ? e.message : String(e)}`);
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Платежная система недоступна. Попробуйте еще раз");
    }
  }

  // Уведомление тестовой платежки: подпись X-Signature
  async handleWebhook(raw: Buffer | undefined, signature: string | undefined): Promise<{ ok: true; result: WebhookResult }> {
    if (!raw || !validSignature(this.config.PAYMENT_WEBHOOK_SECRET, raw, signature)) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Неверная подпись уведомления");
    }
    let event: WebhookEvent;
    try {
      event = webhookSchema.parse(JSON.parse(raw.toString("utf8")));
    } catch {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Неверный формат уведомления");
    }
    return this.applyEvent(event);
  }

  // Уведомление Crypto Pay: подпись crypto-pay-api-signature, оплаченный счет -> общее событие
  async handleCryptoPayWebhook(raw: Buffer | undefined, signature: string | undefined): Promise<{ ok: true; result: WebhookResult | "ignored" }> {
    const token = this.config.CRYPTOPAY_TOKEN;
    if (!token || !raw || !validCryptoPaySignature(token, raw, signature)) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Неверная подпись уведомления");
    }
    let update: z.infer<typeof cryptoPayUpdateSchema>;
    try {
      update = cryptoPayUpdateSchema.parse(JSON.parse(raw.toString("utf8")));
    } catch {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Неверный формат уведомления");
    }
    if (update.update_type !== "invoice_paid" || update.payload.status !== "paid") return { ok: true, result: "ignored" };
    return this.applyEvent(this.invoicePaidEvent(update.payload as unknown as CryptoPayInvoice));
  }

  // id события - по счету, а не по update_id (он у Crypto Pay не уникален): вебхук и опрос дают одно событие
  private invoicePaidEvent(invoice: CryptoPayInvoice): WebhookEvent {
    return {
      id: `cryptopay:${invoice.invoice_id}:paid`,
      type: "payment.succeeded",
      payment: { id: String(invoice.invoice_id), amount: toMinor(invoice.amount), currency: invoice.fiat ?? "" },
    };
  }

  // Опрос Crypto Pay: вебхуки приходят только на HTTPS-адрес, а у стенда и локалки его нет
  @Interval(10_000)
  async pollTick() {
    if (this.config.WORKERS && this.cryptoPay) await this.pollCryptoPay();
  }

  async pollCryptoPay(): Promise<number> {
    if (!this.cryptoPay || this.polling) return 0;
    this.polling = true;
    try {
      const pending = await this.prisma.order.findMany({
        where: { paymentProvider: "cryptopay", status: "pending", paymentId: { not: null } },
        select: { paymentId: true },
        take: 100,
      });
      if (!pending.length) return 0;
      const paid = await this.cryptoPay.getInvoices(pending.map((o) => o.paymentId!), "paid");
      let applied = 0;
      for (const invoice of paid) if ((await this.applyEvent(this.invoicePaidEvent(invoice))).result === "applied") applied++;
      return applied;
    } catch (e) {
      if (e instanceof CryptoPayError) this.log.warn(`опрос Crypto Pay: ${e.message}`);
      else throw e;
      return 0;
    } finally {
      this.polling = false;
    }
  }

  // Общая обработка: ровно одна на id события; сумма и валюта сверяются с заказом;
  // оплачивается только заказ в pending (условный переход)
  async applyEvent(event: WebhookEvent): Promise<{ ok: true; result: WebhookResult }> {
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
      // то же событие уже обработано (повтор, в том числе одновременный) - отвечаем 200, чтобы платежка перестала слать
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
