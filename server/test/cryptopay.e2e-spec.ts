import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cryptoPaySignature } from "../src/payments/cryptopay.client";
import { OrderStatusService } from "../src/orders/order-status.service";
import { OrdersService } from "../src/orders/orders.service";
import { OrdersWorker } from "../src/orders/orders.worker";
import { PaymentsService } from "../src/payments/payments.service";
import { loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Подставной Crypto Pay API: хранит счета в памяти, отвечает в формате { ok, result }
type Invoice = { invoice_id: number; hash: string; status: string; currency_type: string; fiat: string; amount: string; bot_invoice_url: string; payload: string };

function fakeCryptoPay() {
  const invoices = new Map<number, Invoice>();
  const calls: { method: string; token: string | undefined; body: Record<string, unknown> }[] = [];
  let nextId = 1000;
  let down = false;
  // для гонок: задержать ответ на createInvoice, пока тест не отпустит; создать счет сразу оплаченным
  let holdCreate: Promise<void> | null = null;
  let payOnCreate = false;
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const method = req.url!.split("/").pop()!;
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method, token: req.headers["crypto-pay-api-token"] as string | undefined, body });
      const send = (result: unknown) => res.end(JSON.stringify({ ok: true, result }));
      if (down) return res.writeHead(500).end(JSON.stringify({ ok: false, error: { name: "INTERNAL" } }));
      if (method === "createInvoice") {
        if (holdCreate) await holdCreate;
        const id = nextId++;
        const inv = { invoice_id: id, hash: `H${id}`, status: payOnCreate ? "paid" : "active", currency_type: "fiat", fiat: body.fiat, amount: String(Number(body.amount)), bot_invoice_url: `https://t.me/CryptoTestnetBot?start=H${id}`, payload: body.payload };
        invoices.set(id, inv);
        return send(inv);
      }
      if (method === "getInvoices") {
        const ids = String(body.invoice_ids).split(",").map(Number);
        return send({ items: ids.map((i) => invoices.get(i)).filter((i) => i && (!body.status || i.status === body.status)) });
      }
      if (method === "deleteInvoice") return send(invoices.delete(Number(body.invoice_id)));
      res.writeHead(404).end(JSON.stringify({ ok: false, error: { name: "METHOD_NOT_FOUND" } }));
    });
  });
  return {
    server,
    invoices,
    calls,
    setDown: (v: boolean) => (down = v),
    pay: (id: number) => (invoices.get(id)!.status = "paid"),
    // задержать создание счета: возвращает функцию «отпустить»
    holdCreate: () => {
      let release!: () => void;
      holdCreate = new Promise<void>((r) => (release = r));
      return () => {
        holdCreate = null;
        release();
      };
    },
    setPayOnCreate: (v: boolean) => (payOnCreate = v),
  };
}

describe("payments: Crypto Pay", () => {
  const TOKEN = "62370:test-token";
  const cp = fakeCryptoPay();
  let t: TestApp;
  let cookie: string;
  const http = () => request(t.url);

  const newOrder = async (amount = 500_00, currency = "RUB") =>
    (await http().post("/api/orders").set("Cookie", cookie).set("Idempotency-Key", randomUUID()).send({ steamLogin: "gaben", amount, currency })).body.order as { id: string };
  const pay = (id: string) => http().post(`/api/orders/${id}/pay`).set("Cookie", cookie);
  const invoiceOf = async (orderId: string) => cp.invoices.get(Number((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentId))!;
  const status = async (id: string) => (await t.prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const update = (inv: Invoice) => JSON.stringify({ update_id: 1, update_type: "invoice_paid", request_date: new Date().toISOString(), payload: { ...inv, status: "paid" } });
  const webhook = (body: string, signature = cryptoPaySignature(TOKEN, body)) =>
    http().post("/api/payments/cryptopay/webhook").set("Content-Type", "application/json").set("crypto-pay-api-signature", signature).send(body);
  const poll = () => t.app.get(PaymentsService).pollCryptoPay();
  const expireCp = () => t.app.get(PaymentsService).expireCryptoPay();
  const backdate = (id: string) => t.prisma.order.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  // ждать условия (гонки в тестах - управляемые, без sleep наугад)
  const until = async (cond: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 300; i++) {
      if (await cond()) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("условие не наступило");
  };
  // первый переход в expired (его делает фоновая задача) - задержать до release()
  const holdFirstExpire = () => {
    const svc = t.app.get(OrderStatusService);
    const move = svc.move.bind(svc);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let held = false;
    const spy = jest.spyOn(svc, "move").mockImplementation(async (...args) => {
      if (args[2] === "expired" && !held) {
        held = true;
        await gate;
      }
      return move(...args);
    });
    return { release, held: () => held, spy };
  };

  beforeAll(async () => {
    await new Promise<void>((r) => cp.server.listen(0, "127.0.0.1", () => r()));
    const port = (cp.server.address() as AddressInfo).port;
    t = await startApp({
      PAYMENT_PROVIDER: "cryptopay",
      CRYPTOPAY_TOKEN: TOKEN,
      CRYPTOPAY_API_URL: `http://127.0.0.1:${port}/api`,
      SITE_URL: "http://localhost:3010",
    });
  });
  afterAll(async () => {
    await t.app.close();
    await new Promise((r) => cp.server.close(r));
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    ({ cookie } = await loginAs(t.prisma, "alex@mail.ru"));
    cp.invoices.clear();
    cp.calls.length = 0;
    cp.setDown(false);
    cp.setPayOnCreate(false);
    jest.restoreAllMocks();
  });

  it("счет в валюте заказа с токеном в заголовке, ссылка на бота, повтор - тот же счет", async () => {
    const order = await newOrder(1234_50, "USD");
    const res = await pay(order.id);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("pending");
    expect(res.body.paymentUrl).toMatch(/^https:\/\/t\.me\/CryptoTestnetBot\?start=H\d+$/);

    const create = cp.calls.find((c) => c.method === "createInvoice")!;
    expect(create.token).toBe(TOKEN);
    expect(create.body).toMatchObject({ currency_type: "fiat", fiat: "USD", amount: "1234.50", payload: order.id, paid_btn_name: "callback", paid_btn_url: "http://localhost:3010" });
    expect(create.body.expires_in).toBeGreaterThan(29 * 60);

    expect((await pay(order.id)).body.paymentUrl).toBe(res.body.paymentUrl);
    expect(cp.calls.filter((c) => c.method === "createInvoice")).toHaveLength(1);
  });

  it("Crypto Pay недоступен - 502, заказ остается created, повтор потом проходит", async () => {
    const order = await newOrder();
    cp.setDown(true);
    const res = await pay(order.id);
    expect(res.status).toBe(502);
    expect(await status(order.id)).toBe("created");
    cp.setDown(false);
    expect((await pay(order.id)).status).toBe(200);
    expect(await status(order.id)).toBe("pending");
  });

  it("вебхук invoice_paid с верной подписью - заказ оплачен; повтор - одно зачисление", async () => {
    const order = await newOrder();
    await pay(order.id);
    const body = update(await invoiceOf(order.id));
    expect((await webhook(body)).body.result).toBe("applied");
    expect((await webhook(body)).body.result).toBe("duplicate");
    expect(await status(order.id)).toBe("paid");
    expect(await t.prisma.paymentEvent.count()).toBe(1);
  });

  it("вебхук без подписи или подписанный другим токеном - 401, заказ не меняется", async () => {
    const order = await newOrder();
    await pay(order.id);
    const body = update(await invoiceOf(order.id));
    expect((await webhook(body, "")).status).toBe(401);
    expect((await webhook(body, cryptoPaySignature("1:other-token", body))).status).toBe(401);
    expect(await status(order.id)).toBe("pending");
  });

  it("сумма счета не совпадает с заказом - не оплачен", async () => {
    const order = await newOrder();
    await pay(order.id);
    const inv = await invoiceOf(order.id);
    expect((await webhook(update({ ...inv, amount: "1" }))).body.result).toBe("amount_mismatch");
    expect(await status(order.id)).toBe("pending");
  });

  it("опрос: оплаченный в боте счет проводит заказ, повторный опрос ничего не меняет", async () => {
    const order = await newOrder();
    const other = await newOrder(700_00);
    await pay(order.id);
    await pay(other.id);
    cp.pay((await invoiceOf(order.id)).invoice_id);

    expect(await poll()).toBe(1);
    expect(await status(order.id)).toBe("paid");
    expect(await status(other.id)).toBe("pending");
    expect(await poll()).toBe(0);
    expect(await t.prisma.orderStatusHistory.count({ where: { orderId: order.id, toStatus: "paid" } })).toBe(1);
  });

  it("вебхук и опрос по одному счету одновременно - одно зачисление", async () => {
    const order = await newOrder();
    await pay(order.id);
    const inv = await invoiceOf(order.id);
    cp.pay(inv.invoice_id);
    await Promise.all([webhook(update(inv)), poll()]);
    expect(await status(order.id)).toBe("paid");
    expect(await t.prisma.paymentEvent.count()).toBe(1);
  });

  describe("истечение", () => {
    it("общая задача истечения заказ, ждущий оплаты в Crypto Pay, не трогает", async () => {
      const order = await newOrder();
      await pay(order.id);
      await backdate(order.id);
      expect(await t.app.get(OrdersWorker).expire()).toBe(0);
      expect(await status(order.id)).toBe("pending");
    });

    it("счет оплачен в последние секунды - заказ оплачивается, а не истекает", async () => {
      const order = await newOrder();
      await pay(order.id);
      cp.pay((await invoiceOf(order.id)).invoice_id);
      await backdate(order.id);
      expect(await expireCp()).toBe(0);
      expect(await status(order.id)).toBe("paid");
    });

    it("счет не оплачен - сначала удаляется в Crypto Pay, потом заказ истекает", async () => {
      const order = await newOrder();
      await pay(order.id);
      const inv = await invoiceOf(order.id);
      await backdate(order.id);
      expect(await expireCp()).toBe(1);
      expect(cp.invoices.has(inv.invoice_id)).toBe(false);
      expect(await status(order.id)).toBe("expired");
    });

    it("Crypto Pay не отвечает - заказ ждет следующего прохода", async () => {
      const order = await newOrder();
      await pay(order.id);
      await backdate(order.id);
      cp.setDown(true);
      expect(await expireCp()).toBe(0);
      expect(await status(order.id)).toBe("pending");
      cp.setDown(false);
      expect(await expireCp()).toBe(1);
      expect(await status(order.id)).toBe("expired");
    });

    it("повтор /pay после срока: счет уже оплачен - оплата проводится, ответ 409 paid (ревью F1)", async () => {
      const order = await newOrder();
      await pay(order.id);
      cp.pay((await invoiceOf(order.id)).invoice_id);
      await backdate(order.id);
      const res = await pay(order.id);
      expect(res.status).toBe(409);
      expect(res.body.status).toBe("paid");
      expect(await status(order.id)).toBe("paid");
      // вебхук того же счета - уже обработанное событие, а не late
      expect((await webhook(update(await invoiceOf(order.id)))).body.result).toBe("duplicate");
    });

    it("повтор /pay после срока: счет не оплачен - удаляется, заказ истекает", async () => {
      const order = await newOrder();
      await pay(order.id);
      const inv = await invoiceOf(order.id);
      await backdate(order.id);
      const res = await pay(order.id);
      expect(res.status).toBe(409);
      expect(res.body.status).toBe("expired");
      expect(cp.invoices.has(inv.invoice_id)).toBe(false);
    });

    it("повтор /pay после срока, Crypto Pay не отвечает - 502, заказ ждет проверки", async () => {
      const order = await newOrder();
      await pay(order.id);
      await backdate(order.id);
      cp.setDown(true);
      expect((await pay(order.id)).status).toBe(502);
      expect(await status(order.id)).toBe("pending");
    });

    // ревью F3: счет создается медленно, срок проходит, фоновая задача выбирает заказ еще в created
    for (const paidInBot of [true, false]) {
      it(`счет создан, пока фоновая задача истекала created: ${paidInBot ? "оплачен - заказ оплачен" : "не оплачен - удален, заказ истек"} (ревью F3)`, async () => {
        const order = await newOrder();
        cp.setPayOnCreate(paidInBot);
        const releaseCreate = cp.holdCreate();
        const payReq = pay(order.id).then((r) => r);
        await until(() => cp.calls.some((c) => c.method === "createInvoice"));
        await backdate(order.id);

        const gate = holdFirstExpire();
        const expiring = t.app.get(OrdersWorker).expire();
        await until(gate.held);

        releaseCreate();
        const res = await payReq;
        gate.release();
        expect(await expiring).toBe(0);

        expect(res.status).toBe(409);
        expect(await status(order.id)).toBe(paidInBot ? "paid" : "expired");
        const inv = cp.calls.find((c) => c.method === "createInvoice")!;
        expect(cp.calls.filter((c) => c.method === "deleteInvoice")).toHaveLength(paidInBot ? 0 : 1);
        expect(inv).toBeTruthy();
      });
    }

    it("свежий заказ не истекает", async () => {
      const order = await newOrder();
      await pay(order.id);
      expect(await expireCp()).toBe(0);
      expect(await status(order.id)).toBe("pending");
    });
  });

  describe("отмена", () => {
    const cancel = (id: string) => http().post(`/api/orders/${id}/cancel`).set("Cookie", cookie);
    // первое чтение заказа (его делает отмена) - вернуть прочитанное только после release()
    const holdFirstGet = () => {
      const svc = t.app.get(OrdersService);
      const get = svc.get.bind(svc);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let held = false;
      jest.spyOn(svc, "get").mockImplementationOnce(async (...args) => {
        const order = await get(...args);
        held = true;
        await gate;
        return order;
      });
      return { release, held: () => held };
    };

    // ревью F2: отмена прочитала created, параллельный /pay создал счет, потом отмена продолжилась
    for (const paidInBot of [true, false]) {
      it(`отмена по устаревшему created, /pay успел создать счет: ${paidInBot ? "счет оплачен - 409, оплата проводится" : "счет удаляется, заказ отменен"} (ревью F2)`, async () => {
        const order = await newOrder();
        const gate = holdFirstGet();
        const canceling = cancel(order.id).then((r) => r);
        await until(gate.held);

        expect((await pay(order.id)).status).toBe(200);
        const inv = await invoiceOf(order.id);
        if (paidInBot) cp.pay(inv.invoice_id);
        gate.release();
        const res = await canceling;

        if (paidInBot) {
          expect(res.status).toBe(409);
          expect(res.body.status).toBe("paid");
          expect(await status(order.id)).toBe("pending");
          expect(await poll()).toBe(1);
          expect(await status(order.id)).toBe("paid");
        } else {
          expect(res.status).toBe(200);
          expect(res.body.order.status).toBe("canceled");
          expect(cp.invoices.has(inv.invoice_id)).toBe(false);
        }
      });
    }

    it("неоплаченный счет удаляется в Crypto Pay, потом заказ отменяется", async () => {
      const order = await newOrder();
      await pay(order.id);
      const inv = await invoiceOf(order.id);
      const res = await cancel(order.id);
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("canceled");
      expect(cp.invoices.has(inv.invoice_id)).toBe(false);
    });

    it("счет уже оплачен в боте - отмена не проходит, опрос проводит оплату", async () => {
      const order = await newOrder();
      await pay(order.id);
      cp.pay((await invoiceOf(order.id)).invoice_id);
      const res = await cancel(order.id);
      expect(res.status).toBe(409);
      expect(res.body.status).toBe("paid");
      expect(await status(order.id)).toBe("pending");
      await poll();
      expect(await status(order.id)).toBe("paid");
    });

    it("Crypto Pay не отвечает - 502, заказ не отменен, счет цел", async () => {
      const order = await newOrder();
      await pay(order.id);
      const inv = await invoiceOf(order.id);
      cp.setDown(true);
      const res = await cancel(order.id);
      expect(res.status).toBe(502);
      expect(await status(order.id)).toBe("pending");
      expect(cp.invoices.has(inv.invoice_id)).toBe(true);
      cp.setDown(false);
      expect((await cancel(order.id)).status).toBe(200);
    });

    it("заказ без счета отменяется без запросов в Crypto Pay", async () => {
      const order = await newOrder();
      expect((await cancel(order.id)).status).toBe(200);
      expect(cp.calls).toHaveLength(0);
    });
  });

  describe("опрос больше 100 заказов", () => {
    // 150 ждущих заказов Crypto Pay со счетами; sameTime - у всех одно время создания (граница пачки - только по id)
    const bulkPending = async (sameTime = false) => {
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email: "alex@mail.ru" } });
      const base = Date.now() - 60_000;
      const rows = Array.from({ length: 150 }, (_, i) => ({
        userId: user.id,
        idempotencyKey: `bulk-${i}-00000`,
        steamLogin: "gaben",
        amount: 100_00,
        currency: "RUB",
        payAmount: 100_00,
        status: "pending" as const,
        paymentProvider: "cryptopay",
        paymentId: String(50_000 + i),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        createdAt: new Date(sameTime ? base : base + i * 10),
      }));
      await t.prisma.order.createMany({ data: rows });
      for (const r of rows) {
        const id = Number(r.paymentId);
        cp.invoices.set(id, { invoice_id: id, hash: `H${id}`, status: "active", currency_type: "fiat", fiat: "RUB", amount: "100", bot_invoice_url: "", payload: "" });
      }
    };
    const paidCount = () => t.prisma.order.count({ where: { status: "paid" } });

    it("оплачен самый новый - находится во второй пачке", async () => {
      await bulkPending();
      cp.pay(50_149);
      expect(await poll()).toBe(1);
      expect(await paidCount()).toBe(1);
      expect(cp.calls.filter((c) => c.method === "getInvoices")).toHaveLength(2);
    });

    it("оплачены все 150 - один проход проводит все (заказы первой пачки, ставшие paid, не сдвигают вторую)", async () => {
      await bulkPending();
      for (let i = 0; i < 150; i++) cp.pay(50_000 + i);
      expect(await poll()).toBe(150);
      expect(await paidCount()).toBe(150);
    });

    it("оплачены последний заказ первой пачки и первый второй", async () => {
      await bulkPending();
      cp.pay(50_099);
      cp.pay(50_100);
      expect(await poll()).toBe(2);
    });

    it("одинаковое время создания у всех - граница по id, тоже ничего не пропускается", async () => {
      await bulkPending(true);
      for (let i = 0; i < 150; i++) cp.pay(50_000 + i);
      expect(await poll()).toBe(150);
    });
  });

  it("тестовая страница оплаты при Crypto Pay недоступна", async () => {
    expect((await http().get(`/api/payments/fake/${randomUUID()}`)).status).toBe(404);
  });
});
