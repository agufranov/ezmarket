// Настройки, которые заказчик будет менять без правки верстки
export const site = {
  // Через сколько обновятся "Хиты недели" (с момента загрузки страницы, пока нет API)
  hitsRefreshInMs: (2 * 24 * 60 + 14 * 60 + 6) * 60 * 1000,
  heroSlideMs: 6000,
  steam: {
    minAmount: 100,
    maxAmount: 50000,
    currencies: [
      { id: "USD", symbol: "$" },
      { id: "KZT", symbol: "₸" },
      { id: "RUB", symbol: "₽" },
    ],
  },
  recommended: {
    pageSize: 10,
    maxItems: 30,
    loaderDelayMs: 1200,
  },
} as const;
