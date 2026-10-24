import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { AUTH_RULES, CONFIG, type Config } from "../config";
import { ApiError } from "../common/http";
import { codeEmail } from "../mail/templates";
import { PrismaService } from "../prisma.service";
import { hashCode, hashToken, newCode, newToken, sameHash } from "./crypto";
import type { RequestCodeDto, VerifyDto } from "./auth.schemas";

// Пользователь в форме, которую ждет фронт (src/data/user.ts)
export type UserDto = { name: string; email: string; bonuses: number; counters: { orders: number; referrals: number } };

export const toUserDto = (u: User): UserDto => ({
  name: u.name ?? u.email.split("@")[0],
  email: u.email,
  bonuses: u.bonusBalance,
  counters: { orders: 0, referrals: 0 },
});

// Все действия с кодами одного email - под блокировкой этого email на время транзакции:
// два параллельных запроса не обойдут лимиты и не погасят код дважды
const lockEmail = (tx: Prisma.TransactionClient, email: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // Новый код: не чаще раза в AUTH_RESEND_SECONDS и не больше AUTH_CODES_PER_HOUR в час на email; прошлые коды гасятся
  async requestCode({ email, mode, promo }: RequestCodeDto): Promise<{ resendIn: number; demoCode?: string }> {
    if (mode === "register" && promo) {
      const ok = await this.prisma.promoCode.findFirst({ where: { code: promo, active: true } });
      if (!ok) throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Промокод не найден", { field: "promo" });
    }

    return this.prisma.$transaction(async (tx) => {
      await lockEmail(tx, email);
      const now = Date.now();
      const recent = await tx.authCode.findMany({
        where: { email, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const resendAfterMs = this.config.AUTH_RESEND_SECONDS * 1000;
      const last = recent[0]?.createdAt.getTime();
      if (last && now - last < resendAfterMs) {
        const retryIn = Math.ceil((resendAfterMs - (now - last)) / 1000);
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, `Новый код можно запросить через ${retryIn} с`, { retryIn });
      }
      if (recent.length >= this.config.AUTH_CODES_PER_HOUR) {
        const oldest = recent[recent.length - 1].createdAt.getTime();
        const retryIn = Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000);
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Слишком много кодов за час. Попробуйте позже", { retryIn });
      }

      const code = newCode();
      await tx.authCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date(now) } });
      await tx.authCode.create({
        data: {
          email,
          mode,
          promo: mode === "register" ? promo : undefined,
          codeHash: hashCode(this.config.AUTH_CODE_SECRET, email, code),
          expiresAt: new Date(now + AUTH_RULES.codeTtlMs),
        },
      });
      // письмо уйдет из очереди (MailService), код остается только в его тексте
      await tx.emailOutbox.create({ data: { to: email, ...codeEmail(code, mode) } });
      return { resendIn: this.config.AUTH_RESEND_SECONDS, ...(this.config.AUTH_DEMO_CODE && { demoCode: code }) };
    });
  }

  // Проверка кода: одноразовый, 10 минут, 5 неверных попыток - и код сгорает
  async verify({ email, code }: VerifyDto): Promise<{ user: User; token: string }> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockEmail(tx, email);
      const row = await tx.authCode.findFirst({
        where: { email, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!row) return { ok: false, error: "Код устарел или уже использован. Запросите новый" } as const;

      if (!sameHash(row.codeHash, hashCode(this.config.AUTH_CODE_SECRET, email, code))) {
        const attempts = row.attempts + 1;
        const burned = attempts >= AUTH_RULES.maxAttempts;
        await tx.authCode.update({ where: { id: row.id }, data: { attempts, usedAt: burned ? new Date() : undefined } });
        return burned
          ? ({ ok: false, error: "Слишком много неверных попыток. Запросите новый код" } as const)
          : ({ ok: false, error: "Неверный код", attemptsLeft: AUTH_RULES.maxAttempts - attempts } as const);
      }

      await tx.authCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      const user = await tx.user.upsert({
        where: { email },
        create: { email, promo: row.promo },
        update: {},
      });
      const token = newToken();
      await tx.session.create({
        data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + AUTH_RULES.sessionTtlMs) },
      });
      return { ok: true, user, token } as const;
    });

    // неверная попытка должна сохраниться - поэтому ошибка бросается уже после коммита
    if (!result.ok) {
      const { ok: _, error, ...extra } = result;
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, error, { field: "code", ...extra });
    }
    return { user: result.user, token: result.token };
  }

  async userBySession(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    const s = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!s || s.expiresAt.getTime() <= Date.now()) return null;
    return s.user;
  }

  async logout(token: string | undefined) {
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}
