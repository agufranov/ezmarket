import { randomUUID } from "node:crypto";
import request from "supertest";
import { signBody } from "../src/payments/signature";
import { loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Оплата и уведомления платежной системы (критерии «Уведомления об оплате» из плана недели)
describe("payments", () => {
  let t: TestApp;
  let cookie: string;
  const http = () => request(t.url);
  const secret = () => t.config.PAYMENT_WEBHOOK_SECRET;

  const newOrder = async (amount = 500_00, currency = "RUB") => {
    const res = await http()
      .post("/api/orders")
      .set("Cookie", cookie)
      .set("Idempotency-Key", randomUUID())
      .send({ steamLogin: "gaben", amount, currency });
    return res.body.order as { id: string; payAmount: number; currency: string };
  };
  const pay = (id: string, c = cookie) => http().post(`/api/orders/${id}/pay`).set("Cookie", c);
  const paidOrder = async () => {
    const order = await newOrder();
    const res = await pay(order.id);
    return { ...order, paymentId: res.body.paymentUrl.split("/").pop() as string };
  };
  const event = (paymentId: string, over: Partial<{ id: string; type: string; amount: number; currency: string }> = {}) =>
    JSON.stringify({
      id: over.id ?? randomUUID(),
      type: over.type ?? "payment.succeeded",
      payment: { id: paymentId, amount: over.amount ?? 500_00, currency: over.currency ?? "RUB" },
    });
  const webhook = (body: string, signature = signBody(secret(), body)) =>
    http().post("/api/payments/webhook").set("Content-Type", "application/json").set("X-Signature", signature).send(body);
  const status = async (id: string) => (await t.prisma.order.findUniqueOrThrow({ where: { id } })).status;

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

  describe("ссылка на оплату", () => {
    it("переводит заказ в pending, повторный вызов отдает ту же ссылку", async () => {
      const order = await newOrder();
      const first = await pay(order.id);
      expect(first.status).toBe(200);
      expect(first.body.order.status).toBe("pending");
      expect(first.body.paymentUrl).toMatch(/^\/api\/payments\/fake\/[0-9a-f-]{36}$/);
      const second = await pay(order.id);
      expect(second.body.paymentUrl).toBe(first.body.paymentUrl);
      expect(await t.prisma.orderStatusHistory.count({ where: { orderId: order.id, toStatus: "pending" } })).toBe(1);
    });

    it("отмененный или истекший заказ не оплатить - 409; чужой - 404", async () => {
      const canceled = await newOrder();
      await http().post(`/api/orders/${canceled.id}/cancel`).set("Cookie", cookie);
      expect((await pay(canceled.id)).status).toBe(409);

      const late = await newOrder();
      await t.prisma.order.update({ where: { id: late.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await pay(late.id);
      expect(res.status).toBe(409);
      expect(res.body.status).toBe("expired");
      expect(await status(late.id)).toBe("expired");

      const other = await loginAs(t.prisma, "bob@mail.ru");
      expect((await pay((await newOrder()).id, other.cookie)).status).toBe(404);
    });
  });

  describe("уведомление об оплате", () => {
    it("верная подпись, сумма и валюта - заказ оплачен, в истории причина", async () => {
      const order = await paidOrder();
      const res = await webhook(event(order.paymentId));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, result: "applied" });
      expect(await status(order.id)).toBe("paid");
      const last = await t.prisma.orderStatusHistory.findFirst({ where: { orderId: order.id }, orderBy: { id: "desc" } });
      expect(last).toMatchObject({ fromStatus: "pending", toStatus: "paid", reason: "оплата подтверждена платежной системой" });
    });

    it("без подписи или с неверной подписью - 401, заказ не меняется, событие не сохраняется", async () => {
      const order = await paidOrder();
      const body = event(order.paymentId);
      expect((await webhook(body, "")).status).toBe(401);
      expect((await webhook(body, "0".repeat(64))).status).toBe(401);
      expect((await webhook(body, signBody("другой-секрет-другой-секрет-другой", body))).status).toBe(401);
      // подпись от другого тела: сумма подменена после подписи
      expect((await webhook(event(order.paymentId, { amount: 1 }), signBody(secret(), body))).status).toBe(401);
      expect(await status(order.id)).toBe("pending");
      expect(await t.prisma.paymentEvent.count()).toBe(0);
    });

    it("10 одновременных повторов одного уведомления - одно зачисление", async () => {
      const order = await paidOrder();
      const body = event(order.paymentId);
      const results = await Promise.all(Array.from({ length: 10 }, () => webhook(body)));
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(results.filter((r) => r.body.result === "applied")).toHaveLength(1);
      expect(results.filter((r) => r.body.result === "duplicate")).toHaveLength(9);
      expect(await t.prisma.paymentEvent.count()).toBe(1);
      expect(await t.prisma.orderStatusHistory.count({ where: { orderId: order.id, toStatus: "paid" } })).toBe(1);
    });

    it("разные уведомления об одном платеже - заказ оплачивается один раз", async () => {
      const order = await paidOrder();
      expect((await webhook(event(order.paymentId))).body.result).toBe("applied");
      expect((await webhook(event(order.paymentId))).body.result).toBe("already_paid");
      expect(await t.prisma.orderStatusHistory.count({ where: { orderId: order.id, toStatus: "paid" } })).toBe(1);
    });

    it("сумма или валюта не совпадают с заказом - не оплачен, событие помечено", async () => {
      const order = await paidOrder();
      expect((await webhook(event(order.paymentId, { amount: 499_99 }))).body.result).toBe("amount_mismatch");
      expect((await webhook(event(order.paymentId, { currency: "USD" }))).body.result).toBe("amount_mismatch");
      expect(await status(order.id)).toBe("pending");
      expect(await t.prisma.paymentEvent.count({ where: { result: "amount_mismatch" } })).toBe(2);
    });

    it("неизвестный платеж - 200 unknown_payment (платежка не будет слать повторы)", async () => {
      const res = await webhook(event(randomUUID()));
      expect(res.status).toBe(200);
      expect(res.body.result).toBe("unknown_payment");
    });

    it("оплата после отмены заказа не проводится - late", async () => {
      const order = await paidOrder();
      await http().post(`/api/orders/${order.id}/cancel`).set("Cookie", cookie);
      expect((await webhook(event(order.paymentId))).body.result).toBe("late");
      expect(await status(order.id)).toBe("canceled");
    });

    it("платеж отменен в платежной системе - заказ отменен", async () => {
      const order = await paidOrder();
      expect((await webhook(event(order.paymentId, { type: "payment.canceled" }))).body.result).toBe("applied");
      expect(await status(order.id)).toBe("canceled");
    });

    it("кривое тело с верной подписью - 400", async () => {
      expect((await webhook('{"id":1}')).status).toBe(400);
      expect((await webhook("не json")).status).toBe(400);
    });
  });

  describe("тестовая платежка", () => {
    it("страница оплаты и кнопка «Оплатить» проводят заказ через тот же обработчик", async () => {
      const order = await paidOrder();
      const page = await http().get(`/api/payments/fake/${order.paymentId}`);
      expect(page.status).toBe(200);
      expect(page.text).toContain("500");
      const res = await http().post(`/api/payments/fake/${order.paymentId}/succeed`);
      expect(res.body.result).toBe("applied");
      expect(await status(order.id)).toBe("paid");
      expect(await t.prisma.paymentEvent.count({ where: { orderId: order.id } })).toBe(1);
    });
  });
});

describe("payments: тестовая платежка выключена", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startApp({ PAYMENT_FAKE: "false" });
  });
  afterAll(async () => {
    await t.app.close();
  });

  it("страница оплаты недоступна", async () => {
    expect((await request(t.url).get(`/api/payments/fake/${randomUUID()}`)).status).toBe(404);
  });
});
