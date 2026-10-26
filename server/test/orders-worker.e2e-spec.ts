import { randomUUID } from "node:crypto";
import request from "supertest";
import { OrdersWorker } from "../src/orders/orders.worker";
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
});
