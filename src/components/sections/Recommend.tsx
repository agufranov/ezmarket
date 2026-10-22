"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getRecommended, recommendTabs, type Product, type TabId } from "@/data/mocks";
import { routes } from "@/config/routes";
import { site } from "@/config/site";
import { Icon } from "@/components/ui/Icon";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Mascot } from "@/components/ui/Mascot";
import { MoreLink } from "@/components/ui/MoreLink";
import { ProductCard } from "@/components/ui/ProductCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import s from "./Recommend.module.scss";

const { pageSize, maxItems, loaderDelayMs } = site.recommended;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Recommend() {
  const [tab, setTab] = useState<TabId>("games");
  const [items, setItems] = useState<Product[]>(() => getRecommended("games", 0, pageSize));
  const [loading, setLoading] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length < maxItems;
  const tabLabel = recommendTabs.find((t) => t.id === tab)?.label ?? "";

  // Подчеркивание переезжает под активную вкладку
  const measure = useCallback(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el) setIndicator({ x: el.offsetLeft + 10, w: el.offsetWidth - 20 });
  }, []);

  useIsoLayoutEffect(() => {
    measure();
    // активная вкладка прокручивается в видимую область (только по горизонтали, страницу не дергаем)
    const box = tabsRef.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (box && el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [tab, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const selectTab = (id: TabId) => {
    if (id === tab) return;
    setTab(id);
    setItems(getRecommended(id, 0, pageSize));
    setFadeKey((k) => k + 1);
  };

  // Подгрузка при доскролле до конца сетки
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoading(true);
        window.setTimeout(() => {
          setItems((prev) => [...prev, ...getRecommended(tab, prev.length, pageSize)]);
          setLoading(false);
        }, loaderDelayMs);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, hasMore, loading]);

  return (
    <section className={s.panel} aria-labelledby="rec-title">
      <div className={s.head}>
        <span className={s.drop} aria-hidden>
          <Icon src="/img/icons/sparkle.svg" size={20} />
        </span>
        <h2 id="rec-title" className={s.title}>
          Рекомендуем вам
        </h2>
        <MoreLink href={routes.recommended} variant="plain" className={s.moreMobile}>
          Смотреть все
        </MoreLink>
      </div>

      <div className={s.tabsRow}>
        <div className={s.tabs} role="tablist" aria-label="Категории рекомендаций" ref={tabsRef}>
          {recommendTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              aria-controls="rec-grid"
              className={s.tab}
              onClick={() => selectTab(t.id)}
            >
              <MaskIcon src={t.icon} size={18} />
              {t.label}
              <span className={s.count}>{t.count}</span>
            </button>
          ))}
          <span className={s.indicator} style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }} aria-hidden />
        </div>
        <MoreLink href={routes.recommended} variant="plain" className={s.more}>
          Смотреть все
        </MoreLink>
      </div>

      <div id="rec-grid" role="tabpanel" aria-label={tabLabel} className={s.grid} key={fadeKey}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {hasMore && (
        <div className={s.loader} ref={sentinelRef} aria-live="polite">
          <div className={s.loaderHead} data-active={loading || undefined}>
            <Mascot size={56} mood="surprised" className={s.loaderMascot} />
            <div className={s.bubble}>
              <p className={s.bubbleTitle}>
                Загружаем еще
                <span className={s.dots} aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </p>
              <p className={s.bubbleText}>еще {pageSize} товаров · {tabLabel}</p>
            </div>
          </div>
          <div className={s.grid}>
            {Array.from({ length: pageSize / 2 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}
      {!hasMore && (
        // после двух порций лоадер скрываем, под сеткой - «Смотреть все»
        <div className={s.allBelow}>
          <MoreLink href={routes.recommended} variant="pill">
            Смотреть все
          </MoreLink>
        </div>
      )}
    </section>
  );
}
