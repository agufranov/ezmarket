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
import { SupportProvider } from "./support/Support";
import s from "./HomePage.module.scss";

export function HomePage() {
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
