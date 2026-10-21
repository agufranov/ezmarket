"use client";

import { AuthProvider } from "@/lib/auth";
import { ModalProvider } from "@/lib/modal";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { SteamBar } from "./sections/SteamBar";
import { Hits } from "./sections/Hits";
import { BonusBar } from "./sections/BonusBar";
import { Recommend } from "./sections/Recommend";
import { Articles } from "./sections/Articles";
import { Reviews } from "./sections/Reviews";
import { Advantages } from "./sections/Advantages";
import { Footer } from "./sections/Footer";
import { SupportWidget } from "./sections/SupportWidget";
import s from "./HomePage.module.scss";

// Поддержка по новому сценарию 12.16-12.20 - следующим шагом; пока кнопки ничего не открывают
const openSupport = () => console.log("[support] open");

export function HomePage() {
  return (
    <AuthProvider>
      <ModalProvider>
        <Header onHelp={openSupport} />
        <main className={`container ${s.main}`}>
          <Hero />
          <SteamBar />
          <Hits />
          <BonusBar />
          <Recommend />
          <Articles />
          <Reviews />
          <Advantages />
          <Footer />
        </main>
        <SupportWidget onOpen={openSupport} />
      </ModalProvider>
    </AuthProvider>
  );
}
