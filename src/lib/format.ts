// 1490 -> "1 490 ₽" (неразрывный пробел между разрядами)
export function formatPrice(value: number, symbol = "₽") {
  return `${value.toLocaleString("ru-RU").replace(/\s/g, " ")} ${symbol}`;
}

export function formatAmount(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7);
}
