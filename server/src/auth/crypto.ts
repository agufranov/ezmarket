import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// 6 цифр из криптостойкого генератора
export const newCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

// В базе только HMAC: email в составе - одинаковые коды разных людей дают разные хеши
export const hashCode = (secret: string, email: string, code: string) => createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");

export const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
};

// Токен сессии: 32 случайных байта в cookie, в базе - SHA-256 от него
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
