import { Controller, Get, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser, SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma.service";

// Бонусы пользователя (1 бонус = 1 ₽). Начисления и списания делают регистрация, создание заказа и триггер
// на смену статуса заказа - здесь только чтение
@Controller("bonuses")
@UseGuards(SessionGuard)
export class BonusesController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/bonuses -> { balance, history } - свои, новые сверху (до 50)
  @Get()
  async list(@CurrentUser() user: User) {
    const [fresh, rows] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { bonusBalance: true } }),
      this.prisma.bonusTransaction.findMany({ where: { userId: user.id }, orderBy: { id: "desc" }, take: 50 }),
    ]);
    return {
      balance: fresh.bonusBalance,
      history: rows.map((r) => ({
        id: String(r.id),
        kind: r.kind,
        delta: r.delta,
        balanceAfter: r.balanceAfter,
        orderId: r.orderId,
        at: r.createdAt.toISOString(),
      })),
    };
  }
}
