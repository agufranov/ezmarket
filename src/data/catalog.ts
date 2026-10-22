// Мок меню каталога (ТЗ 12.15). Сайдбар каталога и строка категорий под шапкой - разные списки.
// API: GET /catalog/menu

export type CatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  logo: string;
  priceFrom: number;
  // светлый круг под логотипом, как в макете
  tint?: string;
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
  clash: "/img/games/clash.png",
  // логотипы карточек каталога - кадры из макета (в карточках хитов другие арты)
  catGenshin: "/img/games/cat-genshin.png",
  catPubg: "/img/games/cat-pubg.png",
  catMlbb: "/img/games/cat-mlbb.png",
  roblox: "/img/games/roblox.png",
  steam: "/img/brands/steam.png",
  ps: "/img/brands/playstation.png",
  tg: "/img/brands/telegram.png",
  gpt: "/img/brands/chatgpt.png",
  win: "/img/brands/windows.png",
  apple: "/img/brands/appstore.png",
};

const donate: CatalogItem[] = [
  { id: "brawl", title: "Brawl Stars", subtitle: "Гемы, Pass", logo: g.brawl, priceFrom: 79, badge: { kind: "hit" }, tint: "#ece0ff" },
  { id: "pubg", title: "PUBG Mobile", subtitle: "UC", logo: g.catPubg, priceFrom: 89, tint: "#fbf1df" },
  { id: "genshin", title: "Genshin Impact", subtitle: "Кристаллы", logo: g.catGenshin, priceFrom: 79, badge: { kind: "discount", value: 10 }, tint: "#e2f0f9" },
  { id: "mlbb", title: "Mobile Legends", subtitle: "Алмазы", logo: g.catMlbb, priceFrom: 59, tint: "#e0e8f9" },
  { id: "clash", title: "Clash of Clans", subtitle: "Гемы", logo: g.clash, priceFrom: 99, tint: "#fbf3dd" },
  { id: "roblox", title: "Roblox", subtitle: "Робуксы", logo: g.roblox, priceFrom: 99, badge: { kind: "discount", value: 15 }, tint: "#dfecff" },
  { id: "steam", title: "Steam", subtitle: "Пополнение", logo: g.steam, priceFrom: 100, tint: "#dde2e5" },
  { id: "ps", title: "PlayStation", subtitle: "PS Plus", logo: g.ps, priceFrom: 499, tint: "#d8e4f6" },
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
    { id: "currency", title: "Игровая валюта", icon: "/img/icons/coin.svg", count: 640, items: donate.slice(0, 6), quick: quickDonate },
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
