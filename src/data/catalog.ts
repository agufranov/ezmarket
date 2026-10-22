// Мок меню каталога (ТЗ 12.15). Сайдбар каталога и строка категорий под шапкой - разные списки.
// API: GET /catalog/menu

export type CatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  logo: string;
  priceFrom: number;
  badge?: { kind: "hit" } | { kind: "discount"; value: number };
};

export type CatalogCategory = {
  id: string;
  title: string;
  icon: string;
  count: number;
  items: CatalogItem[];
  quick: { id: string; title: string; logo: string; priceFrom: number }[];
};

const g = {
  brawl: "/img/brands/brawl.png",
  pubg: "/img/games/pubg.png",
  genshin: "/img/games/genshin.png",
  mlbb: "/img/games/mlbb.png",
  honkai: "/img/games/honkai.png",
  steam: "/img/brands/steam.png",
  ps: "/img/brands/playstation.png",
  tg: "/img/brands/telegram.png",
  gpt: "/img/brands/chatgpt.png",
  win: "/img/brands/windows.png",
  apple: "/img/brands/appstore.png",
};

const donate: CatalogItem[] = [
  { id: "brawl", title: "Brawl Stars", subtitle: "Гемы, Pass", logo: g.brawl, priceFrom: 79, badge: { kind: "hit" } },
  { id: "pubg", title: "PUBG Mobile", subtitle: "UC", logo: g.pubg, priceFrom: 89 },
  { id: "genshin", title: "Genshin Impact", subtitle: "Кристаллы", logo: g.genshin, priceFrom: 79, badge: { kind: "discount", value: 10 } },
  { id: "mlbb", title: "Mobile Legends", subtitle: "Алмазы", logo: g.mlbb, priceFrom: 59 },
  { id: "honkai", title: "Honkai: Star Rail", subtitle: "Сверхсилы", logo: g.honkai, priceFrom: 99 },
  { id: "tg-stars", title: "Telegram", subtitle: "Stars", logo: g.tg, priceFrom: 99, badge: { kind: "discount", value: 15 } },
  { id: "steam", title: "Steam", subtitle: "Пополнение", logo: g.steam, priceFrom: 100 },
  { id: "ps", title: "PlayStation", subtitle: "PS Plus", logo: g.ps, priceFrom: 499 },
];

const subs: CatalogItem[] = [
  { id: "ps-plus", title: "PS Plus", subtitle: "Essential, Extra", logo: g.ps, priceFrom: 499, badge: { kind: "discount", value: 40 } },
  { id: "chatgpt", title: "ChatGPT Plus", subtitle: "1 месяц", logo: g.gpt, priceFrom: 1990, badge: { kind: "discount", value: 15 } },
  { id: "tg-premium", title: "Telegram Premium", subtitle: "3, 6, 12 месяцев", logo: g.tg, priceFrom: 299, badge: { kind: "hit" } },
  { id: "apple", title: "Apple", subtitle: "iCloud+, Music", logo: g.apple, priceFrom: 149 },
  { id: "xbox", title: "Xbox Game Pass", subtitle: "Ultimate", logo: g.win, priceFrom: 899 },
  { id: "steam-sub", title: "Steam", subtitle: "Подарочные карты", logo: g.steam, priceFrom: 100 },
];

const keys: CatalogItem[] = [
  { id: "steam-keys", title: "Steam", subtitle: "Ключи игр", logo: g.steam, priceFrom: 149, badge: { kind: "hit" } },
  { id: "win-keys", title: "Windows", subtitle: "Ключи активации", logo: g.win, priceFrom: 990 },
  { id: "ps-keys", title: "PlayStation", subtitle: "Игры и DLC", logo: g.ps, priceFrom: 1290, badge: { kind: "discount", value: 20 } },
  { id: "honkai-keys", title: "Honkai: Star Rail", subtitle: "Наборы", logo: g.honkai, priceFrom: 399 },
];

const quickDonate = [
  { id: "q-brawl", title: "Гемы Brawl Stars", logo: g.brawl, priceFrom: 79 },
  { id: "q-pubg", title: "UC PUBG", logo: g.pubg, priceFrom: 89 },
];

export const catalogMenu: { categories: CatalogCategory[]; promo: { title: string; subtitle: string; logos: string[]; items: { id: string; title: string; logo: string; discount: number }[] } } = {
  categories: [
    { id: "donate", title: "Донат", icon: "/img/icons/cat-donate.svg", count: 1240, items: donate, quick: quickDonate },
    { id: "subs", title: "Подписки", icon: "/img/icons/cat-subs.svg", count: 312, items: subs, quick: [] },
    { id: "keys", title: "Ключи", icon: "/img/icons/cat-keys.svg", count: 2860, items: keys, quick: [] },
    { id: "currency", title: "Игровая валюта", icon: "/img/icons/cat-coin.svg", count: 640, items: donate.slice(0, 6), quick: quickDonate },
    { id: "items", title: "Предметы", icon: "/img/icons/cat-skins.svg", count: 0, items: [], quick: [] },
    { id: "accounts", title: "Аккаунты", icon: "/img/icons/cat-accounts.svg", count: 0, items: [], quick: [] },
    { id: "gifts", title: "Подарочные карты", icon: "/img/icons/cat-gifts.svg", count: 128, items: subs.slice(3), quick: [] },
    { id: "services", title: "Услуги", icon: "/img/icons/sparkle.svg", count: 0, items: [], quick: [] },
  ],
  promo: {
    title: "Подписки недели",
    subtitle: "Скидки до -40%",
    logos: ["/img/brands/playstation-sq.png", g.gpt, "/img/brands/telegram-sq.png"],
    items: [
      { id: "ps-plus", title: "PS Plus", logo: g.ps, discount: 40 },
      { id: "chatgpt", title: "ChatGPT Plus", logo: g.gpt, discount: 15 },
      { id: "tg-premium", title: "Telegram Premium", logo: g.tg, discount: 10 },
    ],
  },
};
