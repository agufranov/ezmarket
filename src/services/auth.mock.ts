// Моки авторизации, пока нет API.
// API: POST /auth/email/code { email, mode, promo? } -> 200 { resendIn } | 422 { field, error }

const DELAY = 800;
const VALID_PROMO = ["EZ100", "FRIEND-2026", "WELCOME"];

const wait = () => new Promise((r) => setTimeout(r, DELAY));

export type AuthError = { field?: "email" | "promo"; error: string };

export async function requestCode(email: string, promo?: string): Promise<{ resendIn: number }> {
  await wait();
  if (email.startsWith("error@")) throw { error: "Не удалось отправить код. Попробуйте еще раз" } satisfies AuthError;
  if (promo && !VALID_PROMO.includes(promo)) throw { field: "promo", error: "Промокод не найден" } satisfies AuthError;
  return { resendIn: 60 };
}

export async function oauthLogin(provider: string): Promise<{ ok: true }> {
  await wait();
  console.log(`[auth] oauth ${provider}`);
  return { ok: true };
}
