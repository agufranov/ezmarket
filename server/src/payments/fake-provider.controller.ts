import { Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { CONFIG, type Config } from "../config";
import { ApiError } from "../common/http";
import { PrismaService } from "../prisma.service";
import { PaymentsService } from "./payments.service";
import { signBody } from "./signature";

const notFound = () => new ApiError(HttpStatus.NOT_FOUND, "Платеж не найден");
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);

// Встроенная тестовая платежная система (PAYMENT_PROVIDER=fake): страница оплаты и подписанное уведомление,
// которое идет через тот же обработчик, что и уведомления настоящей платежки
@Controller("payments/fake")
export class FakeProviderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // GET /api/payments/fake/:paymentId -> страница «Оплатить / Отменить»
  @Get(":paymentId")
  async page(@Param("paymentId", new ParseUUIDPipe({ exceptionFactory: notFound })) paymentId: string, @Res() res: FastifyReply) {
    const order = await this.order(paymentId);
    const sum = money(order.payAmount, order.currency);
    res.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тестовая оплата</title>
<style>body{font-family:Arial,sans-serif;background:#f4f5f7;color:#1e2229;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;border-radius:24px;padding:32px;max-width:360px;width:calc(100% - 32px);box-shadow:0 24px 60px rgba(20,24,32,.12)}
h1{font-size:20px;margin:0 0 8px}p{color:#686e78;margin:0 0 24px}b{color:#1e2229}
button{width:100%;height:50px;border:0;border-radius:25px;font:inherit;font-weight:700;cursor:pointer;margin-top:8px}
.pay{background:#ff7a00;color:#fff}.cancel{background:#eef0f3;color:#1e2229}</style></head>
<body><main><h1>Тестовая оплата</h1>
<p>Пополнение Steam <b>${order.steamLogin}</b> на <b>${sum}</b>. Деньги не списываются.</p>
<button class="pay" data-act="succeed">Оплатить ${sum}</button>
<button class="cancel" data-act="cancel">Отменить</button></main>
<script>document.querySelectorAll("button").forEach(function(b){b.onclick=function(){
fetch(location.pathname+"/"+b.dataset.act,{method:"POST"}).then(function(){location.href="/"})}})</script>
</body></html>`);
  }

  // POST /api/payments/fake/:paymentId/succeed | cancel -> 200 { ok, result }
  @Post(":paymentId/:act")
  @HttpCode(200)
  async act(@Param("paymentId", new ParseUUIDPipe({ exceptionFactory: notFound })) paymentId: string, @Param("act") act: string) {
    if (act !== "succeed" && act !== "cancel") throw notFound();
    const order = await this.order(paymentId);
    const body = JSON.stringify({
      id: randomUUID(),
      type: act === "succeed" ? "payment.succeeded" : "payment.canceled",
      payment: { id: paymentId, amount: order.payAmount, currency: order.currency },
    });
    return this.payments.handleWebhook(Buffer.from(body), signBody(this.config.PAYMENT_WEBHOOK_SECRET, body));
  }

  private async order(paymentId: string) {
    if (this.config.PAYMENT_PROVIDER !== "fake") throw notFound();
    const order = await this.prisma.order.findUnique({ where: { paymentId } });
    if (!order || order.paymentProvider !== "fake") throw notFound();
    return order;
  }
}
