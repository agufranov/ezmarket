"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { heroSlides, sideBanners } from "@/data/mocks";
import { routes } from "@/config/routes";
import { site } from "@/config/site";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import s from "./Hero.module.scss";

export function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // ключ перезапускает CSS-анимацию заполнения полоски
  const [cycle, setCycle] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const goTo = useCallback((i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  }, []);

  const next = useCallback(() => goTo((active + 1) % heroSlides.length), [active, goTo]);

  // Пауза на hover и при скрытой вкладке
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Слайд переключается по окончании CSS-анимации полоски (так пауза не сбивает тайминг).
  // При reduced-motion анимации нет - переключаем таймером раз в 6 с.
  useEffect(() => {
    if (paused || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = window.setTimeout(next, site.heroSlideMs);
    return () => window.clearTimeout(timer.current);
  }, [paused, cycle, next]);

  return (
    <section className={s.hero} aria-label="Акции">
      <div
        className={s.main}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(document.hidden)}
        aria-roledescription="карусель"
      >
        <span className={s.ring} aria-hidden />
        <span className={s.dashed} aria-hidden />

        {heroSlides.map((slide, i) => (
          <div key={slide.id} className={s.slide} data-active={i === active || undefined} aria-hidden={i !== active}>
            <Image
              src={slide.art}
              alt=""
              width={360}
              height={361}
              className={s.art}
              priority={i === 0}
              sizes="360px"
            />
            <div className={s.content}>
              <span className={s.badge}>
                <Icon src="/img/icons/bolt.svg" size={14} />
                {slide.badge}
              </span>
              {i === 0 ? (
                <h1 className={s.title}>
                  {slide.title[0]} <br />
                  {slide.title[1]}
                </h1>
              ) : (
                <p className={s.title}>
                  {slide.title[0]} <br />
                  {slide.title[1]}
                </p>
              )}
              <p className={s.text}>{slide.text}</p>
              <Button variant="white" arrow href={routes.steamTopUp} tabIndex={i === active ? 0 : -1}>
                {slide.cta}
              </Button>
            </div>
          </div>
        ))}

        <div className={s.dots} role="tablist" aria-label="Слайды">
          {heroSlides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Слайд ${i + 1}`}
              className={s.dot}
              data-state={i < active ? "done" : i === active ? (paused ? "paused" : "run") : undefined}
              onClick={() => goTo(i)}
            >
              <span
                key={i === active ? cycle : undefined}
                style={{ animationDuration: `${site.heroSlideMs}ms` }}
                onAnimationEnd={i === active ? next : undefined}
              />
            </button>
          ))}
        </div>
      </div>

      <div className={s.side}>
        {sideBanners.map((b) => (
          <div key={b.id} className={`${s.card} ${s[b.theme]}`}>
            <span className={s.cardCircle} aria-hidden />
            <div>
              <p className={s.cardLabel}>{b.label}</p>
              <p className={s.cardTitle}>
                {b.title[0]}
                <br />
                {b.title[1]}
              </p>
            </div>
            <span className={s.cardIcon} aria-hidden>
              <Image src={b.icon} alt="" width={72} height={72} />
            </span>
            <a href={routes.promo} className={s.cardBtn} aria-label={`${b.label}: ${b.title.join(" ")}`}>
              <Icon src="/img/icons/arrow-white.svg" width={7} height={11} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
