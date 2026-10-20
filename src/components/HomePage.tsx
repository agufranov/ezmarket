"use client";

import { ModalProvider } from "@/lib/modal";
import { Header } from "./sections/Header";
import s from "./HomePage.module.scss";

export function HomePage() {
  return (
    <ModalProvider>
      {/* "Помощь" откроет чат поддержки, когда появится виджет */}
      <Header onHelp={() => console.log("[support] open")} />
      <main className={`container ${s.main}`} />
    </ModalProvider>
  );
}
