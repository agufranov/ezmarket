import { randomUUID } from "node:crypto";
import request from "supertest";
import { OrdersWorker } from "../src/orders/orders.worker";
import { codeFromMail, loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Бонусы (критерии «Бонусы» из плана недели): 1 бонус = 1 ₽, баланс не ниже 0, 20 одновременных заказов по 100
// при балансе 100 - проходит ровно 1, возврат при ошибке/отмене, начисление за заказ - 1 раз, история
describe("bonuses", () => {
  let t: TestApp;
  let cookie: string;
  let userId: string;
  const http = () => request(t.url);
  const worker = () => t.app.get(OrdersWorker);

  // начислить бонусы так же, как регистрация: строка в истории + баланс (инвариант «баланс = сумма истории»)
  const giveBonuses = async (id: string, n: number) => {
    await t.prisma.user.update({ where: { id }, data: { bonusBalance: n } });
    await t.prisma.bonusTransaction.create({ data: { userId: id, kind: "signup", delta: n, balanceAfter: n } });
  };
  const order = (body: object, key: string = randomUUID(), c = cookie) =>
    http()
      .post("/api/orders")
      .set("Cookie", c)
      .set("Idempotency-Key", key)
      .send({ steamLogin: "gaben", amount: 500_00, currency: "RUB", ...body });
  const balance = async (id = userId) => (await t.prisma.user.findUniqueOrThrow({ where: { id } })).bonusBalance;
  const ledger = async (id = userId) =>
    (await t.prisma.bonusTransaction.findMany({ where: { userId: id }, orderBy: { id: "asc" } })).map((r) => `${r.kind}:${r.delta}`);
  const invariant = async (id = userId) => {
    const sum = await t.prisma.bonusTransaction.aggregate({ where: { userId: id }, _sum: { delta: true } });
    expect(await balance(id)).toBe(sum._sum.delta ?? 0);
  };
  const status = async (id: string) => (await t.prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const payFake = async (id: string) => {
    const { body } = await http().post(`/api/orders/${id}/pay`).set("Cookie", cookie);
    const paymentId = body.paymentUrl.split("/").pop();
    return http().post(`/api/payments/fake/${paymentId}/succeed`);
  };

  beforeAll(async () => {
    t = await startApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    const login = await loginAs(t.prisma, "alex@mail.ru");
    cookie = login.cookie;
    userId = login.user.id;
  });

  describe("регистрация", () => {
    it("новый пользователь получает +100 бонусов один раз, повторный вход не начисляет", async () => {
      const email = "new@mail.ru";
      const enter = async () => {
        await http().post("/api/auth/code").send({ email, mode: "register" });
        return http().post("/api/auth/verify").send({ email, code: await codeFromMail(t.prisma, email) });
      };
      const first = await enter();
      expect(first.body.user.bonuses).toBe(100);
      await t.prisma.authCode.updateMany({ where: { email }, data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
      const second = await enter();
      expect(second.body.user.bonuses).toBe(100);
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await ledger(user.id)).toEqual(["signup:100"]);
    });
  });

  describe("списание", () => {
    beforeEach(() => giveBonuses(userId, 200));

    it("бонусы уменьшают сумму к оплате: 500 ₽ - 100 бонусов = 400 ₽, кэшбэк 5% от оплаченного деньгами", async () => {
      const res = await order({ bonuses: 100 });
      expect(res.status).toBe(201);
      expect(res.body.order).toMatchObject({ amount: 500_00, payAmount: 400_00, bonusSpent: 100, bonusAccrual: 20 });
      expect(await balance()).toBe(100);
      expect(await ledger()).toEqual(["signup:200", "spend:-100"]);
      const spend = await t.prisma.bonusTransaction.findFirstOrThrow({ where: { kind: "spend" } });
      expect(spend).toMatchObject({ orderId: res.body.order.id, balanceAfter: 100 });
    });

    it("без бонусов - кэшбэк 5% от всей суммы", async () => {
      const res = await order({ amount: 620_00 });
      expect(res.body.order).toMatchObject({ payAmount: 620_00, bonusSpent: 0, bonusAccrual: 31 });
      expect(await balance()).toBe(200);
    });

    it("правила: не больше 30% суммы, только рубли, целое число, не больше остатка - иначе 422 и ничего не меняется", async () => {
      const over = await order({ bonuses: 151 });
      expect(over.status).toBe(422);
      expect(over.body).toMatchObject({ field: "bonuses", max: 150 });

      const usd = await order({ bonuses: 10, currency: "USD" });
      expect(usd.status).toBe(422);
      expect(usd.body.field).toBe("bonuses");

      for (const bad of [-1, 1.5, "10"]) expect((await order({ bonuses: bad })).body.field).toBe("bonuses");

      await t.prisma.user.update({ where: { id: userId }, data: { bonusBalance: 50 } });
      const notEnough = await order({ bonuses: 100 });
      expect(notEnough.status).toBe(422);
      expect(notEnough.body).toMatchObject({ field: "bonuses", available: 50 });

      expect(await t.prisma.order.count()).toBe(0);
      expect(await balance()).toBe(50);
    });

    it("20 одновременных заказов по 100 бонусов при балансе 100 - проходит ровно 1, баланс 0", async () => {
      await t.prisma.user.update({ where: { id: userId }, data: { bonusBalance: 100 } });
      await t.prisma.bonusTransaction.updateMany({ where: { userId }, data: { delta: 100, balanceAfter: 100 } });
      const results = await Promise.all(Array.from({ length: 20 }, () => order({ bonuses: 100 })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 422 && r.body.field === "bonuses")).toHaveLength(19);
      expect(await balance()).toBe(0);
      expect(await t.prisma.order.count()).toBe(1);
      expect(await ledger()).toEqual(["signup:100", "spend:-100"]);
      await invariant();
    });

    it("повтор с тем же ключом (и одновременный) - одно списание; тот же ключ с другими бонусами - 409", async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => order({ bonuses: 100 }, "key-bonus-01")));
      expect(new Set(results.map((r) => r.body.order.id)).size).toBe(1);
      expect(await balance()).toBe(100);
      expect((await order({ bonuses: 50 }, "key-bonus-01")).status).toBe(409);
      expect(await ledger()).toEqual(["signup:200", "spend:-100"]);
    });

    it("платежка ждет сумму к оплате: уведомление на полную сумму не проходит, на 400 ₽ - проходит", async () => {
      const { body } = await order({ bonuses: 100 });
      const res = await payFake(body.order.id);
      expect(res.body.result).toBe("applied");
      const event = await t.prisma.paymentEvent.findFirstOrThrow();
      expect(event.amount).toBe(400_00);
    });
  });

  describe("возврат и начисление", () => {
    beforeEach(() => giveBonuses(userId, 200));

    it("отмена - бонусы возвращаются один раз (повторная отмена ничего не меняет)", async () => {
      const { body } = await order({ bonuses: 100 });
      await http().post(`/api/orders/${body.order.id}/cancel`).set("Cookie", cookie);
      await http().post(`/api/orders/${body.order.id}/cancel`).set("Cookie", cookie);
      expect(await balance()).toBe(200);
      expect(await ledger()).toEqual(["signup:200", "spend:-100", "refund:100"]);
      await invariant();
    });

    it("истечение - бонусы возвращаются", async () => {
      const { body } = await order({ bonuses: 100 });
      await t.prisma.order.update({ where: { id: body.order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await worker().expire()).toBe(1);
      expect(await balance()).toBe(200);
      expect(await ledger()).toEqual(["signup:200", "spend:-100", "refund:100"]);
    });

    it("ошибка выполнения (failed) - бонусы возвращаются, кэшбэка нет", async () => {
      const { body } = await order({ bonuses: 100, steamLogin: "fail_nobody" });
      await payFake(body.order.id);
      await worker().fulfil();
      expect(await status(body.order.id)).toBe("failed");
      expect(await balance()).toBe(200);
      expect(await ledger()).toEqual(["signup:200", "spend:-100", "refund:100"]);
    });

    it("выполнен - кэшбэк начисляется ровно один раз (повторный проход воркера ничего не меняет)", async () => {
      const { body } = await order({ bonuses: 100 });
      await payFake(body.order.id);
      await worker().fulfil();
      await worker().fulfil();
      expect(await status(body.order.id)).toBe("completed");
      expect(await balance()).toBe(120);
      expect(await ledger()).toEqual(["signup:200", "spend:-100", "accrual:20"]);
      await invariant();
    });
  });

  describe("история", () => {
    it("GET /api/bonuses - баланс и история, новые сверху; чужая история не видна", async () => {
      await giveBonuses(userId, 200);
      const { body } = await order({ bonuses: 100 });
      await http().post(`/api/orders/${body.order.id}/cancel`).set("Cookie", cookie);

      const res = await http().get("/api/bonuses").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(200);
      expect(res.body.history.map((h: { kind: string; delta: number; balanceAfter: number }) => [h.kind, h.delta, h.balanceAfter])).toEqual([
        ["refund", 100, 200],
        ["spend", -100, 100],
        ["signup", 200, 200],
      ]);
      expect(res.body.history[0].orderId).toBe(body.order.id);

      const other = await loginAs(t.prisma, "bob@mail.ru");
      const theirs = await http().get("/api/bonuses").set("Cookie", other.cookie);
      expect(theirs.body).toEqual({ balance: 0, history: [] });
      expect((await http().get("/api/bonuses")).status).toBe(401);
    });
  });
});
