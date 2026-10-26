import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { CONFIG, type Config } from "../config";
import { PrismaService } from "../prisma.service";
import { OrderStatusService, UNPAID } from "./order-status.service";
import { SteamTopUpService, TopUpError } from "./steam-topup.service";

const BATCH = 100;

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

  // Неоплаченные заказы старше 30 минут -> expired (частичный индекс orders_unpaid_expires_at_idx)
  async expire(): Promise<number> {
    if (this.expiring) return 0;
    this.expiring = true;
    try {
      const due = await this.prisma.order.findMany({
        where: { status: { in: UNPAID }, expiresAt: { lte: new Date() } },
        select: { id: true },
        take: BATCH,
      });
      let n = 0;
      // условный переход: если заказ в этот момент оплатили или отменили, он не истечет
      for (const { id } of due) if (await this.status.move(id, UNPAID, "expired", "истек срок оплаты")) n++;
      return n;
    } finally {
      this.expiring = false;
    }
  }

  // Оплаченные заказы: paid -> processing (захват: один экземпляр сервера на заказ) -> completed | failed
  async fulfil(): Promise<number> {
    if (this.fulfilling) return 0;
    this.fulfilling = true;
    try {
      const paid = await this.prisma.order.findMany({ where: { status: "paid" }, orderBy: { updatedAt: "asc" }, take: BATCH });
      let n = 0;
      for (const order of paid) {
        if (!(await this.status.move(order.id, ["paid"], "processing", "передан на пополнение Steam"))) continue;
        try {
          await this.steam.topUp(order);
          await this.status.move(order.id, ["processing"], "completed", "Steam пополнен");
        } catch (e) {
          const reason = e instanceof TopUpError ? e.message : "ошибка поставщика пополнения";
          if (!(e instanceof TopUpError)) this.log.error(`заказ ${order.id}: ${e instanceof Error ? e.message : String(e)}`);
          await this.status.move(order.id, ["processing"], "failed", reason);
        }
        n++;
      }
      return n;
    } finally {
      this.fulfilling = false;
    }
  }
}
