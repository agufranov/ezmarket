"use client";

import { useEffect, useRef, useState } from "react";
import { supportQuickReplies } from "@/data/mocks";
import { routes } from "@/config/routes";
import { SupportMascot } from "./SupportMascot";
import s from "./SupportWidget.module.scss";

type Msg = { id: number; from: "bot" | "me"; text: string };

type Props = { open: boolean; onToggle: (open: boolean) => void };

export function SupportWidget({ open, onToggle }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "bot", text: "Привет! Я помощник EzMarket. Чем помочь?" },
  ]);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onToggle(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t) || t.closest("[data-support-toggle]")) return;
      onToggle(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onToggle]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: m.length, from: "me", text: t }]);
    setDraft("");
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: m.length, from: "bot", text: "Оператор подключится через минуту. Опишите, пожалуйста, ситуацию подробнее." }]);
    }, 700);
  };

  return (
    <>
      <button
        type="button"
        className={s.toggle}
        data-support-toggle
        aria-expanded={open}
        aria-controls="support-panel"
        aria-label={open ? "Закрыть чат поддержки" : "Открыть чат поддержки"}
        onClick={() => onToggle(!open)}
      >
        <span className={s.stripe} aria-hidden />
        <span className={s.mascotWrap}>
          <SupportMascot className={s.mascot} eyesClassName={s.eyes} />
          <span className={s.cloud} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className={s.tooltip} aria-hidden>
          Нужна помощь?
        </span>
      </button>

      <div
        id="support-panel"
        ref={panelRef}
        className={s.panel}
        data-open={open || undefined}
        role="dialog"
        aria-label="Чат поддержки"
        aria-hidden={!open}
        inert={!open}
      >
        <div className={s.head}>
          <SupportMascot className={s.headMascot} />
          <div>
            <p className={s.headTitle}>Поддержка EzMarket</p>
            <p className={s.status}>
              <i aria-hidden /> онлайн · ответ ~1 мин
            </p>
          </div>
          <button type="button" className={s.close} aria-label="Закрыть" onClick={() => onToggle(false)}>
            ✕
          </button>
        </div>

        <div className={s.messages} ref={listRef} aria-live="polite">
          {messages.map((m) => (
            <p key={m.id} className={m.from === "bot" ? s.bot : s.me}>
              {m.text}
            </p>
          ))}
        </div>

        <div className={s.quick}>
          {supportQuickReplies.map((q) => (
            <button key={q} type="button" className={s.chip} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>

        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <button type="button" className={s.clip} aria-label="Прикрепить файл">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.5 3.5 0 015 5l-8.6 8.6a2 2 0 01-2.8-2.8l7.9-7.9" />
            </svg>
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Напишите сообщение…"
            aria-label="Сообщение"
          />
          <button type="submit" className={s.send} aria-label="Отправить">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M3 20.5l18-8.5L3 3.5l2.5 7.2L15 12l-9.5 1.3z" />
            </svg>
          </button>
        </form>

        <div className={s.contacts}>
          <a href={routes.telegramSupport} target="_blank" rel="noopener noreferrer">
            Telegram
          </a>
          <a href={routes.phone}>8 800 555-35-35</a>
        </div>
      </div>
    </>
  );
}
