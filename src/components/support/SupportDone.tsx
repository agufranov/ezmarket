"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/ui/Mascot";
import { CheckIcon, CloseIcon, PlaneIcon } from "./SupportIcons";
import { telegramUrl } from "./Support";
import s from "./Support.module.scss";

// «Письмо отправлено!» (ТЗ 12.19)
export function SupportSent({ email, ticketId, onDone }: { email: string; ticketId: number; onDone: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  return (
    <div className={s.sent}>
      <button type="button" className={`${s.round} ${s.sentClose}`} onClick={onDone} aria-label="Закрыть">
        <CloseIcon />
      </button>
      <div className={s.sentMascot}>
        <Mascot size={120} sideHand />
      </div>
      <h2 id="support-title" ref={titleRef} tabIndex={-1} className={s.sentTitle}>
        Письмо отправлено!
      </h2>
      <p className={s.sentText}>
        Ответим на <b>{email}</b> в течение ~2 часов
      </p>
      <span className={s.ticket}>
        <CheckIcon />
        Обращение #{ticketId}
        <span className={s.ticketTip} aria-hidden>
          Номер обращения - укажите его в переписке
        </span>
      </span>
      <button type="button" className={s.done} onClick={onDone}>
        Готово
      </button>
    </div>
  );
}

const AUTO_HIDE_MS = 8000;

// Карточка «Готово, мы на связи!» (ТЗ 12.20): авто-скрытие через 8 s, пауза при hover и фокусе
export function SupportToast({ onClose }: { onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hide = () => {
    setLeaving(true);
    window.setTimeout(onClose, 200);
  };

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(hide, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- таймер перезапускается только снятием паузы
  }, [paused]);

  return (
    <div
      ref={ref}
      className={s.toast}
      role="dialog"
      aria-labelledby="support-toast-title"
      data-leaving={leaving || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setPaused(false)}
    >
      <span className={s.toastMascot}>
        <Mascot size={64} />
      </span>
      <div>
        <h2 id="support-toast-title" className={s.toastTitle}>
          Готово, мы на связи!
        </h2>
        <p className={s.toastText}>Ответ придет на почту. Быстрее - в Telegram-чате</p>
        <div className={s.toastBtns}>
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className={s.tgBtn} onClick={hide}>
            <PlaneIcon size={16} />
            Telegram
          </a>
          <button type="button" className={s.closeBtn} onClick={hide}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
