"use client";

/* eslint-disable @next/next/no-img-element -- маленькие картинки в подсказках */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { routes } from "@/config/routes";
import { asset } from "@/lib/asset";
import { formatPrice } from "@/lib/format";
import { loadRecent, normalize, pushRecent, saveRecent, searchConfig, suggest, type Suggest } from "@/lib/search";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Mascot } from "@/components/ui/Mascot";
import s from "./SearchBox.module.scss";

type Props = { className: string; kbdClassName: string };

type Option =
  | { kind: "recent"; text: string }
  | { kind: "query"; text: string; count: number }
  | { kind: "product"; id: string }
  | { kind: "all" }
  | { kind: "fix"; text: string }
  | { kind: "game"; id: string };

const optId = (i: number) => `search-opt-${i}`;

// Совпавшая часть подсказки - жирным. Разбиваем строку на части, без innerHTML.
function highlight(text: string, q: string): ReactNode {
  const i = normalize(text).indexOf(normalize(q));
  if (!q || i < 0) return text;
  const end = i + normalize(q).length;
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, end)}</b>
      {text.slice(end)}
    </>
  );
}

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 4.2V7l1.9 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const LensIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="m9.4 9.4 2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const Arrow = () => (
  <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden>
    <path d="M1.5 1 6 5.5 1.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Поиск в шапке (ТЗ 12.13-12.14): combobox, фокус всегда в поле, активный пункт - aria-activedescendant
export function SearchBox({ className, kbdClassName }: Props) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Suggest | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [shift, setShift] = useState(0);
  const [wide, setWide] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);

  useEffect(() => setRecent(loadRecent()), []);

  // "/" ставит фокус в поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const full = normalize(value).length >= searchConfig.minChars && result !== null;
  const notFound = full && result.total === 0;
  const recentShown = recent.slice(0, searchConfig.recentShow);
  const visible = open && (full || recentShown.length > 0);
  const view = notFound ? "empty" : full ? "full" : "recent";

  // Не выходим за правый край контейнера: сдвигаем панель влево
  useEffect(() => {
    if (!visible) return;
    const place = () => {
      const form = formRef.current;
      const row = form?.parentElement;
      if (!form || !row) return;
      const cs = getComputedStyle(row);
      const rect = row.getBoundingClientRect();
      const rowLeft = rect.left + (parseFloat(cs.paddingLeft) || 0);
      const rowRight = rect.right - (parseFloat(cs.paddingRight) || 0);
      const formLeft = form.getBoundingClientRect().left;
      // «ничего не нашли» по макету - на всю ширину контейнера
      if (view === "empty") {
        setWide(rowRight - rowLeft);
        setShift(formLeft - rowLeft);
        return;
      }
      setWide(0);
      // ширина по CSS (а не offsetWidth - он может еще хранить ширину прошлого вида)
      const width = view === "recent" ? 372 : 860;
      setShift(Math.max(0, formLeft + width - rowRight));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [visible, view]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !formRef.current?.contains(e.target as Node) && setOpen(false);
    const onFocus = (e: FocusEvent) => !formRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lookup = (text: string, now = false) => {
    window.clearTimeout(timer.current);
    setActive(-1);
    if (normalize(text).length < searchConfig.minChars) {
      setResult(null);
      return;
    }
    if (now) setResult(suggest(text));
    else timer.current = window.setTimeout(() => setResult(suggest(text)), searchConfig.debounceMs);
  };

  const remember = (text: string) => {
    const next = pushRecent(recent, text);
    setRecent(next);
    saveRecent(next);
  };

  // переход на страницу результатов (URL позже)
  const go = (text: string, href = routes.search) => {
    if (!normalize(text)) return;
    // запросы, по которым ничего не нашлось, в недавние не сохраняем (ТЗ 12.14)
    if (normalize(text).length < searchConfig.minChars || suggest(text).total > 0) remember(text);
    setOpen(false);
    console.log("[search]", text, href);
  };

  const fill = (text: string) => {
    setValue(text);
    lookup(text, true);
    inputRef.current?.focus();
  };

  // Плоский список пунктов для стрелок
  const options = useMemo<Option[]>(() => {
    if (!visible) return [];
    if (notFound)
      return [
        ...result.corrections.map((text) => ({ kind: "fix" as const, text })),
        ...result.didYouMean.map((g) => ({ kind: "game" as const, id: g.id })),
      ];
    return [
      ...recentShown.map((text) => ({ kind: "recent" as const, text })),
      ...(full ? result.queries.map((q) => ({ kind: "query" as const, text: q.text, count: q.count })) : []),
      ...(full ? result.products.map((p) => ({ kind: "product" as const, id: p.id })) : []),
      ...(full ? [{ kind: "all" as const }] : []),
    ];
  }, [visible, notFound, full, result, recentShown]);

  const indexOf = (pred: (o: Option) => boolean) => options.findIndex(pred);

  const choose = (o: Option) => {
    if (o.kind === "recent") {
      remember(o.text);
      fill(o.text);
    } else if (o.kind === "fix") {
      remember(o.text);
      fill(o.text);
    } else if (o.kind === "query") go(o.text);
    else if (o.kind === "all") go(value);
    else {
      if (suggest(value).total > 0) remember(value);
      setOpen(false);
      console.log("[search] open", o.id);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!visible) return setOpen(true);
      if (!options.length) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i < 0 && dir < 0 ? options.length - 1 : (i + dir + options.length) % options.length));
    } else if (e.key === "Escape") {
      // первый Esc закрывает подсказки (текст остается - гасим родную очистку type=search), второй убирает фокус
      e.preventDefault();
      if (visible) setOpen(false);
      else inputRef.current?.blur();
    } else if (e.key === "Tab") setOpen(false);
  };

  const activeOpt = visible && active >= 0 ? options[active] : undefined;

  return (
    <form
      ref={formRef}
      className={[s.box, className].filter(Boolean).join(" ")}
      role="search"
      data-open={visible || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (activeOpt) choose(activeOpt);
        else go(value);
      }}
    >
      <MaskIcon src="/img/icons/search.svg" size={20} className={s.searchIcon} />
      <label htmlFor="site-search" className="visually-hidden">
        Поиск
      </label>
      <input
        id="site-search"
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={visible}
        aria-controls="search-panel"
        aria-autocomplete="list"
        aria-activedescendant={activeOpt ? optId(active) : undefined}
        placeholder="Найти товар, игру или сервис"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          lookup(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <kbd className={kbdClassName}>/</kbd>
      {/* мобильный экран поиска (38:4501): очистка в поле и «Отмена» справа; на десктопе скрыты */}
      {value && (
        <button
          type="button"
          className={s.clearInput}
          aria-label="Очистить поиск"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue("");
            lookup("");
            inputRef.current?.focus();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className={s.cancel}
        onClick={() => {
          setOpen(false);
          inputRef.current?.blur();
        }}
      >
        Отмена
      </button>

      <div
        id="search-panel"
        role="listbox"
        aria-label="Подсказки поиска"
        className={s.panel}
        data-open={visible || undefined}
        data-view={view}
        ref={panelRef}
        style={{ marginLeft: -shift, width: wide || undefined }}
        // клики внутри не забирают фокус из поля
        onMouseDown={(e) => e.preventDefault()}
      >
        {notFound ? (
          <>
            <div className={s.nfLeft}>
              <div className={s.nfMascot}>
                <Mascot size={120} />
              </div>
              <div>
                <p className={s.nfTitle}>
                  По запросу «<span className={s.nfQuery}>{value.trim()}</span>» ничего не нашли
                </p>
                <p className={s.nfSub}>Проверьте написание или посмотрите похожее</p>
                {result.corrections.length > 0 && (
                  <div className={s.fixes}>
                    {result.corrections.map((text) => {
                      const i = indexOf((o) => o.kind === "fix" && o.text === text);
                      return (
                        <button
                          key={text}
                          type="button"
                          id={optId(i)}
                          role="option"
                          aria-selected={i === active}
                          tabIndex={-1}
                          className={s.fix}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => choose(options[i])}
                        >
                          <LensIcon />
                          {text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {result.didYouMean.length > 0 && (
              <div className={s.nfRight}>
                <p className={s.label}>Возможно, вы искали</p>
                {result.didYouMean.map((g) => {
                  const i = indexOf((o) => o.kind === "game" && o.id === g.id);
                  return (
                    <a
                      key={g.id}
                      href={routes.product(g.id)}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === active}
                      tabIndex={-1}
                      className={s.game}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(options[i])}
                    >
                      <img src={asset(g.logo)} alt="" width={48} height={48} />
                      <span className={s.gameText}>
                        <b>{g.title}</b>
                        <span>
                          {g.subtitle}
                          {g.hit && (
                            <em className={s.hit}>
                              <MaskIcon src="/img/icons/fire.svg" size={12} />
                              хит
                            </em>
                          )}
                        </span>
                      </span>
                      <span className={s.price}>
                        <small>от</small> {formatPrice(g.priceFrom)}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={s.left}>
              {recentShown.length > 0 && (
                <section>
                  <div className={s.labelRow}>
                    <p className={s.label}>Недавние</p>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={s.clear}
                      onClick={() => {
                        setRecent([]);
                        saveRecent([]);
                        setActive(-1);
                      }}
                    >
                      Очистить
                    </button>
                  </div>
                  {recentShown.map((text) => {
                    const i = indexOf((o) => o.kind === "recent" && o.text === text);
                    return (
                      <div
                        key={text}
                        id={optId(i)}
                        role="option"
                        aria-selected={i === active}
                        className={s.recent}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(options[i])}
                      >
                        <ClockIcon />
                        <span className={s.recentText}>{text}</span>
                        <button
                          type="button"
                          tabIndex={-1}
                          className={s.remove}
                          aria-label={`Удалить «${text}» из недавних`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = recent.filter((x) => x !== text);
                            setRecent(next);
                            saveRecent(next);
                            setActive(-1);
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                            <path d="m1 1 6 6M7 1 1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </section>
              )}
              {full && result.queries.length > 0 && (
                <section>
                  <p className={s.label}>Запросы</p>
                  {result.queries.map((q) => {
                    const i = indexOf((o) => o.kind === "query" && o.text === q.text);
                    return (
                      <div
                        key={q.text}
                        id={optId(i)}
                        role="option"
                        aria-selected={i === active}
                        className={s.query}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(options[i])}
                      >
                        <span className={s.queryIcon}>
                          <LensIcon />
                        </span>
                        <span className={s.queryText}>{highlight(q.text, value)}</span>
                        <span className={s.queryCount}>{q.count.toLocaleString("ru-RU")}</span>
                        <span className={s.queryGo} aria-hidden>
                          <Arrow />
                        </span>
                      </div>
                    );
                  })}
                </section>
              )}
            </div>

            {full && (
              <div className={s.right}>
                {result.products.length > 0 && <p className={s.label}>Товары</p>}
                {result.products.map((p) => {
                  const i = indexOf((o) => o.kind === "product" && o.id === p.id);
                  return (
                    <a
                      key={p.id}
                      href={routes.product(p.id)}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === active}
                      tabIndex={-1}
                      className={s.product}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(options[i])}
                    >
                      <span className={s.thumb}>
                        {p.tint ? (
                          <span className={s.thumbTint} style={{ background: p.tint }} />
                        ) : (
                          <img src={asset(p.image)} alt="" width={52} height={52} />
                        )}
                        {p.game && <img className={s.thumbGame} src={asset(p.game)} alt="" width={22} height={22} />}
                      </span>
                      <span className={s.productText}>
                        <b>{p.title}</b>
                        <span>{p.subtitle}</span>
                      </span>
                      <span className={s.price}>{formatPrice(p.price)}</span>
                    </a>
                  );
                })}
                {(() => {
                  const i = indexOf((o) => o.kind === "all");
                  return (
                    <button
                      type="button"
                      id={optId(i)}
                      role="option"
                      aria-selected={i === active}
                      tabIndex={-1}
                      className={s.all}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(options[i])}
                    >
                      Все {result.total.toLocaleString("ru-RU")} результатов
                      <span className={s.allArrow}>
                        <Arrow />
                      </span>
                    </button>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </form>
  );
}
