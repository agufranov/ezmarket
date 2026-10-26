import { resetDb, startApp, type TestApp } from "./helpers";

// Правила статусов на уровне базы: триггеры из миграции 20261026090000_orders
describe("orders: база", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  const newOrder = async () => {
    const user = await t.prisma.user.create({ data: { email: "alex@mail.ru" } });
    return t.prisma.order.create({
      data: {
        userId: user.id,
        idempotencyKey: "k1",
        steamLogin: "gaben",
        amount: 50000,
        currency: "RUB",
        payAmount: 50000,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  };
  const history = (orderId: string) =>
    t.prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { id: "asc" }, select: { fromStatus: true, toStatus: true, reason: true } });

  it("создание и каждая смена статуса пишутся в историю вместе с причиной", async () => {
    const order = await newOrder();
    await t.prisma.$transaction([
      t.prisma.$executeRaw`SELECT set_config('ezmarket.status_reason', 'платеж создан', true)`,
      t.prisma.order.update({ where: { id: order.id }, data: { status: "pending" } }),
    ]);
    await t.prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });

    expect(await history(order.id)).toEqual([
      { fromStatus: null, toStatus: "created", reason: null },
      { fromStatus: "created", toStatus: "pending", reason: "платеж создан" },
      { fromStatus: "pending", toStatus: "paid", reason: null },
    ]);
  });

  it("запрещенный переход отклоняет база, история не меняется", async () => {
    const order = await newOrder();
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { status: "completed" } })).rejects.toThrow(/not allowed/);
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("created");
    expect(await history(order.id)).toHaveLength(1);
  });

  it("из конечного статуса выхода нет", async () => {
    const order = await newOrder();
    await t.prisma.order.update({ where: { id: order.id }, data: { status: "canceled" } });
    for (const status of ["created", "pending", "paid", "expired"] as const) {
      await expect(t.prisma.order.update({ where: { id: order.id }, data: { status } })).rejects.toThrow(/not allowed/);
    }
  });

  it("сумма - целое положительное, валюта из списка, к оплате не больше суммы", async () => {
    const order = await newOrder();
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { amount: 0 } })).rejects.toThrow(/orders_amount_positive/);
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { payAmount: 50001 } })).rejects.toThrow(/orders_pay_amount_range/);
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { currency: "EUR" } })).rejects.toThrow(/orders_currency_known/);
  });
});
