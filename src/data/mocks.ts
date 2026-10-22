// Моковые данные главной. Позже заменяются ответами API с той же формой.

export type Cover =
  | { kind: "art"; src: string }
  | { kind: "brand"; src: string; gradient: string };

export type Product = {
  id: string;
  slug: string;
  brand: string;
  type: string;
  title: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  badge?: "Хит" | "Новинка";
  cover: Cover;
  tab: TabId;
};

export type TabId = "games" | "services" | "subs" | "gifts" | "keys";

const G = {
  purple: "linear-gradient(150deg, #d26bff 0%, #7b2ff7 100%)",
  orange: "linear-gradient(150deg, #ff9a4a 0%, #e8501c 100%)",
  sky: "linear-gradient(150deg, #5ec2ff 0%, #1f7fe0 100%)",
  green: "linear-gradient(150deg, #37d6a6 0%, #0d8f6a 100%)",
  blue: "linear-gradient(150deg, #6aa8ff 0%, #2f5fe0 100%)",
  indigo: "linear-gradient(150deg, #4f7cff 0%, #1d3fb8 100%)",
};

const covers = {
  genshin: { kind: "art", src: "/img/games/genshin.png" },
  pubg: { kind: "art", src: "/img/games/pubg.png" },
  mlbb: { kind: "art", src: "/img/games/mlbb.png" },
  honkai: { kind: "art", src: "/img/games/honkai.png" },
  brawl: { kind: "brand", src: "/img/brands/brawl.png", gradient: G.purple },
  office: { kind: "brand", src: "/img/brands/windows.png", gradient: G.orange },
  telegram: { kind: "brand", src: "/img/brands/telegram-sq.png", gradient: G.sky },
  chatgpt: { kind: "brand", src: "/img/brands/chatgpt.png", gradient: G.green },
  appstore: { kind: "brand", src: "/img/brands/appstore.png", gradient: G.blue },
  ps: { kind: "brand", src: "/img/brands/playstation-sq.png", gradient: G.indigo },
} satisfies Record<string, Cover>;

type Base = Omit<Product, "id" | "tab">;

const catalog: Record<string, Base> = {
  genshin: { slug: "genshin-60", brand: "Genshin Impact", type: "Донат", title: "60 Кристаллов Сотворения", price: 79, oldPrice: 99, discount: 20, cover: covers.genshin },
  brawl: { slug: "brawl-pass-plus", brand: "Brawl Stars", type: "Донат", title: "Brawl Pass Plus", price: 849, oldPrice: 999, discount: 15, badge: "Хит", cover: covers.brawl },
  pubg: { slug: "pubg-660-uc", brand: "PUBG Mobile", type: "Игровая валюта", title: "660 UC по ID", price: 769, oldPrice: 899, discount: 14, cover: covers.pubg },
  mlbb: { slug: "mlbb-257", brand: "Mobile Legends", type: "Донат", title: "257 алмазов + бонус", price: 359, oldPrice: 449, discount: 20, badge: "Новинка", cover: covers.mlbb },
  office: { slug: "office-2024", brand: "Microsoft", type: "Ключ", title: "Office 2024 Pro Plus", price: 1490, oldPrice: 2990, discount: 50, cover: covers.office },
  telegram: { slug: "tg-premium-3", brand: "Telegram", type: "Подписка", title: "Premium на 3 месяца", price: 1190, oldPrice: 1490, discount: 20, cover: covers.telegram },
  chatgpt: { slug: "chatgpt-plus", brand: "ChatGPT", type: "Подписка", title: "Plus на 1 месяц", price: 1990, oldPrice: 2290, discount: 13, cover: covers.chatgpt },
  appstore: { slug: "appstore-1000", brand: "App Store", type: "Подарочная карта", title: "Gift-карта 1 000 ₽", price: 1000, cover: covers.appstore },
  honkai: { slug: "hsr-express", brand: "Honkai: Star Rail", type: "Донат", title: "Пропуск Экспресса", price: 399, oldPrice: 499, discount: 20, cover: covers.honkai },
  ps: { slug: "ps-plus-12", brand: "PlayStation", type: "Подписка", title: "PS Plus Essential 12 мес", price: 3490, oldPrice: 4190, discount: 17, cover: covers.ps },
};

export const hits: Product[] = (["genshin", "brawl", "pubg", "mlbb", "office"] as const).map((k) => ({
  ...catalog[k],
  id: `hit-${k}`,
  tab: "games",
}));

export const recommendTabs: { id: TabId; label: string; count: number; icon: string }[] = [
  { id: "games", label: "Игры", count: 86, icon: "/img/icons/tab-games.svg" },
  { id: "services", label: "Сервисы", count: 24, icon: "/img/icons/tab-services.svg" },
  { id: "subs", label: "Подписки", count: 31, icon: "/img/icons/tab-subs.svg" },
  { id: "gifts", label: "Подарочные карты", count: 18, icon: "/img/icons/tab-gifts.svg" },
  // В макете 5-я вкладка дублирует "Подарочные карты 18" - финальную подпись уточняем у заказчика
  { id: "keys", label: "Ключи", count: 42, icon: "/img/icons/tab-gifts.svg" },
];

const recommendOrder = ["telegram", "chatgpt", "appstore", "honkai", "ps", "mlbb", "genshin", "office", "brawl", "pubg"];
const tabByKey: Record<string, TabId[]> = {
  telegram: ["games", "subs", "services"],
  chatgpt: ["games", "subs", "services"],
  appstore: ["games", "gifts", "services"],
  honkai: ["games"],
  ps: ["games", "subs"],
  mlbb: ["games"],
  genshin: ["games"],
  office: ["games", "keys", "services"],
  brawl: ["games"],
  pubg: ["games"],
};

// Генерирует бесконечную моковую выдачу для вкладки: повторяет базовый набор с новыми id
export function getRecommended(tab: TabId, offset: number, limit: number): Product[] {
  const pool = recommendOrder.filter((k) => tabByKey[k].includes(tab));
  return Array.from({ length: limit }, (_, i) => {
    const n = offset + i;
    const key = pool[n % pool.length];
    return { ...catalog[key], id: `${tab}-${key}-${n}`, tab };
  });
}

const mainSlide = {
  id: "steam",
  badge: "Без комиссии",
  title: ["Пополняй Steam", "за минуту"],
  text: "Любая сумма от 100 ₽ · скидка 5% на первое пополнение",
  cta: "Пополнить",
};

// ТЗ 0.2 п.6: пока других баннеров нет, слайды повторяют главный; число полосок = числу слайдов
export const heroSlides = [mainSlide, ...[2, 3, 4].map((n) => ({ ...mainSlide, id: `steam-${n}` }))];

export const sideBanners = [
  { id: "ps", label: "PlayStation", title: ["PS Plus до", "-40%"], icon: "/img/brands/playstation.png", theme: "dark" as const },
  { id: "tg", label: "Telegram", title: ["Stars и", "Premium"], icon: "/img/brands/telegram.png", theme: "peach" as const },
];

export const categories = [
  { id: "steam", label: "Пополнить Steam", icon: "/img/icons/cat-steam.svg" },
  { id: "keys", label: "Ключи игр", icon: "/img/icons/cat-keys.svg" },
  { id: "donate", label: "Донат в игры", icon: "/img/icons/cat-donate.svg" },
  { id: "subs", label: "Подписки", icon: "/img/icons/cat-subs.svg" },
  { id: "accounts", label: "Аккаунты", icon: "/img/icons/cat-accounts.svg" },
  { id: "skins", label: "Скины и предметы", icon: "/img/icons/cat-skins.svg" },
  { id: "gifts", label: "Подарочные карты", icon: "/img/icons/cat-gifts.svg" },
  { id: "sale", label: "Акции", icon: "/img/icons/cat-sale.svg", accent: true },
];

export const bonusSteps = [
  { icon: "%", label: "Покупаете" },
  { icon: "★", label: "Пишете отзыв" },
  { icon: "₽", label: "Платите бонусами" },
];

export const articles = {
  main: {
    slug: "steam-autumn-sale-2026",
    tag: "Steam",
    title: "Осенняя распродажа Steam 2026: даты, скидки и что купить",
    date: "14 окт",
    views: "3 204",
  },
  list: [
    { slug: "egs-free", tag: "Раздачи", title: "Тайные игры EGS: забираем бесплатно прямо сейчас", date: "12 окт", views: "1 870", gradient: "linear-gradient(160deg, #7d97ff 0%, #2a3aa8 100%)" },
    { slug: "mlbb-heroes", tag: "Гайды", title: "Mobile Legends: новые герои и как получить алмазы дешевле", date: "10 окт", views: "2 115", gradient: "linear-gradient(160deg, #ffd56b 0%, #e8662a 100%)" },
    { slug: "hsr-36", tag: "Новости", title: "Honkai: Star Rail 3.6 - баннеры и события", date: "8 окт", views: "964", gradient: "linear-gradient(160deg, #5fd0ff 0%, #1d6fd8 100%)" },
  ],
};

export const rating = { value: "4,8", count: "1 284 отзыва" };

export const reviews = [
  { id: "r1", stars: 5, text: "Сразу не пришло, но поддержка за 3 минуты все решила. Активировал на аккаунте.", product: "Brawl Pass Plus", productIcon: "/img/brands/brawl-chip.png", productSlug: "brawl-pass-plus", author: "Дмитрий", date: "14 октября", color: "#5b8def" },
  { id: "r2", stars: 4, text: "Пополнила Steam - деньги пришли через минуту. Удобно, что без комиссии.", product: "Пополнение Steam", productIcon: "/img/brands/steam-chip.png", productSlug: "steam", author: "Ирина", date: "14 октября", color: "#e5484d" },
  { id: "r3", stars: 5, text: "Брал Telegram Premium в подарок другу - все пришло моментально.", product: "Telegram Premium", productIcon: "/img/brands/telegram-chip.png", productSlug: "tg-premium-3", author: "Артем", date: "14 октября", color: "#22a55a" },
];

export const advantages = [
  { id: "safe", title: "Безопасные платежи", text: "Шифрование и проверенные платежные партнеры", icon: "/img/icons/shield.svg" },
  { id: "support", title: "Поддержка 24/7", text: "Отвечаем за пару минут - в чате и Telegram", icon: "/img/icons/headphones.svg" },
  { id: "refund", title: "Гарантия возврата", text: "Если что-то пошло не так - вернем деньги", icon: "/img/icons/refund.svg" },
];

export const footerColumns = [
  { title: "Покупателям", links: ["Каталог", "Пополнение Steam", "Бонусная программа", "Гарантии"] },
  { title: "Компания", links: ["О нас", "Блог", "Отзывы", "Стать продавцом"] },
  { title: "Помощь", links: ["Поддержка 24/7", "Доставка и оплата", "Условия возврата", "B2B"] },
];

export const supportQuickReplies = ["Не пришел товар", "Как пополнить Steam?", "Вернуть деньги", "Другое"];
