// Валюты отображения цен (ТЗ 12.6). Когда валюта заработает - достаточно enabled: true.
// API: позже - GET /currencies
export const currencies = [
  { code: "RUB", symbol: "₽", name: "Российский рубль", enabled: true },
  { code: "USD", symbol: "$", name: "Доллар США", enabled: false },
  { code: "KZT", symbol: "₸", name: "Казахстанский тенге", enabled: false },
] as const;

export type Currency = (typeof currencies)[number];

const KEY = "ez_currency";

export function loadCurrency(): Currency {
  try {
    const saved = currencies.find((c) => c.code === localStorage.getItem(KEY));
    if (saved?.enabled) return saved;
  } catch {}
  return currencies[0];
}

export function saveCurrency(c: Currency) {
  try {
    localStorage.setItem(KEY, c.code);
  } catch {}
}
