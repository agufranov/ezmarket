import { createHmac, timingSafeEqual } from "node:crypto";

// Подпись уведомления: hex(HMAC-SHA256(секрет, тело запроса байт в байт)) в заголовке X-Signature
export const signBody = (secret: string, body: Buffer | string) => createHmac("sha256", secret).update(body).digest("hex");

export function validSignature(secret: string, body: Buffer, signature: string | undefined) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signBody(secret, body), "hex");
  const got = Buffer.from(signature, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}
