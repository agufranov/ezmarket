import type { Metadata } from "next";
import { OrdersPage } from "@/components/orders/OrdersPage";

export const metadata: Metadata = { title: "Мои заказы - EzMarket" };

export default function Page() {
  return <OrdersPage />;
}
