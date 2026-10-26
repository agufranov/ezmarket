import { randomUUID } from "node:crypto";
import request from "supertest";
import { OrderStatusService } from "../src/orders/order-status.service";
import { FULFIL_LEASE_MS, FULFIL_MAX_ATTEMPTS, OrdersWorker } from "../src/orders/orders.worker";
import { SteamTopUpService } from "../src/orders/steam-topup.service";
import { signBody } from "../src/payments/signature";
import { loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Фоновые задачи заказа: истечение через 30 минут и выполнение оплаченного заказа
describe("orders: фоновые задачи", () => {
  let t: TestApp;
  let cookie: string;
  const http = () => request(t.url);
  const worker = () => t.app.get(OrdersWorker);
  const status = async (id: string) => (await t.prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const historyOf = async (id: string) =>
    (await t.prisma.orderStatusHistory.findMany({ where: { orderId: id }, orderBy: { id: "asc" } })).map((h) => h.toStatus);

  const newOrder = async (steamLogin = "gaben") => {
    const res = await http().post("/api/orders").set("Cookie", cookie).set("Idempotency-Key", randomUUID()).send({ steamLogin, amount: 500_00, currency: "RUB" });
    return res.body.order.id as string;
  };
  const startPayment = async (id: string) => (await http().post(`/api/orders/${id}/pay`).set("Cookie", cookie)).body.paymentUrl.split("/").pop() as string;
  const payWebhook = (paymentId: string) => {
    const body = JSON.stringify({ id: randomUUID(), type: "payment.succeeded", payment: { id: paymentId, amount: 500_00, currency: "RUB" } });
    return http()
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("X-Signature", signBody(t.config.PAYMENT_WEBHOOK_SECRET, body))
      .send(body);
  };
  const paidOrder = async (steamLogin?: string) => {
    const id = await newOrder(steamLogin);
    await payWebhook(await startPayment(id));
    return id;
  };
  const backdate = (id: string) => t.prisma.order.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

  beforeAll(async () => {
    t = await startApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    ({ cookie } = await loginAs(t.prisma, "alex@mail.ru"));
  });

  describe("истечение", () => {
    it("неоплаченный заказ через 30 минут истекает, свежий и оплаченный - нет", async () => {
      const old = await newOrder();
      const oldPending = await newOrder();
      await startPayment(oldPending);
      const fresh = await newOrder();
      const paid = await paidOrder();
      await Promise.all([old, oldPending, paid].map(backdate));

      expect(await worker().expire()).toBe(2);
      expect(await status(old)).toBe("expired");
      expect(await status(oldPending)).toBe("expired");
      expect(await status(fresh)).toBe("created");
      expect(await status(paid)).toBe("paid");
      const last = await t.prisma.orderStatusHistory.findFirst({ where: { orderId: old }, orderBy: { id: "desc" } });
      expect(last?.reason).toBe("истек срок оплаты");
    });

    it("истечение и оплата одновременно - ровно одно из двух", async () => {
      for (let i = 0; i < 5; i++) {
        await resetDb(t.prisma);
        ({ cookie } = await loginAs(t.prisma, "alex@mail.ru"));
        const id = await newOrder();
        const paymentId = await startPayment(id);
        await backdate(id);
        await Promise.all([worker().expire(), payWebhook(paymentId)]);
        const final = await status(id);
        expect(["expired", "paid"]).toContain(final);
        const history = await historyOf(id);
        expect(history.filter((s) => s === "expired" || s === "paid")).toEqual([final]);
      }
    });
  });

  describe("выполнение", () => {
    it("оплаченный заказ: processing -> completed, вся история по порядку", async () => {
      const id = await paidOrder();
      expect(await worker().fulfil()).toBe(1);
      const res = await http().get(`/api/orders/${id}`).set("Cookie", cookie);
      expect(res.body.order.status).toBe("completed");
      expect(res.body.order.history.map((h: { to: string }) => h.to)).toEqual(["created", "pending", "paid", "processing", "completed"]);
    });

    it("поставщик отказал - failed с причиной", async () => {
      const id = await paidOrder("fail_nobody");
      await worker().fulfil();
      expect(await status(id)).toBe("failed");
      const last = await t.prisma.orderStatusHistory.findFirst({ where: { orderId: id }, orderBy: { id: "desc" } });
      expect(last).toMatchObject({ fromStatus: "processing", toStatus: "failed", reason: "Steam не нашел аккаунт с таким логином" });
    });

    it("неоплаченный заказ не выполняется", async () => {
      const id = await newOrder();
      await startPayment(id);
      expect(await worker().fulfil()).toBe(0);
      expect(await status(id)).toBe("pending");
    });

    it("два экземпляра сервера на одном заказе - Steam пополняется один раз", async () => {
      const second = await startApp();
      try {
        const id = await paidOrder();
        const spyA = jest.spyOn(t.app.get(SteamTopUpService), "topUp");
        const spyB = jest.spyOn(second.app.get(SteamTopUpService), "topUp");
        await Promise.all([worker().fulfil(), second.app.get(OrdersWorker).fulfil()]);
        expect(spyA.mock.calls.length + spyB.mock.calls.length).toBe(1);
        expect(await status(id)).toBe("completed");
        expect((await historyOf(id)).filter((s) => s === "processing")).toHaveLength(1);
      } finally {
        await second.app.close();
      }
    });
  });

  // ревью F4, F5: захват выполнения с ограниченным сроком и честный итог
  describe("восстановление выполнения", () => {
    // состояние базы после падения процесса сразу после захвата (или после успешного пополнения, до записи итога)
    const stuckProcessing = async (claimedAgoMs: number, attempts = 1) => {
      const id = await paidOrder();
      await t.app.get(OrderStatusService).move(id, ["paid"], "processing", "передан на пополнение Steam", {
        fulfilClaimedAt: new Date(Date.now() - claimedAgoMs),
        fulfilAttempts: attempts,
      });
      return id;
    };
    const expireClaim = (id: string) =>
      t.prisma.order.update({ where: { id }, data: { fulfilClaimedAt: new Date(Date.now() - FULFIL_LEASE_MS - 1000) } });
    afterEach(() => jest.restoreAllMocks());

    it("процесс упал после захвата - другой экземпляр после истечения захвата выполняет заказ (F4)", async () => {
      const id = await stuckProcessing(FULFIL_LEASE_MS + 60_000);
      const second = await startApp();
      try {
        const topUp = jest.spyOn(second.app.get(SteamTopUpService), "topUp");
        expect(await second.app.get(OrdersWorker).fulfil()).toBe(1);
        expect(topUp).toHaveBeenCalledTimes(1);
        expect(topUp.mock.calls[0][0]).toMatchObject({ id });
        expect(await status(id)).toBe("completed");
        const row = await t.prisma.order.findUniqueOrThrow({ where: { id } });
        expect(row.fulfilAttempts).toBe(2);
      } finally {
        await second.app.close();
      }
    });

    it("свежий захват не перехватывается: исполнитель жив", async () => {
      const id = await stuckProcessing(10_000);
      const topUp = jest.spyOn(t.app.get(SteamTopUpService), "topUp");
      expect(await worker().fulfil()).toBe(0);
      expect(topUp).not.toHaveBeenCalled();
      expect(await status(id)).toBe("processing");
    });

    it("два экземпляра на зависшем заказе - перехватывает и пополняет один", async () => {
      const id = await stuckProcessing(FULFIL_LEASE_MS + 60_000);
      const second = await startApp();
      try {
        const spyA = jest.spyOn(t.app.get(SteamTopUpService), "topUp");
        const spyB = jest.spyOn(second.app.get(SteamTopUpService), "topUp");
        await Promise.all([worker().fulfil(), second.app.get(OrdersWorker).fulfil()]);
        expect(spyA.mock.calls.length + spyB.mock.calls.length).toBe(1);
        expect(await status(id)).toBe("completed");
      } finally {
        await second.app.close();
      }
    });

    it("пополнение прошло, запись completed не удалась - не failed, а повтор и completed (F5)", async () => {
      const id = await paidOrder();
      const svc = t.app.get(OrderStatusService);
      const move = svc.move.bind(svc);
      let broke = false;
      jest.spyOn(svc, "move").mockImplementation(async (...args) => {
        if (args[2] === "completed" && !broke) {
          broke = true;
          throw new Error("transient DB error persisting completion");
        }
        return move(...args);
      });
      const topUp = jest.spyOn(t.app.get(SteamTopUpService), "topUp");

      await worker().fulfil();
      expect(topUp).toHaveBeenCalledTimes(1);
      expect(await status(id)).toBe("processing");
      expect(await historyOf(id)).not.toContain("failed");

      await expireClaim(id);
      await worker().fulfil();
      // повтор - с тем же ключом (id заказа): у поставщика второй вызов не пополняет второй раз
      expect(topUp).toHaveBeenCalledTimes(2);
      expect(topUp.mock.calls[1][0]).toMatchObject({ id });
      expect(await status(id)).toBe("completed");
    });

    it("исход у поставщика неизвестен (сеть) - не failed; после всех попыток заказ ждет ручной сверки", async () => {
      const id = await paidOrder();
      const topUp = jest.spyOn(t.app.get(SteamTopUpService), "topUp").mockRejectedValue(new Error("ETIMEDOUT"));
      await worker().fulfil();
      expect(await status(id)).toBe("processing");
      for (let i = 1; i < FULFIL_MAX_ATTEMPTS; i++) {
        await expireClaim(id);
        await worker().fulfil();
      }
      expect(topUp).toHaveBeenCalledTimes(FULFIL_MAX_ATTEMPTS);
      await expireClaim(id);
      expect(await worker().fulfil()).toBe(0);
      expect(topUp).toHaveBeenCalledTimes(FULFIL_MAX_ATTEMPTS);
      expect(await status(id)).toBe("processing");
    });
  });
});
