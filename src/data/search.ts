// Мок поиска (ТЗ 12.13-12.14): популярные запросы с числом результатов и товары.
// API: GET /search/suggest?q=…&limit=3

export type SearchProduct = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  image: string;
  game?: string;
  // в макете у части товаров вместо картинки - цветная «капля» с иконкой игры
  tint?: string;
};

export type SearchGame = { id: string; title: string; subtitle: string; logo: string; priceFrom: number; hit?: boolean };

export const searchQueries: { text: string; count: number }[] = [
  { text: "brawl pass plus", count: 1240 },
  { text: "brawl stars гемы", count: 860 },
  { text: "brawl stars скины", count: 310 },
  { text: "brawl stars", count: 2410 },
  { text: "brawl pass", count: 540 },
  { text: "steam 1000", count: 120 },
  { text: "steam пополнение", count: 980 },
  { text: "steam ключи", count: 2860 },
  { text: "telegram premium", count: 64 },
  { text: "telegram stars", count: 88 },
  { text: "pubg uc", count: 430 },
  { text: "pubg mobile", count: 610 },
  { text: "genshin impact", count: 390 },
  { text: "genshin кристаллы", count: 140 },
  { text: "mobile legends алмазы", count: 210 },
  { text: "honkai star rail", count: 175 },
  { text: "ps plus", count: 96 },
  { text: "playstation store", count: 150 },
  { text: "chatgpt plus", count: 22 },
  { text: "office 2024", count: 18 },
  { text: "windows 11", count: 35 },
];

const brawl = "/img/brands/brawl.png";

export const searchProducts: SearchProduct[] = [
  { id: "brawl-pass-plus", title: "Brawl Pass Plus", subtitle: "Новый сезон · Донат", price: 1044, image: "/img/brands/brawl-chip.png", game: brawl, tint: "#efe4ff" },
  { id: "brawl-360", title: "360 гемов Brawl Stars", subtitle: "Brawl Stars · Игровая валюта", price: 2190, image: brawl, game: brawl, tint: "#e1f5eb" },
  { id: "brawl-skin", title: "Скин «Ворон-Феникс»", subtitle: "Brawl Stars · Предметы", price: 1290, image: brawl, game: brawl, tint: "#fbe5e6" },
  { id: "steam-1000", title: "Пополнение Steam 1000 ₽", subtitle: "Steam · Пополнение", price: 1000, image: "/img/brands/steam.png" },
  { id: "steam-500", title: "Пополнение Steam 500 ₽", subtitle: "Steam · Пополнение", price: 500, image: "/img/brands/steam.png" },
  { id: "tg-premium", title: "Telegram Premium 3 мес.", subtitle: "Telegram · Подписки", price: 1290, image: "/img/brands/telegram.png" },
  { id: "tg-stars", title: "Telegram Stars 100", subtitle: "Telegram · Игровая валюта", price: 199, image: "/img/brands/telegram.png" },
  { id: "pubg-660", title: "660 UC PUBG Mobile", subtitle: "PUBG Mobile · Игровая валюта", price: 890, image: "/img/games/pubg.png" },
  { id: "genshin-980", title: "980 кристаллов Genshin", subtitle: "Genshin Impact · Донат", price: 1190, image: "/img/games/genshin.png" },
  { id: "mlbb-257", title: "257 алмазов Mobile Legends", subtitle: "Mobile Legends · Донат", price: 390, image: "/img/games/mlbb.png" },
  { id: "honkai-pass", title: "Экспресс-пропуск Honkai", subtitle: "Honkai: Star Rail · Донат", price: 449, image: "/img/games/honkai.png" },
  { id: "ps-plus", title: "PS Plus Essential 12 мес.", subtitle: "PlayStation · Подписки", price: 4990, image: "/img/brands/playstation.png" },
  { id: "chatgpt", title: "ChatGPT Plus 1 мес.", subtitle: "ChatGPT · Подписки", price: 1990, image: "/img/brands/chatgpt.png" },
  { id: "office-2024", title: "Office 2024 Pro Plus", subtitle: "Microsoft · Ключи", price: 1490, image: "/img/brands/windows.png" },
  { id: "windows-11", title: "Windows 11 Pro", subtitle: "Microsoft · Ключи", price: 990, image: "/img/brands/windows.png" },
];

// Для «Возможно, вы искали»
export const searchGames: SearchGame[] = [
  { id: "brawl", title: "Brawl Stars", subtitle: "Гемы, Pass", logo: brawl, priceFrom: 79, hit: true },
  { id: "brawl-skins", title: "Brawl Stars: скины", subtitle: "Предметы", logo: brawl, priceFrom: 149 },
  { id: "steam", title: "Steam", subtitle: "Пополнение, ключи", logo: "/img/brands/steam.png", priceFrom: 100, hit: true },
  { id: "telegram", title: "Telegram", subtitle: "Premium, Stars", logo: "/img/brands/telegram.png", priceFrom: 99 },
  { id: "pubg", title: "PUBG Mobile", subtitle: "UC", logo: "/img/games/pubg.png", priceFrom: 89 },
  { id: "genshin", title: "Genshin Impact", subtitle: "Кристаллы", logo: "/img/games/genshin.png", priceFrom: 79 },
  { id: "mlbb", title: "Mobile Legends", subtitle: "Алмазы", logo: "/img/games/mlbb.png", priceFrom: 59 },
  { id: "honkai", title: "Honkai: Star Rail", subtitle: "Сверхсилы", logo: "/img/games/honkai.png", priceFrom: 99 },
  { id: "playstation", title: "PlayStation", subtitle: "PS Plus, игры", logo: "/img/brands/playstation.png", priceFrom: 499 },
  { id: "chatgpt", title: "ChatGPT", subtitle: "Plus", logo: "/img/brands/chatgpt.png", priceFrom: 1990 },
];
