import { type CanActivate, type ExecutionContext, HttpStatus, Injectable, createParamDecorator } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { AUTH_RULES } from "../config";
import { ApiError } from "../common/http";
import { AuthService } from "./auth.service";

type Req = FastifyRequest & { user?: User };

// Пускает только с живой сессией; пользователь кладется в запрос для @CurrentUser()
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Req>();
    const user = await this.auth.userBySession(req.cookies?.[AUTH_RULES.cookieName]);
    if (!user) throw new ApiError(HttpStatus.UNAUTHORIZED, "Нужно войти");
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>().user);
