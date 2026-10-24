import { HttpException, HttpStatus, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

// Ошибки API в формате, который уже понимают модалки фронта: { error, field?, ... }
export class ApiError extends HttpException {
  constructor(status: HttpStatus, error: string, extra: Record<string, unknown> = {}) {
    super({ error, ...extra }, status);
  }
}

// Проверка тела запроса схемой zod; первая ошибка - в поле error, имя поля - в field
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    const issue = r.error.issues[0];
    throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, issue.message, { field: issue.path[0] });
  }
}
