"use client";

import { useEffect } from "react";
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
import { SupportProvider } from "./support/Support";
import s from "./HomePage.module.scss";

export function HomePage() {
  // в скрытой вкладке бесконечные анимации на паузе (слайдер останавливается сам)
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <AuthProvider>
      <ModalProvider>
        <SupportProvider>
          <Header />
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
        </SupportProvider>
      </ModalProvider>
    </AuthProvider>
  );
}
