import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cryptoPaySignature } from "../src/payments/cryptopay.client";
import { PaymentsService } from "../src/payments/payments.service";
import { loginAs, resetDb, startApp, type TestApp } from "./helpers";

// Подставной Crypto Pay API: хранит счета в памяти, отвечает в формате { ok, result }
type Invoice = { invoice_id: number; hash: string; status: string; currency_type: string; fiat: string; amount: string; bot_invoice_url: string; payload: string };

function fakeCryptoPay() {
  const invoices = new Map<number, Invoice>();
  const calls: { method: string; token: string | undefined; body: Record<string, unknown> }[] = [];
  let nextId = 1000;
  let down = false;
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const method = req.url!.split("/").pop()!;
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method, token: req.headers["crypto-pay-api-token"] as string | undefined, body });
      const send = (result: unknown) => res.end(JSON.stringify({ ok: true, result }));
      if (down) return res.writeHead(500).end(JSON.stringify({ ok: false, error: { name: "INTERNAL" } }));
      if (method === "createInvoice") {
        const id = nextId++;
        const inv = { invoice_id: id, hash: `H${id}`, status: "active", currency_type: "fiat", fiat: body.fiat, amount: String(Number(body.amount)), bot_invoice_url: `https://t.me/CryptoTestnetBot?start=H${id}`, payload: body.payload };
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
  return { server, invoices, calls, setDown: (v: boolean) => (down = v), pay: (id: number) => (invoices.get(id)!.status = "paid") };
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

  it("тестовая страница оплаты при Crypto Pay недоступна", async () => {
    expect((await http().get(`/api/payments/fake/${randomUUID()}`)).status).toBe(404);
  });
});
