"use client";

import { useEffect, useRef } from "react";
import { Mascot } from "@/components/ui/Mascot";
import { MailIcon, PlaneIcon, QuestionIcon } from "./SupportIcons";
import { telegramUrl, type Screen } from "./Support";
import s from "./Support.module.scss";

type Props = { onPick: (screen: Screen) => void; onTelegram: () => void };

// Меню-пузыри (ТЗ 12.16): приветствие и три действия, появляются по очереди
export function SupportMenu({ onPick, onTelegram }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div ref={ref} className={s.menu} role="dialog" aria-label="Поддержка" tabIndex={-1}>
      <div className={s.hello} style={{ animationDelay: "0ms" }}>
        <span className={s.helloMascot}>
          <Mascot size={30} />
        </span>
        Привет! Чем помочь?
      </div>
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={s.bubble}
        style={{ animationDelay: "40ms" }}
        onClick={onTelegram}
      >
        <span className={`${s.bubbleIcon} ${s.iconTg}`}>
          <PlaneIcon />
        </span>
        Telegram-чат
      </a>
      <button type="button" className={s.bubble} style={{ animationDelay: "80ms" }} onClick={() => onPick("mail")}>
        <span className={`${s.bubbleIcon} ${s.iconMail}`}>
          <MailIcon />
        </span>
        Написать нам
      </button>
      <button type="button" className={s.bubble} style={{ animationDelay: "120ms" }} onClick={() => onPick("faq")}>
        <span className={`${s.bubbleIcon} ${s.iconFaq}`}>
          <QuestionIcon />
        </span>
        Частые вопросы
      </button>
    </div>
  );
}
