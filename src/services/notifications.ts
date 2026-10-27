// Уведомления колокольчика (server/src/notifications); без API - моки из src/data/user.ts.
// GET /notifications -> { unread, items } - свои, новые сверху (до 50); unread - по всем непрочитанным
// POST /notifications/read { ids } и POST /notifications/read-all -> { unread }
import type { AppNotification } from "@/data/user";
import { api } from "./api";

type NotificationDto = Pick<AppNotification, "id" | "type" | "text" | "read"> & { icon: "steam" | "coin"; orderId: string | null; at: string };

// значки как в макете: заказ пополнения - логотип Steam, бонусы - монета
const ICONS: Record<NotificationDto["icon"], string> = { steam: "/img/brands/steam.png", coin: "coin" };

const toApp = (n: NotificationDto, now: number): AppNotification => ({
  id: n.id,
  type: n.type,
  text: n.text,
  icon: ICONS[n.icon] ?? "coin",
  minutesAgo: Math.max(0, Math.floor((now - Date.parse(n.at)) / 60_000)),
  read: n.read,
});

export async function listNotifications(): Promise<{ unread: number; items: AppNotification[] }> {
  const r = await api<{ unread: number; items: NotificationDto[] }>("/notifications");
  const now = Date.now();
  return { unread: r.unread, items: r.items.map((n) => toApp(n, now)) };
}

export const markNotificationsRead = (ids: string[]) => api<{ unread: number }>("/notifications/read", { body: { ids } });
export const markAllNotificationsRead = () => api<{ unread: number }>("/notifications/read-all", { method: "POST" });
