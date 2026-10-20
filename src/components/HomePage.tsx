"use client";

import { useState } from "react";
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

export function HomePage() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <ModalProvider>
      <Header onHelp={() => setSupportOpen(true)} />
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
      <SupportWidget open={supportOpen} onToggle={setSupportOpen} />
    </ModalProvider>
  );
}
