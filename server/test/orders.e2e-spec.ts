import request from "supertest";
import { loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Заказ пополнения Steam: создание, повтор, доступ (критерии «Заказ Steam» из плана недели)
describe("orders", () => {
  let t: TestApp;
  let cookie: string;
  const http = () => request(t.url);
  const body = { steamLogin: "gaben", amount: 500_00, currency: "RUB" };

  const create = (data: object = body, key = "key-0000001", c = cookie) =>
    http().post("/api/orders").set("Cookie", c).set("Idempotency-Key", key).send(data);

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

  it("новый заказ - статус created, сумма в копейках целым числом, истекает через 30 минут", async () => {
    const before = Date.now();
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ steamLogin: "gaben", amount: 50000, currency: "RUB", payAmount: 50000, status: "created" });
    const ttl = new Date(res.body.order.expiresAt).getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000 + 5000);

    const [row] = await t.prisma.$queryRaw<{ t: string }[]>`SELECT pg_typeof("amount")::text AS t FROM "orders"`;
    expect(row.t).toBe("integer");
  });

  it("повторный запрос с тем же ключом не создает второй заказ", async () => {
    const first = await create();
    const second = await create();
    expect(second.status).toBe(200);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(await t.prisma.order.count()).toBe(1);
  });

  it("10 одновременных запросов с одним ключом - ровно один заказ", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => create()));
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.order.id)).size).toBe(1);
    expect(await t.prisma.order.count()).toBe(1);
  });

  it("тот же ключ с другими данными - 409, новый ключ - новый заказ", async () => {
    await create();
    expect((await create({ ...body, amount: 600_00 })).status).toBe(409);
    expect((await create(body, "key-0000002")).status).toBe(201);
    expect(await t.prisma.order.count()).toBe(2);
  });

  it("одинаковый ключ у разных пользователей - разные заказы", async () => {
    const other = await loginAs(t.prisma, "bob@mail.ru");
    const a = await create();
    const b = await create(body, "key-0000001", other.cookie);
    expect(b.status).toBe(201);
    expect(b.body.order.id).not.toBe(a.body.order.id);
  });

  it("проверка полей: логин, сумма от 100 до 50 000, валюта, ключ повтора", async () => {
    const cases: [object, string][] = [
      [{ ...body, steamLogin: "" }, "steamLogin"],
      [{ ...body, steamLogin: "не латиница" }, "steamLogin"],
      [{ ...body, amount: 99_99 }, "amount"],
      [{ ...body, amount: 50_000_01 }, "amount"],
      [{ ...body, amount: 500.5 }, "amount"],
      [{ ...body, amount: "500" }, "amount"],
      [{ ...body, currency: "EUR" }, "currency"],
    ];
    for (const [data, field] of cases) {
      const res = await create(data);
      expect(res.status).toBe(422);
      expect(res.body.field).toBe(field);
    }
    const noKey = await http().post("/api/orders").set("Cookie", cookie).send(body);
    expect(noKey.status).toBe(422);
    expect(noKey.body.error).toMatch(/Idempotency-Key/);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it("без сессии - 401", async () => {
    expect((await http().post("/api/orders").set("Idempotency-Key", "key-0000001").send(body)).status).toBe(401);
    expect((await http().get("/api/orders")).status).toBe(401);
  });

  it("свои заказы - списком, новые сверху; заказ с историей статусов", async () => {
    const a = await create(body, "key-0000001");
    const b = await create({ ...body, amount: 700_00 }, "key-0000002");
    const list = await http().get("/api/orders").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.orders.map((o: { id: string }) => o.id)).toEqual([b.body.order.id, a.body.order.id]);

    const one = await http().get(`/api/orders/${a.body.order.id}`).set("Cookie", cookie);
    expect(one.status).toBe(200);
    expect(one.body.order.history).toEqual([expect.objectContaining({ from: null, to: "created" })]);
  });

  it("чужие заказы недоступны: не видны в списке, по id - 404", async () => {
    const mine = await create();
    const other = await loginAs(t.prisma, "bob@mail.ru");
    const list = await http().get("/api/orders").set("Cookie", other.cookie);
    expect(list.body.orders).toEqual([]);
    expect((await http().get(`/api/orders/${mine.body.order.id}`).set("Cookie", other.cookie)).status).toBe(404);
    expect((await http().get("/api/orders/not-a-uuid").set("Cookie", other.cookie)).status).toBe(404);
  });
  describe("отмена", () => {
    const cancel = (id: string, c = cookie) => http().post(`/api/orders/${id}/cancel`).set("Cookie", c);

    it("неоплаченный заказ отменяется, в истории - причина", async () => {
      const { body: b } = await create();
      const res = await cancel(b.order.id);
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("canceled");
      expect(res.body.order.history.at(-1)).toMatchObject({ from: "created", to: "canceled", reason: "отменен пользователем" });
    });

    it("10 одновременных отмен - один переход в истории, все ответы 200", async () => {
      const { body: b } = await create();
      const results = await Promise.all(Array.from({ length: 10 }, () => cancel(b.order.id)));
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(await t.prisma.orderStatusHistory.count({ where: { orderId: b.order.id, toStatus: "canceled" } })).toBe(1);
    });

    it("оплаченный заказ отменить нельзя - 409 со статусом", async () => {
      const { body: b } = await create();
      await t.prisma.order.update({ where: { id: b.order.id }, data: { status: "pending" } });
      await t.prisma.order.update({ where: { id: b.order.id }, data: { status: "paid" } });
      const res = await cancel(b.order.id);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ status: "paid" });
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("paid");
    });

    it("чужой заказ отменить нельзя - 404", async () => {
      const { body: b } = await create();
      const other = await loginAs(t.prisma, "bob@mail.ru");
      expect((await cancel(b.order.id, other.cookie)).status).toBe(404);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("created");
    });
  });
});

describe("orders: лимиты", () => {
  let t: TestApp;
  afterEach(async () => {
    await t.app.close();
  });

  it("по умолчанию минимум 100, лимиты доступны без входа", async () => {
    t = await startApp();
    const res = await request(t.url).get("/api/orders/limits");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      minAmount: 100_00,
      maxAmount: 50_000_00,
      currencies: ["RUB", "USD", "KZT"],
      bonus: { currency: "RUB", maxPercent: 30, cashbackPercent: 5, signup: 100 },
    });
  });

  it("ORDER_MIN_AMOUNT снижает минимум и для проверки, и в лимитах", async () => {
    t = await startApp({ ORDER_MIN_AMOUNT: "100" });
    await resetDb(t.prisma);
    const { cookie } = await loginAs(t.prisma, "alex@mail.ru");
    expect((await request(t.url).get("/api/orders/limits")).body.minAmount).toBe(100);
    const send = (amount: number) =>
      request(t.url).post("/api/orders").set("Cookie", cookie).set("Idempotency-Key", `key-${amount}-0000`).send({ steamLogin: "gaben", amount, currency: "USD" });
    expect((await send(100)).status).toBe(201);
    const low = await send(99);
    expect(low.status).toBe(422);
    expect(low.body).toMatchObject({ field: "amount", error: "Минимум 1" });
  });
});
