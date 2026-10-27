import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { z } from "zod";
import { ZodPipe } from "../common/http";
import { CurrentUser, SessionGuard } from "../auth/session.guard";
import { NotificationsService } from "./notifications.service";

const readSchema = z.object({
  ids: z
    .array(z.string({ invalid_type_error: "Неверный id уведомления" }).regex(/^\d{1,18}$/, "Неверный id уведомления"), {
      required_error: "Нужен список id уведомлений",
      invalid_type_error: "Нужен список id уведомлений",
    })
    .min(1, "Нужен список id уведомлений")
    .max(100, "Не больше 100 уведомлений за раз"),
});

// Уведомления колокольчика: свои, новые сверху; счетчик непрочитанных - в каждом ответе
@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/notifications -> { unread, items: [{ id, type, text, icon, orderId, read, at }] } (до 50)
  @Get()
  list(@CurrentUser() user: User) {
    return this.notifications.list(user.id);
  }

  // POST /api/notifications/read { ids } -> { unread }
  @Post("read")
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: User, @Body(new ZodPipe(readSchema)) body: z.infer<typeof readSchema>) {
    return this.notifications.markRead(user.id, body.ids.map(BigInt));
  }

  // POST /api/notifications/read-all -> { unread: 0 }
  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: User) {
    return this.notifications.markRead(user.id);
  }
}
