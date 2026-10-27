import { resetDb, startApp, type TestApp } from "./helpers";

// Бонусы на уровне базы: триггер возврата и кэшбэка, ограничения (миграция 20261027090000_bonuses)
describe("bonuses: база", () => {
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

  // заказ 500 ₽ с уже списанными 100 бонусами (как делает сервис): баланс 200 -> 100
  const orderWithBonuses = async (opts: { spent?: number; accrual?: number } = {}) => {
    const spent = opts.spent ?? 100;
    const user = await t.prisma.user.create({ data: { email: "alex@mail.ru", bonusBalance: 200 - spent } });
    const order = await t.prisma.order.create({
      data: {
        userId: user.id,
        idempotencyKey: "k1",
        steamLogin: "gaben",
        amount: 500_00,
        currency: "RUB",
        bonusSpent: spent,
        bonusAccrual: opts.accrual ?? 20,
        payAmount: 500_00 - spent * 100,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return { user, order };
  };
  const balance = async (userId: string) => (await t.prisma.user.findUniqueOrThrow({ where: { id: userId } })).bonusBalance;
  const ledger = (userId: string) =>
    t.prisma.bonusTransaction.findMany({ where: { userId }, orderBy: { id: "asc" }, select: { kind: true, delta: true, balanceAfter: true } });
  const move = async (id: string, ...statuses: ("pending" | "paid" | "processing" | "completed" | "failed" | "canceled" | "expired")[]) => {
    for (const status of statuses) await t.prisma.order.update({ where: { id }, data: { status } });
  };

  for (const final of ["canceled", "expired"] as const) {
    it(`${final}: списанные бонусы возвращаются один раз, в истории refund с балансом после`, async () => {
      const { user, order } = await orderWithBonuses();
      await move(order.id, "pending", final);
      expect(await balance(user.id)).toBe(200);
      expect(await ledger(user.id)).toEqual([{ kind: "refund", delta: 100, balanceAfter: 200 }]);
    });
  }

  it("failed (ошибка выполнения): бонусы возвращаются, кэшбэка нет", async () => {
    const { user, order } = await orderWithBonuses();
    await move(order.id, "pending", "paid", "processing", "failed");
    expect(await balance(user.id)).toBe(200);
    expect((await ledger(user.id)).map((r) => r.kind)).toEqual(["refund"]);
  });

  it("completed: кэшбэк начисляется один раз, списанное не возвращается", async () => {
    const { user, order } = await orderWithBonuses({ accrual: 20 });
    await move(order.id, "pending", "paid", "processing", "completed");
    expect(await balance(user.id)).toBe(120);
    expect(await ledger(user.id)).toEqual([{ kind: "accrual", delta: 20, balanceAfter: 120 }]);
  });

  it("повторная запись возврата по тому же заказу не проходит - уникальный ключ (заказ, вид)", async () => {
    const { user, order } = await orderWithBonuses();
    await move(order.id, "canceled");
    await expect(
      t.prisma.bonusTransaction.create({ data: { userId: user.id, orderId: order.id, kind: "refund", delta: 100, balanceAfter: 300 } }),
    ).rejects.toThrow(/Unique constraint/);
    expect(await balance(user.id)).toBe(200);
  });

  it("заказ без бонусов и без кэшбэка - история не меняется", async () => {
    const { user, order } = await orderWithBonuses({ spent: 0, accrual: 0 });
    await move(order.id, "canceled");
    expect(await ledger(user.id)).toEqual([]);
  });

  it("ограничения: не больше 30% суммы, только рубли, к оплате = сумма - бонусы, баланс не ниже нуля", async () => {
    const { user, order } = await orderWithBonuses();
    // 151 ₽ бонусами из 500 ₽ - больше 30%
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { bonusSpent: 151, payAmount: 500_00 - 151_00 } })).rejects.toThrow(
      /orders_bonus_spent_range/,
    );
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { currency: "USD" } })).rejects.toThrow(/orders_bonus_rub_only/);
    await expect(t.prisma.order.update({ where: { id: order.id }, data: { payAmount: 500_00 } })).rejects.toThrow(/orders_pay_amount_formula/);
    await expect(t.prisma.user.update({ where: { id: user.id }, data: { bonusBalance: -1 } })).rejects.toThrow(/bonus_balance/);
    await expect(
      t.prisma.bonusTransaction.create({ data: { userId: user.id, kind: "accrual", delta: -5, balanceAfter: 95 } }),
    ).rejects.toThrow(/bonus_transactions_delta_sign/);
  });

  it("бонус за регистрацию - один раз на пользователя", async () => {
    const user = await t.prisma.user.create({ data: { email: "bob@mail.ru" } });
    await t.prisma.bonusTransaction.create({ data: { userId: user.id, kind: "signup", delta: 100, balanceAfter: 100 } });
    await expect(t.prisma.bonusTransaction.create({ data: { userId: user.id, kind: "signup", delta: 100, balanceAfter: 200 } })).rejects.toThrow(
      /Unique constraint/,
    );
  });

  it("время в истории бонусов от триггера - в UTC при любом часовом поясе базы", async () => {
    const { user, order } = await orderWithBonuses();
    await move(order.id, "canceled");
    const [row] = await t.prisma.bonusTransaction.findMany({ where: { userId: user.id } });
    expect(Math.abs(row.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
  });
});
