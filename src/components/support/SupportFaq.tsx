"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { faq } from "@/data/faq";
import { BackIcon, CloseIcon } from "./SupportIcons";
import s from "./Support.module.scss";

type Props = { onBack: () => void; onClose: () => void; onWrite: (topic: string) => void };

const TAB_KEY = "ez_faq_tab";
const FEEDBACK_KEY = "ez_faq_feedback";
// «Нет» в «Ответ помог?» - какую тему подставить в «Написать нам»
const topicFor: Record<string, string> = { orders: "Заказ не пришёл", payment: "Оплата" };

function loadFeedback(): Record<string, "yes" | "no"> {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "{}");
  } catch {
    return {};
  }
}

// Частые вопросы (ТЗ 12.17): темы-чипы и аккордеон, открыт один вопрос
export function SupportFaq({ onBack, onClose, onWrite }: Props) {
  const [tabId, setTabId] = useState(faq[0].id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    setFeedback(loadFeedback());
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      if (saved && faq.some((t) => t.id === saved)) setTabId(saved);
    } catch {}
  }, []);

  const tab = faq.find((t) => t.id === tabId) ?? faq[0];

  const pickTab = (id: string) => {
    setTabId(id);
    setOpenId(null);
    listRef.current?.scrollTo({ top: 0 });
    try {
      sessionStorage.setItem(TAB_KEY, id);
    } catch {}
  };

  const answer = (id: string, v: "yes" | "no") => {
    const next = { ...feedback, [id]: v };
    setFeedback(next);
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    } catch {}
    if (v === "no") onWrite(topicFor[tab.id] ?? "Другое");
  };

  // ↑↓ между вопросами
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const qs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button[aria-controls]"));
    const i = qs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    qs[(i + (e.key === "ArrowDown" ? 1 : -1) + qs.length) % qs.length]?.focus();
  };

  return (
    <>
      <div className={s.head}>
        <button type="button" className={s.round} onClick={onBack} aria-label="Назад">
          <BackIcon />
        </button>
        <h2 id="support-title" ref={titleRef} tabIndex={-1} className={s.headTitle}>
          Частые вопросы
        </h2>
        <button type="button" className={s.round} onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
      </div>

      <div className={s.chips} role="tablist" aria-label="Темы">
        {faq.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            className={s.chip}
            onClick={() => pickTab(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div key={tab.id} ref={listRef} className={s.faqList} onKeyDown={onListKey}>
        {tab.items.length === 0 && (
          <p className={s.faqEmpty}>
            Здесь пока нет вопросов.{" "}
            <button type="button" className={s.link} onClick={() => onWrite("Другое")}>
              Написать нам
            </button>
          </p>
        )}
        {tab.items.map((item) => {
          const open = openId === item.id;
          return (
            <div key={item.id} className={s.faqItem} data-open={open || undefined}>
              <button
                type="button"
                className={s.faqQ}
                aria-expanded={open}
                aria-controls={`faq-${item.id}`}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                {item.q}
                <span className={s.faqSign} aria-hidden />
              </button>
              <div id={`faq-${item.id}`} role="region" className={s.faqA}>
                <div>
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <div className={s.helpful}>
          {feedback[openId] === "yes" ? (
            <span className={s.thanks}>Спасибо!</span>
          ) : (
            <>
              <span>Ответ помог?</span>
              <span className={s.helpfulBtns}>
                <button type="button" className={s.vote} onClick={() => answer(openId, "yes")}>
                  <i aria-hidden>👍</i> Да
                </button>
                <button type="button" className={s.vote} onClick={() => answer(openId, "no")}>
                  <i aria-hidden>👎</i> Нет
                </button>
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
