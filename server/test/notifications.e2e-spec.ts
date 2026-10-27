import { randomUUID } from "node:crypto";
import request from "supertest";
import { OrdersWorker } from "../src/orders/orders.worker";
import { loginAs, mail, resetDb, startApp, type TestApp } from "./helpers";

// Уведомления (критерии «Уведомления» из плана недели): на каждую смену статуса заказа и на бонусы;
// список, отметка о прочтении и счетчик непрочитанных; сбой почты не ломает заказ
describe("notifications", () => {
  let t: TestApp;
  let cookie: string;
  let userId: string;
  const http = () => request(t.url);
  const worker = () => t.app.get(OrdersWorker);

  type Item = { id: string; type: string; text: { t: string; b?: boolean }[]; icon: string; orderId: string | null; read: boolean; at: string };
  // пробелы в суммах - неразрывные (Intl), в проверках - обычные
  const flat = (s: string) => s.replace(/\s/g, " ");
  const plain = (n: Item) => flat(n.text.map((p) => p.t).join(""));
  const list = async (c = cookie) => (await http().get("/api/notifications").set("Cookie", c)).body as { unread: number; items: Item[] };
  const texts = async (c = cookie) => (await list(c)).items.map(plain);

  // начислить бонусы, как при регистрации: строка истории + баланс
  const giveBonuses = async (id: string, n: number) => {
    await t.prisma.user.update({ where: { id }, data: { bonusBalance: n } });
    await t.prisma.bonusTransaction.create({ data: { userId: id, kind: "signup", delta: n, balanceAfter: n } });
  };
  const order = async (body: object = {}) => {
    const res = await http()
      .post("/api/orders")
      .set("Cookie", cookie)
      .set("Idempotency-Key", randomUUID())
      .send({ steamLogin: "gaben", amount: 500_00, currency: "RUB", ...body });
    expect(res.status).toBe(201);
    return res.body.order as { id: string };
  };
  // счет в тестовой платежке (заказ -> pending), в ответ - id платежа
  const pay = async (id: string) => {
    const { body } = await http().post(`/api/orders/${id}/pay`).set("Cookie", cookie);
    return body.paymentUrl.split("/").pop() as string;
  };
  const succeed = (paymentId: string) => http().post(`/api/payments/fake/${paymentId}/succeed`);
  const status = async (id: string) => (await t.prisma.order.findUniqueOrThrow({ where: { id } })).status;

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

  it("на каждую смену статуса заказа и на каждое движение бонусов - одно уведомление, о создании заказа - нет", async () => {
    await giveBonuses(userId, 200);
    const o = await order({ bonuses: 100 });
    expect(await texts()).toEqual(["Списано 100 бонусов в оплату заказа", "Начислено +200 бонусов за регистрацию"]);

    await succeed(await pay(o.id));
    await worker().fulfil();
    expect(await status(o.id)).toBe("completed");

    const { unread, items } = await list();
    expect(items.map(plain)).toEqual([
      "Steam пополнен на 500 ₽",
      "Начислено +20 бонусов за покупку",
      "Пополняем Steam на 500 ₽",
      "Оплата получена - пополняем Steam на 500 ₽",
      "Заказ на 500 ₽ ждет оплаты",
      "Списано 100 бонусов в оплату заказа",
      "Начислено +200 бонусов за регистрацию",
    ]);
    expect(unread).toBe(7);
    // как в макете: жирное - сумма и бонусы; значок Steam или монета; ссылка на заказ
    expect(items[0]).toMatchObject({ type: "order", icon: "steam", orderId: o.id, read: false });
    expect(items[0].text).toEqual([{ t: "Steam пополнен на " }, { t: expect.stringMatching(/^500\s₽$/), b: true }]);
    expect(items[1]).toMatchObject({ type: "bonus", icon: "coin", orderId: o.id });
    expect(items[6]).toMatchObject({ type: "bonus", orderId: null });
    // новые сверху
    const ids = items.map((n) => BigInt(n.id));
    expect([...ids].sort((a, b) => (a > b ? -1 : 1))).toEqual(ids);
  });

  it("повторы не дают дублей: 10 уведомлений платежки об оплате и повторный проход воркера", async () => {
    const o = await order();
    const paymentId = await pay(o.id);
    await Promise.all(Array.from({ length: 10 }, () => succeed(paymentId)));
    await worker().fulfil();
    await worker().fulfil();
    expect(await texts()).toEqual([
      "Steam пополнен на 500 ₽",
      "Начислено +25 бонусов за покупку",
      "Пополняем Steam на 500 ₽",
      "Оплата получена - пополняем Steam на 500 ₽",
      "Заказ на 500 ₽ ждет оплаты",
    ]);
  });

  it("отмена, истечение, ошибка выполнения: уведомление о статусе и о возврате бонусов; письмо - только об итоге оплаченного", async () => {
    await giveBonuses(userId, 300);
    const canceled = await order({ bonuses: 100 });
    await http().post(`/api/orders/${canceled.id}/cancel`).set("Cookie", cookie);

    const expired = await order({ bonuses: 100 });
    await t.prisma.order.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await worker().expire()).toBe(1);

    const failed = await order({ bonuses: 100, steamLogin: "fail_nobody" });
    await succeed(await pay(failed.id));
    await worker().fulfil();
    expect(await status(failed.id)).toBe("failed");

    const { items } = await list();
    const of = (id: string) => items.filter((n) => n.orderId === id).map(plain);
    const refund = "Вернули 100 бонусов - заказ не выполнен";
    const spend = "Списано 100 бонусов в оплату заказа";
    expect(of(canceled.id)).toEqual(["Заказ на 500 ₽ отменен", refund, spend]);
    expect(of(expired.id)).toEqual(["Заказ на 500 ₽ не оплачен за 30 минут и закрыт", refund, spend]);
    expect(of(failed.id)).toEqual([
      "Не удалось пополнить Steam на 500 ₽",
      refund,
      "Пополняем Steam на 500 ₽",
      "Оплата получена - пополняем Steam на 500 ₽",
      "Заказ на 500 ₽ ждет оплаты",
      spend,
    ]);

    const mails = await t.prisma.emailOutbox.findMany({ where: { to: "alex@mail.ru" } });
    expect(mails.map((m) => flat(m.subject))).toEqual(["Не удалось пополнить Steam на 500 ₽ - EzMarket"]);
    expect(flat(mails[0].text)).toContain(refund);
  });

  it("сбой почты не ломает заказ: заказ выполнен, уведомления на месте, письмо в очереди с ошибкой - одно", async () => {
    const o = await order();
    await succeed(await pay(o.id));
    await worker().fulfil();
    expect(await status(o.id)).toBe("completed");

    // SMTP в тестах - закрытый порт: отправка падает
    expect(await mail(t.app).flush()).toBe(0);
    await worker().fulfil();
    expect(await status(o.id)).toBe("completed");
    expect((await texts())[0]).toBe("Steam пополнен на 500 ₽");

    const mails = await t.prisma.emailOutbox.findMany({ where: { to: "alex@mail.ru" } });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ sentAt: null, attempts: 1 });
    expect(mails[0].error).toBeTruthy();
    expect(flat(mails[0].subject)).toBe("Steam пополнен на 500 ₽ - EzMarket");
    expect(flat(mails[0].text)).toContain("Начислено +25 бонусов за покупку");
  });

  it("смена статуса мимо сервиса (ручной SQL) - тоже уведомление: его пишет база", async () => {
    const o = await order();
    await t.prisma.$executeRaw`UPDATE "orders" SET "status" = 'canceled' WHERE "id" = ${o.id}`;
    expect(await texts()).toEqual(["Заказ на 500 ₽ отменен"]);
  });

  it("список свой; отметка о прочтении - выбранных и всех, чужие не отметить; счетчик непрочитанных", async () => {
    await giveBonuses(userId, 200);
    const o = await order({ bonuses: 50 });
    await http().post(`/api/orders/${o.id}/cancel`).set("Cookie", cookie);
    const mine = await list();
    expect(mine.unread).toBe(4);

    const other = await loginAs(t.prisma, "bob@mail.ru");
    expect(await list(other.cookie)).toEqual({ unread: 0, items: [] });
    const foreign = await http().post("/api/notifications/read").set("Cookie", other.cookie).send({ ids: mine.items.map((n) => n.id) });
    expect(foreign.status).toBe(200);
    expect(foreign.body).toEqual({ unread: 0 });
    expect((await list()).unread).toBe(4);

    const markOne = () => http().post("/api/notifications/read").set("Cookie", cookie).send({ ids: [mine.items[0].id] });
    expect((await markOne()).body).toEqual({ unread: 3 });
    expect((await markOne()).body).toEqual({ unread: 3 });
    expect((await list()).items.map((n) => n.read)).toEqual([true, false, false, false]);

    const all = await http().post("/api/notifications/read-all").set("Cookie", cookie);
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ unread: 0 });
    expect((await list()).items.every((n) => n.read)).toBe(true);
  });

  it("проверки: неверные id - 422, без входа - 401", async () => {
    for (const body of [{}, { ids: [] }, { ids: ["abc"] }, { ids: [1] }, { ids: "1" }]) {
      const res = await http().post("/api/notifications/read").set("Cookie", cookie).send(body);
      expect(res.status).toBe(422);
      expect(res.body.field).toBe("ids");
    }
    expect((await http().get("/api/notifications")).status).toBe(401);
    expect((await http().post("/api/notifications/read-all")).status).toBe(401);
  });
});
