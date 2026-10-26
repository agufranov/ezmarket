import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { Order } from "@prisma/client";
import { CONFIG, type Config } from "../config";
import { PrismaService } from "../prisma.service";
import { OrderStatusService, UNPAID } from "./order-status.service";
import { SteamTopUpService, TopUpError } from "./steam-topup.service";

const BATCH = 100;
// захват выполнения: дольше любого вызова поставщика (у вызова свой таймаут, меньше этого срока)
export const FULFIL_LEASE_MS = 5 * 60_000;
// после стольких попыток с неизвестным исходом заказ не берется снова - нужна ручная сверка
export const FULFIL_MAX_ATTEMPTS = 5;

// Фоновые задачи заказов. В тестах выключены (WORKERS=false) - там их зовут вручную.
@Injectable()
export class OrdersWorker {
  private readonly log = new Logger("orders");
  private expiring = false;
  private fulfilling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    private readonly steam: SteamTopUpService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Interval(15_000)
  async expireTick() {
    if (this.config.WORKERS) await this.expire();
  }

  @Interval(3_000)
  async fulfilTick() {
    if (this.config.WORKERS) await this.fulfil();
  }

  // Неоплаченные заказы старше 30 минут -> expired (частичный индекс orders_unpaid_expires_at_idx).
  // Заказы, которые ждут оплаты в Crypto Pay, здесь не трогаем: перед истечением нужно спросить статус счета -
  // это делает PaymentsService.expireCryptoPay (иначе оплата в последние секунды пропала бы)
  async expire(): Promise<number> {
    if (this.expiring) return 0;
    this.expiring = true;
    try {
      const due = await this.prisma.order.findMany({
        where: {
          status: { in: UNPAID },
          expiresAt: { lte: new Date() },
          OR: [{ status: "created" }, { paymentProvider: null }, { paymentProvider: { not: "cryptopay" } }],
        },
        select: { id: true, status: true },
        take: BATCH,
      });
      let n = 0;
      // переход - только из выбранного статуса: заказ, который за это время получил счет Crypto Pay (created -> pending),
      // не истечет здесь в обход проверки счета; оплаченный или отмененный - тоже
      for (const { id, status } of due) if (await this.status.move(id, [status], "expired", "истек срок оплаты")) n++;
      return n;
    } finally {
      this.expiring = false;
    }
  }

  // Оплаченные заказы: paid -> processing (захват: один экземпляр сервера на заказ) -> completed | failed.
  // Захват ограничен по времени: заказ, застрявший в processing дольше FULFIL_LEASE_MS (процесс упал до или после
  // вызова поставщика, итог не записался), берется снова. Поставщик получает id заказа ключом повтора -
  // повторный вызов не пополняет дважды
  async fulfil(): Promise<number> {
    if (this.fulfilling) return 0;
    this.fulfilling = true;
    try {
      let n = 0;
      const paid = await this.prisma.order.findMany({ where: { status: "paid" }, orderBy: { updatedAt: "asc" }, take: BATCH });
      for (const order of paid) {
        const claimed = await this.status.move(order.id, ["paid"], "processing", "передан на пополнение Steam", {
          fulfilClaimedAt: new Date(),
          fulfilAttempts: { increment: 1 },
        });
        if (!claimed) continue;
        await this.runTopUp(order, order.fulfilAttempts + 1);
        n++;
      }

      const stale = await this.prisma.order.findMany({
        where: {
          status: "processing",
          fulfilAttempts: { lt: FULFIL_MAX_ATTEMPTS },
          OR: [{ fulfilClaimedAt: null }, { fulfilClaimedAt: { lt: new Date(Date.now() - FULFIL_LEASE_MS) } }],
        },
        orderBy: { updatedAt: "asc" },
        take: BATCH,
      });
      for (const order of stale) {
        // повторный захват - условный по прежнему времени захвата: два экземпляра не возьмут заказ оба
        const r = await this.prisma.order.updateMany({
          where: { id: order.id, status: "processing", fulfilClaimedAt: order.fulfilClaimedAt },
          data: { fulfilClaimedAt: new Date(), fulfilAttempts: { increment: 1 } },
        });
        if (r.count !== 1) continue;
        await this.runTopUp(order, order.fulfilAttempts + 1);
        n++;
      }
      return n;
    } finally {
      this.fulfilling = false;
    }
  }

  // failed - только подтвержденный отказ поставщика. Неизвестный исход (сеть, таймаут) и сбой записи completed
  // после успешного пополнения - не failed: заказ остается в processing и будет повторен после истечения захвата
  private async runTopUp(order: Order, attempt: number) {
    try {
      await this.steam.topUp(order);
    } catch (e) {
      if (e instanceof TopUpError) {
        await this.status.move(order.id, ["processing"], "failed", e.message);
        return;
      }
      const why = e instanceof Error ? e.message : String(e);
      if (attempt >= FULFIL_MAX_ATTEMPTS) {
        this.log.error(`заказ ${order.id}: поставщик не подтвердил пополнение после ${attempt} попыток (${why}) - нужна ручная сверка`);
      } else {
        this.log.warn(`заказ ${order.id}: исход пополнения неизвестен (${why}), попытка ${attempt} - повторим`);
      }
      return;
    }
    try {
      await this.status.move(order.id, ["processing"], "completed", "Steam пополнен");
    } catch (e) {
      this.log.error(`заказ ${order.id}: Steam пополнен, но итог не записан (${e instanceof Error ? e.message : String(e)}) - повторим`);
    }
  }
}
