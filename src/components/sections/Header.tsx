"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { categories } from "@/data/mocks";
import { routes } from "@/config/routes";
import { currencies, loadCurrency, saveCurrency, type Currency } from "@/config/currencies";
import { useModal } from "@/lib/modal";
import { Icon } from "@/components/ui/Icon";
import { MaskIcon } from "@/components/ui/MaskIcon";
import s from "./Header.module.scss";

type Props = { onHelp: () => void };

export function Header({ onHelp }: Props) {
  const { openModal, current: modalOpen } = useModal();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>(currencies[0]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const currencyBtnRef = useRef<HTMLButtonElement>(null);
  const currencyPanelRef = useRef<HTMLDivElement>(null);
  const [noseRight, setNoseRight] = useState(0);

  useEffect(() => setCurrency(loadCurrency()), []);

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

  // Попап валюты (ТЗ 12.6): закрытие по клику вне (pointerdown вне панели и чипа), Esc, Tab наружу,
  // ресайзу через 1024 и при открытии модалки
  useEffect(() => {
    if (!currencyOpen) return;
    const inside = (n: EventTarget | null) =>
      currencyPanelRef.current?.contains(n as Node) || currencyBtnRef.current?.contains(n as Node);
    const place = () => {
      const row = rowRef.current?.getBoundingClientRect();
      const btn = currencyBtnRef.current?.getBoundingClientRect();
      if (row && btn) setNoseRight(row.right - (btn.left + btn.width / 2));
    };
    place();
    const onDown = (e: PointerEvent) => !inside(e.target) && setCurrencyOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCurrencyOpen(false);
        currencyBtnRef.current?.focus();
      }
    };
    const onFocus = (e: FocusEvent) => !inside(e.target) && setCurrencyOpen(false);
    const mq = window.matchMedia("(max-width: 1023px)");
    const onBp = () => setCurrencyOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    window.addEventListener("resize", place);
    mq.addEventListener("change", onBp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("resize", place);
      mq.removeEventListener("change", onBp);
    };
  }, [currencyOpen]);

  useEffect(() => {
    if (modalOpen) setCurrencyOpen(false);
  }, [modalOpen]);

  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    saveCurrency(c);
    // даем увидеть галочку, потом закрываем
    window.setTimeout(() => {
      setCurrencyOpen(false);
      currencyBtnRef.current?.focus();
    }, 150);
  };

  return (
    <header className={s.header}>
      <div className={s.top}>
        <div className={`container ${s.row}`} ref={rowRef}>
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

          <button
            ref={currencyBtnRef}
            type="button"
            className={s.currencyBtn}
            aria-haspopup="listbox"
            aria-expanded={currencyOpen}
            aria-controls="currency-popover"
            aria-label={`Валюта: ${currency.name}`}
            onClick={(e) => {
              const opening = !currencyOpen;
              setCurrencyOpen(opening);
              // открыли с клавиатуры (detail 0) - фокус на выбранную валюту
              if (opening && e.detail === 0) requestAnimationFrame(() => currencyPanelRef.current?.querySelector<HTMLElement>("[aria-selected=true]")?.focus());
            }}
          >
            <span className={s.currencyDrop}>{currency.symbol}</span>
            <Icon src="/img/icons/chevron-down.svg" width={12} height={8} className={s.chevron} />
          </button>
          <div
            id="currency-popover"
            ref={currencyPanelRef}
            className={s.popover}
            data-open={currencyOpen || undefined}
            style={{ ["--nose-right" as string]: `${noseRight}px` }}
          >
            <p className={s.popTitle} id="currency-title">
              Валюта
            </p>
            <div role="listbox" aria-labelledby="currency-title" className={s.curList}>
              {currencies
                .filter((c) => c.enabled)
                .map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={c.code === currency.code}
                    tabIndex={currencyOpen ? 0 : -1}
                    className={s.curRow}
                    onClick={() => pickCurrency(c)}
                  >
                    <span className={s.currencyDrop}>{c.symbol}</span>
                    <span className={s.curName}>
                      {c.name}
                      <small>{c.code}</small>
                    </span>
                    {c.code === currency.code && (
                      <span className={s.curCheck} aria-hidden>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
            </div>
            <div className={s.curSoon}>
              {currencies
                .filter((c) => !c.enabled)
                .map((c) => (
                  <span key={c.code} className={s.curOff} role="img" aria-label={`${c.name}, скоро`}>
                    {c.symbol}
                    <span className={s.curTip} aria-hidden>
                      Скоро
                    </span>
                  </span>
                ))}
              <span className={s.curSoonText}>скоро</span>
            </div>
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
