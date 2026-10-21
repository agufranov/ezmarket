"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { footerColumns } from "@/data/mocks";
import { routes, socials } from "@/config/routes";
import { useModal } from "@/lib/modal";
import { socialPaths } from "@/components/ui/socialPaths";
import { Mascot } from "@/components/ui/Mascot";
import { Icon } from "@/components/ui/Icon";
import s from "./Footer.module.scss";

export function Footer() {
  const { openModal } = useModal();
  // На мобильных колонки ссылок свернуты в аккордеон, на остальных всегда раскрыты
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <footer className={s.footer}>
      <div className={s.top}>
        <div className={s.brand}>
          <a href={routes.home} aria-label="EzMarket - на главную" className={s.logo}>
            <Image src="/img/logo.png" alt="EzMarket" width={164} height={44} />
          </a>
          <p className={s.about}>Маркетплейс цифровых товаров: игры, подписки, пополнения</p>
          <ul className={s.socials}>
            {socials.map((soc) => (
              <li key={soc.id}>
                <a href={soc.href} target="_blank" rel="noopener noreferrer" aria-label={soc.label} className={s.social}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={socialPaths[soc.id]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {footerColumns.map((col) => (
          <details key={`${col.title}-${compact}`} className={s.col} open={!compact}>
            <summary className={s.colTitle}>{col.title}</summary>
            <ul className={s.links}>
              {col.links.map((l) => (
                <li key={l}>
                  <a href={routes.page(l)}>{l}</a>
                </li>
              ))}
            </ul>
          </details>
        ))}

        <div className={s.bonus}>
          <Mascot size={64} sideHand float floatDuration={3.4} className={s.bonusMascot} />
          <div className={s.bonusBody}>
            <p className={s.bonusTitle}>+50 бонусов</p>
            <p className={s.bonusText}>за вход на сайт</p>
            <button type="button" className={s.bonusBtn} onClick={() => openModal("login")}>
              Войти и забрать
              <span className={s.bonusArrow} aria-hidden>
                <Icon src="/img/icons/arrow-white.svg" width={7} height={11} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={s.bottom}>
        <p>© 2026 EzMarket · Neurovexis L.L.C-FZ</p>
        <nav className={s.legal} aria-label="Документы">
          <a href={routes.privacy}>Политика конфиденциальности</a>
          <a href={routes.terms}>Пользовательское соглашение</a>
        </nav>
      </div>
    </footer>
  );
}
