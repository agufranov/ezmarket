"use client";

/* eslint-disable @next/next/no-img-element -- маленькие логотипы в меню, next/image тут не нужен */
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { catalogMenu, type CatalogItem } from "@/data/catalog";
import { routes } from "@/config/routes";
import { asset } from "@/lib/asset";
import { formatPrice } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { MaskIcon } from "@/components/ui/MaskIcon";
import s from "./CatalogMenu.module.scss";

type Props = { open: boolean; onClose: (returnFocus?: boolean) => void; triggerRef: RefObject<HTMLButtonElement | null> };

const HOVER_DELAY = 150;
const KEY = "ez_catalog_cat";

// Каталог (ТЗ 12.15): слева категории с hover intent, справа товары категории и промо подписок
export function CatalogMenu({ open, onClose, triggerRef }: Props) {
  const { categories, promo } = catalogMenu;
  const [activeId, setActiveId] = useState(categories[0].id);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved && categories.some((c) => c.id === saved)) setActiveId(saved);
    } catch {}
  }, [categories]);

  const activate = (id: string) => {
    setActiveId(id);
    try {
      sessionStorage.setItem(KEY, id);
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    const inside = (n: EventTarget | null) =>
      panelRef.current?.contains(n as Node) || triggerRef.current?.contains(n as Node);
    const onDown = (e: PointerEvent) => !inside(e.target) && onClose();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose(true);
    const onFocus = (e: FocusEvent) => !inside(e.target) && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      window.clearTimeout(hoverTimer.current);
    };
  }, [open, onClose, triggerRef]);

  const onSideKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("a"));
    const i = links.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      links[(n + links.length) % links.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    if (e.key === "ArrowUp") go(i - 1);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      panelRef.current?.querySelector<HTMLElement>(`.${s.content} a`)?.focus();
    }
  };

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <div
      ref={panelRef}
      id="catalog-menu"
      className={s.panel}
      data-open={open || undefined}
      // ← из сетки возвращает в сайдбар
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && (e.target as HTMLElement).closest(`.${s.content}`)) {
          e.preventDefault();
          panelRef.current?.querySelector<HTMLElement>(`.${s.side} [data-active]`)?.focus();
        }
      }}
      onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}
    >
      {/* мобильный макет: лист на весь экран с заголовком и крестиком */}
      <div className={s.mHead}>
        <b>Каталог</b>
        <button type="button" className={s.mClose} aria-label="Закрыть каталог" tabIndex={open ? 0 : -1} onClick={() => onClose(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <ul className={s.side} role="menu" aria-label="Категории каталога" onKeyDown={onSideKey}>
        {categories.map((c) => (
          <li key={c.id} role="none">
            <a
              href={routes.category(c.id)}
              role="menuitem"
              tabIndex={open ? 0 : -1}
              className={s.cat}
              data-active={c.id === active.id || undefined}
              onPointerEnter={() => {
                window.clearTimeout(hoverTimer.current);
                hoverTimer.current = window.setTimeout(() => activate(c.id), HOVER_DELAY);
              }}
              onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
              onFocus={() => activate(c.id)}
              onClick={(e) => {
                // на мобилке тап по категории переключает список (наведения нет), а не уходит со страницы
                if (!window.matchMedia("(max-width: 767px)").matches) return;
                e.preventDefault();
                e.stopPropagation();
                activate(c.id);
              }}
            >
              <span className={s.catIcon}>
                {/* монетка в макете цветная - не перекрашиваем */}
                {c.icon.endsWith("/coin.svg") ? <Icon src={c.icon} size={17} /> : <MaskIcon src={c.icon} size={20} />}
              </span>
              {c.title}
            </a>
          </li>
        ))}
      </ul>

      <div key={active.id} className={s.content}>
        <div className={s.head}>
          <span className={s.headIcon}>
            {active.icon.endsWith("/coin.svg") ? <Icon src={active.icon} size={18} /> : <MaskIcon src={active.icon} size={18} />}
          </span>
          <h2 className={s.title}>{active.title}</h2>
          {active.count > 0 && <span className={s.count}>{active.count.toLocaleString("ru-RU")} товаров</span>}
          <span className={s.sparks} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <a href={routes.category(active.id)} className={s.all} tabIndex={open ? 0 : -1}>
            Смотреть все
            <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden>
              <path d="M1.5 1 6 5.5 1.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {active.items.length ? (
          <ul className={s.grid}>
            {active.items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <Card item={item} tabbable={open} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>Скоро здесь появятся товары</p>
        )}

        {/* в мобильном макете «Смотреть все» - кнопка под списком */}
        <a href={routes.category(active.id)} className={s.allMobile} tabIndex={open ? 0 : -1}>
          Смотреть все
          <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden>
            <path d="M1.5 1 6 5.5 1.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        {active.quick.length > 0 && (
          <ul className={s.quick}>
            {active.quick.slice(0, 2).map((q) => (
              <li key={q.id}>
                <a href={routes.product(q.id)} className={s.quickLink} tabIndex={open ? 0 : -1}>
                  <img src={asset(q.logo)} alt="" width={30} height={30} />
                  {q.title}
                  <b>от {formatPrice(q.priceFrom)}</b>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={s.promo}>
        <a href={routes.promo} className={s.promoHead} tabIndex={open ? 0 : -1}>
          <span className={s.promoLabel}>{promo.title}</span>
          <b className={s.promoTitle}>{promo.subtitle.replace(" ", "\n")}</b>
          <span className={s.promoLogos} aria-hidden>
            {promo.logos.map((l) => (
              <img key={l} src={asset(l)} alt="" width={60} height={60} />
            ))}
          </span>
        </a>
        <ul className={s.promoList}>
          {promo.items.map((p) => (
            <li key={p.id}>
              <a href={routes.product(p.id)} className={s.promoRow} tabIndex={open ? 0 : -1}>
                <img src={asset(p.logo)} alt="" width={30} height={30} />
                <span>{p.title}</span>
                <b>−{p.discount}%</b>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Card({ item, tabbable }: { item: CatalogItem; tabbable: boolean }) {
  return (
    <a href={routes.product(item.id)} className={s.card} tabIndex={tabbable ? 0 : -1}>
      <span className={s.logoWrap} style={{ background: item.tint }}>
        <img src={asset(item.logo)} alt="" width={50} height={50} className={s.logo} />
      </span>
      <span className={s.cardText}>
        <b>{item.title}</b>
        <span className={s.cardSub}>
          <span className={s.subText}>{item.subtitle}</span>
          {item.badge?.kind === "hit" && (
            <span className={s.hit}>
              <MaskIcon src="/img/icons/fire.svg" size="var(--hit-icon)" />
              хит
            </span>
          )}
          {item.badge?.kind === "discount" && <span className={s.discount}>−{item.badge.value}%</span>}
        </span>
      </span>
      <span className={s.price}>
        <small>от</small>
        {formatPrice(item.priceFrom)}
      </span>
    </a>
  );
}
