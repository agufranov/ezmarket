import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { createTransport, type Transporter } from "nodemailer";
import { CONFIG, type Config } from "../config";
import { PrismaService } from "../prisma.service";

const BATCH = 10;
const MAX_ATTEMPTS = 8;
// пауза перед повтором растет: 5 с, 10 с, 20 с ... но не больше 10 минут
const backoffMs = (attempt: number) => Math.min(5000 * 2 ** (attempt - 1), 10 * 60 * 1000);

// Письма уходят из таблицы email_outbox: запись создается в одной транзакции с действием,
// поэтому сбой почты не откатывает ни вход, ни заказ - воркер просто повторит отправку.
@Injectable()
export class MailService {
  private readonly log = new Logger("mail");
  private readonly transport: Transporter;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: Config,
  ) {
    this.transport = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    });
  }

  @Interval(2000)
  async tick() {
    if (this.config.WORKERS) await this.flush();
  }

  // Отправляет готовые письма. SKIP LOCKED - несколько экземпляров сервера не возьмут одно письмо дважды
  async flush(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const rows = await this.prisma.$queryRaw<{ id: string; to: string; subject: string; text: string; html: string | null; attempts: number }[]>`
        UPDATE "email_outbox" SET "attempts" = "attempts" + 1
        WHERE "id" IN (
          SELECT "id" FROM "email_outbox"
          WHERE "sent_at" IS NULL AND "next_try_at" <= now() AND "attempts" < ${MAX_ATTEMPTS}
          ORDER BY "created_at" LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "to", "subject", "text", "html", "attempts"`;
      for (const m of rows) {
        try {
          await this.transport.sendMail({ from: this.config.MAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html ?? undefined });
          await this.prisma.emailOutbox.update({ where: { id: m.id }, data: { sentAt: new Date(), error: null } });
          sent++;
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          await this.prisma.emailOutbox.update({
            where: { id: m.id },
            data: { error, nextTryAt: new Date(Date.now() + backoffMs(m.attempts)) },
          });
          // в лог - только адресат и причина, без содержимого письма (в нем код входа)
          this.log.warn(`письмо для ${m.to} не ушло (попытка ${m.attempts}): ${error}`);
        }
      }
    } finally {
      this.running = false;
    }
    return sent;
  }
}
