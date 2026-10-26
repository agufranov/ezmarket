import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Crypto Pay API (@CryptoBot): https://help.cr.bot/en/articles/10279948-crypto-pay-api
// Ответ: { ok: true, result } | { ok: false, error: { code, name } }

export type CryptoPayInvoice = {
  invoice_id: number;
  hash: string;
  status: "active" | "paid" | "expired";
  currency_type: "crypto" | "fiat";
  fiat?: string;
  amount: string;
  paid_asset?: string;
  paid_amount?: string;
  bot_invoice_url: string;
  payload?: string;
};

export class CryptoPayError extends Error {}

const BASE = { testnet: "https://testnet-pay.crypt.bot/api", mainnet: "https://pay.crypt.bot/api" } as const;

export class CryptoPayClient {
  private readonly base: string;

  constructor(
    private readonly token: string,
    network: keyof typeof BASE,
    apiUrl?: string,
  ) {
    this.base = (apiUrl ?? BASE[network]).replace(/\/$/, "");
  }

  private async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/${method}`, {
        method: "POST",
        headers: { "Crypto-Pay-API-Token": this.token, "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new CryptoPayError(`${method}: нет связи (${e instanceof Error ? e.message : String(e)})`);
    }
    const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; error?: { name?: string } } | null;
    if (!data?.ok) throw new CryptoPayError(`${method}: ${data?.error?.name ?? `HTTP ${res.status}`}`);
    return data.result as T;
  }

  // Счет в валюте заказа: покупатель платит любой монетой, курс считает бот
  createInvoice(p: { fiat: string; amount: string; description: string; payload: string; expiresIn: number; returnUrl?: string }) {
    return this.call<CryptoPayInvoice>("createInvoice", {
      currency_type: "fiat",
      fiat: p.fiat,
      amount: p.amount,
      description: p.description,
      payload: p.payload,
      expires_in: p.expiresIn,
      allow_comments: false,
      ...(p.returnUrl && { paid_btn_name: "callback", paid_btn_url: p.returnUrl }),
    });
  }

  async getInvoices(ids: string[], status?: "active" | "paid") {
    const r = await this.call<{ items: CryptoPayInvoice[] }>("getInvoices", { invoice_ids: ids.join(","), ...(status && { status }), count: 1000 });
    return r.items;
  }

  async deleteInvoice(id: string) {
    await this.call<boolean>("deleteInvoice", { invoice_id: Number(id) });
  }
}

// Подпись вебхука: hex(HMAC-SHA256(SHA256(токен), тело запроса байт в байт)) в заголовке crypto-pay-api-signature
export function cryptoPaySignature(token: string, body: Buffer | string) {
  const secret = createHash("sha256").update(token).digest();
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function validCryptoPaySignature(token: string, body: Buffer, signature: string | undefined) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const a = Buffer.from(cryptoPaySignature(token, body), "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Сумма счета строкой («500», «125.5») -> минимальные единицы
export const toMinor = (amount: string) => Math.round(Number(amount) * 100);
export const fromMinor = (minor: number) => (minor / 100).toFixed(2);
