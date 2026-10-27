// Мок пользователя и уведомлений (ТЗ 12.4, 12.10, 12.11) - когда сайт без API (GitHub Pages).
// API: GET /me, GET /notifications (src/services/notifications.ts)

export type User = {
  name: string;
  email: string;
  avatarUrl?: string;
  bonuses: number;
  counters: { orders: number; referrals: number };
};

export const mockUser: User = {
  name: "Алексей",
  email: "alex@mail.ru",
  bonuses: 340,
  counters: { orders: 12, referrals: 3 },
};

export type NotificationType = "order" | "bonus" | "referral" | "promo";

export type AppNotification = {
  id: string;
  type: NotificationType;
  // жирные части - отдельными кусками, без HTML из данных
  text: { t: string; b?: boolean }[];
  icon: string | "coin";
  minutesAgo: number;
  read: boolean;
};

export const mockNotifications: AppNotification[] = [
  {
    id: "n1",
    type: "order",
    text: [{ t: "Заказ выполнен - " }, { t: "Brawl Pass Plus", b: true }, { t: " уже на аккаунте" }],
    icon: "/img/brands/brawl.png",
    minutesAgo: 5,
    read: false,
  },
  {
    id: "n2",
    type: "bonus",
    text: [{ t: "Начислено " }, { t: "+31 бонус", b: true }, { t: " за покупку" }],
    icon: "coin",
    minutesAgo: 5,
    read: false,
  },
  {
    id: "n3",
    type: "promo",
    text: [{ t: "PS Plus Essential", b: true }, { t: " со скидкой 17% - до воскресенья" }],
    icon: "/img/brands/playstation.png",
    minutesAgo: 120,
    read: false,
  },
  {
    id: "n4",
    type: "order",
    text: [{ t: "Steam пополнен на " }, { t: "1 000 ₽", b: true }],
    icon: "/img/brands/steam.png",
    minutesAgo: 60 * 26,
    read: true,
  },
];
