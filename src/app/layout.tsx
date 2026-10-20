import type { Metadata, Viewport } from "next";
// Nunito статичными начертаниями (а не вариативным файлом): одинаково рисуется во всех движках,
// включая WebKit без поддержки font-variations. Подмножества грузятся по unicode-range.
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: "EzMarket - маркетплейс цифровых товаров для геймеров",
  description: "Пополнение Steam, ключи игр, подписки, донат и игровая валюта",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
