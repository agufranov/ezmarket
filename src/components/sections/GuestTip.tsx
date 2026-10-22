"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { site } from "@/config/site";
import { Mascot } from "@/components/ui/Mascot";
import s from "./GuestTip.module.scss";

type Props = {
  // можно ли показывать сейчас: гость, нет открытого поповера и модалки
  allowed: boolean;
  loginRef: RefObject<HTMLButtonElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  onLogin: () => void;
  onVisibleChange: (v: boolean) => void;
};

const SHOWN_KEY = "ez_guest_tip_shown";
const DELAY_MS = 1500;
const AUTO_HIDE_MS = 8000;

// Пузырь гостя под «Войти» (ТЗ 12.5): один раз за сессию через 1,5 с после загрузки
export function GuestTip({ allowed, loginRef, rowRef, onLogin, onVisibleChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [noseRight, setNoseRight] = useState(60);
  const ref = useRef<HTMLDivElement>(null);
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;

  const hide = () => {
    setVisible(false);
    onVisibleChange(false);
  };

  // показ: флаг ставим в момент показа, а не закрытия
  useEffect(() => {
    let shown = "1";
    try {
      shown = sessionStorage.getItem(SHOWN_KEY) ?? "";
    } catch {}
    if (shown) return;
    const t = window.setTimeout(() => {
      if (!allowedRef.current) return;
      try {
        sessionStorage.setItem(SHOWN_KEY, "1");
      } catch {}
      const row = rowRef.current;
      const btn = loginRef.current?.getBoundingClientRect();
      if (row && btn) {
        const pad = parseFloat(getComputedStyle(row).paddingRight) || 0;
        setNoseRight(row.getBoundingClientRect().right - pad - (btn.left + btn.width / 2));
      }
      setVisible(true);
      onVisibleChange(true);
    }, DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз после загрузки
  }, []);

  // открылся поповер или модалка, пользователь вошел - прячем
  useEffect(() => {
    if (visible && !allowed) hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, visible]);

  // закрытие: клик вне, Esc, скролл больше 200 px, авто-скрытие через 8 с (пауза при hover)
  useEffect(() => {
    if (!visible) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !loginRef.current?.contains(t)) hide();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    const onScroll = () => window.scrollY > 200 && hide();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = paused ? 0 : window.setTimeout(hide, AUTO_HIDE_MS);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, paused]);

  return (
    <div
      ref={ref}
      className={s.tip}
      role="status"
      data-open={visible || undefined}
      style={{ ["--nose-right" as string]: `${noseRight}px` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {visible && (
        <button
          type="button"
          className={s.bubble}
          tabIndex={-1}
          onClick={() => {
            hide();
            onLogin();
          }}
        >
          <span className={s.text}>
            Привет! Войдите
            <br />
            и заберите <b>{site.signupBonus} бонусов</b>
          </span>
          <span className={s.mascot}>
            <Mascot size={52} float floatDuration={3.4} />
          </span>
        </button>
      )}
    </div>
  );
}
