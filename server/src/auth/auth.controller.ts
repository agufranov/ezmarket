import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AUTH_RULES, CONFIG, type Config } from "../config";
import { ZodPipe } from "../common/http";
import { requestCodeSchema, verifySchema, type RequestCodeDto, type VerifyDto } from "./auth.schemas";
import { AuthService, toUserDto } from "./auth.service";
import { CurrentUser, SessionGuard } from "./session.guard";

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // POST /api/auth/code { email, mode, promo? } -> 200 { resendIn } | 422 { field, error } | 429 { error, retryIn }
  @Post("auth/code")
  @HttpCode(200)
  requestCode(@Body(new ZodPipe(requestCodeSchema)) body: RequestCodeDto) {
    return this.auth.requestCode(body);
  }

  // POST /api/auth/verify { email, code } -> 200 { user } + cookie сессии | 422 { field: "code", error, attemptsLeft? }
  @Post("auth/verify")
  @HttpCode(200)
  async verify(@Body(new ZodPipe(verifySchema)) body: VerifyDto, @Res({ passthrough: true }) res: FastifyReply) {
    const { user, token } = await this.auth.verify(body);
    res.setCookie(AUTH_RULES.cookieName, token, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_RULES.sessionTtlMs / 1000,
    });
    return { user: toUserDto(user) };
  }

  // GET /api/me -> 200 { user } | 401
  @Get("me")
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: User) {
    return { user: toUserDto(user) };
  }

  // POST /api/auth/logout -> 204, сессия удаляется из базы
  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.auth.logout(req.cookies?.[AUTH_RULES.cookieName]);
    res.clearCookie(AUTH_RULES.cookieName, { path: "/" });
  }
}
