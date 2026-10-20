// Моковые данные главной. Позже заменяются ответами API с той же формой.

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

export const heroSlides = [
  {
    id: "steam",
    badge: "Без комиссии",
    title: ["Пополняй Steam", "за минуту"],
    text: "Любая сумма от 100 ₽ · скидка 5% на первое пополнение",
    cta: "Пополнить",
  },
  {
    id: "keys",
    badge: "Скидки до −50%",
    title: ["Ключи игр", "по лучшей цене"],
    text: "Мгновенная выдача после оплаты · гарантия активации",
    cta: "Смотреть",
  },
  {
    id: "donate",
    badge: "Без комиссии",
    title: ["Донат в игры", "по ID"],
    text: "PUBG, Genshin, Mobile Legends и еще 40+ игр",
    cta: "Выбрать игру",
  },
];

export const sideBanners = [
  { id: "ps", label: "PlayStation", title: ["PS Plus до", "−40%"], icon: "/img/brands/playstation.png", theme: "dark" as const },
  { id: "tg", label: "Telegram", title: ["Stars и", "Premium"], icon: "/img/brands/telegram.png", theme: "peach" as const },
];
