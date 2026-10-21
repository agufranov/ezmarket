import { routes } from "./routes";

// Вход по коду из письма (ТЗ 12.7-12.8)
export const auth = {
  termsUrl: routes.terms,
} as const;

// Порядок - как в макете. url - позже, пока заглушка
export const authProviders = [
  { id: "yandex", label: "Яндекс", url: "#" },
  { id: "vk", label: "VK", url: "#" },
  { id: "telegram", label: "Telegram", url: "#" },
  { id: "google", label: "Google", url: "#" },
  { id: "steam", label: "Steam", url: "#" },
] as const;

export type AuthProviderId = (typeof authProviders)[number]["id"];
