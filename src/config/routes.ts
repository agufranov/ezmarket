// Все переходы в одном месте. Точные URL заказчик пришлет позже - пока "#".
export const routes = {
  home: "/",
  search: "#",
  catalog: "#",
  steamTopUp: "#",
  promo: "#",
  hits: "#",
  recommended: "#",
  blog: "#",
  reviews: "#",
  product: (_slug: string) => "#",
  article: (_slug: string) => "#",
  category: (_slug: string) => "#",
  page: (_slug: string) => "#",
  privacy: "#",
  terms: "#",
  telegramSupport: "https://t.me/",
  phone: "tel:88005553535",
} as const;

export const socials = [
  { id: "vk", label: "ВКонтакте", href: "https://vk.com/" },
  { id: "telegram", label: "Telegram", href: "https://t.me/" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/" },
  { id: "youtube", label: "YouTube", href: "https://www.youtube.com/" },
] as const;
