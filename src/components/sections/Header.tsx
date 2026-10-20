"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { categories } from "@/data/mocks";
import { routes } from "@/config/routes";
import { site } from "@/config/site";
import { useModal } from "@/lib/modal";
import { Icon } from "@/components/ui/Icon";
import { MaskIcon } from "@/components/ui/MaskIcon";
import s from "./Header.module.scss";

type Props = { onHelp: () => void };

export function Header({ onHelp }: Props) {
  const { openModal } = useModal();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [currency, setCurrency] = useState<(typeof site.headerCurrencies)[number]>(site.headerCurrencies[0]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  // "/" ставит фокус в поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!currencyOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!currencyRef.current?.contains(e.target as Node)) setCurrencyOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCurrencyOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [currencyOpen]);

  return (
    <header className={s.header}>
      <div className={s.top}>
        <div className={`container ${s.row}`}>
          <a href={routes.home} className={s.logo} aria-label="EzMarket - на главную">
            <Image src="/img/logo.png" alt="EzMarket" width={164} height={44} priority />
          </a>

          <button
            type="button"
            className={s.catalog}
            aria-pressed={catalogOpen}
            onClick={() => setCatalogOpen((v) => !v)}
          >
            <span className={s.dots} aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className={s.catalogText}>Каталог</span>
          </button>

          <form
            className={s.search}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              console.log("[search]", searchRef.current?.value);
            }}
          >
            <Icon src="/img/icons/search.svg" size={20} />
            <label htmlFor="site-search" className="visually-hidden">
              Поиск
            </label>
            <input
              id="site-search"
              ref={searchRef}
              type="search"
              placeholder="Найти товар, игру или сервис"
              autoComplete="off"
            />
            <kbd className={s.kbd}>/</kbd>
          </form>

          <div className={s.currency} ref={currencyRef}>
            <button
              type="button"
              className={s.currencyBtn}
              aria-haspopup="listbox"
              aria-expanded={currencyOpen}
              aria-label={`Валюта: ${currency.label}`}
              onClick={() => setCurrencyOpen((v) => !v)}
            >
              <span className={s.currencyDrop}>{currency.symbol}</span>
              <Icon src="/img/icons/chevron-down.svg" width={12} height={8} className={s.chevron} />
            </button>
            <ul className={s.dropdown} role="listbox" data-open={currencyOpen || undefined}>
              {site.headerCurrencies.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === currency.id}
                    tabIndex={currencyOpen ? 0 : -1}
                    onClick={() => {
                      setCurrency(c);
                      setCurrencyOpen(false);
                    }}
                  >
                    <b>{c.symbol}</b> {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button type="button" className={s.login} onClick={() => openModal("login")}>
            <span className={s.loginText}>Войти</span>
            <span className={s.loginArrow} aria-hidden>
              <Icon src="/img/icons/arrow-login.svg" width={8} height={12} />
            </span>
          </button>
        </div>
      </div>

      <nav className={s.nav} aria-label="Категории">
        <div className={`container ${s.navRow}`}>
          <ul className={s.cats}>
            {categories.map((c, i) => (
              <li key={c.id}>
                <a
                  href={routes.category(c.id)}
                  className={[s.cat, i === 0 && s.catActive, c.accent && s.catAccent].filter(Boolean).join(" ")}
                  aria-current={i === 0 ? "page" : undefined}
                >
                  <MaskIcon src={c.icon} size={16} />
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" className={s.help} onClick={onHelp}>
            <MaskIcon src="/img/icons/cat-help.svg" size={16} />
            Помощь
            <span className={s.tooltip} role="tooltip">
              Поддержка онлайн 24/7 · ответ 1 мин
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}
