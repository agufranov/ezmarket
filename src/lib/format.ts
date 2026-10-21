// 1490 -> "1 490 ₽" (неразрывный пробел между разрядами)
export function formatPrice(value: number, symbol = "₽") {
  return `${value.toLocaleString("ru-RU").replace(/\s/g, " ")} ${symbol}`;
}

export function formatAmount(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6);
}

// plural(5, ["бонус", "бонуса", "бонусов"]) -> "бонусов"
export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

// 1240 -> "1 240" с неразрывным пробелом
export const formatNumber = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, " ");
