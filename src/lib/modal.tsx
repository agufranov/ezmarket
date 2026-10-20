"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import s from "./modal.module.scss";

// Имена модалок этапа 3. Пока открывается заглушка с названием.
export type ModalName = "login" | "bonus" | "quick-buy" | "promo" | "steam-pay" | "catalog-menu" | "mobile-search";

const titles: Record<ModalName, string> = {
  login: "Вход и регистрация",
  bonus: "Как работает бонусная программа",
  "quick-buy": "Быстрая покупка",
  promo: "Промокод",
  "steam-pay": "Подтверждение оплаты",
  "catalog-menu": "Меню каталога",
  "mobile-search": "Поиск",
};

type Ctx = { openModal: (name: ModalName) => void; closeModal: () => void; current: ModalName | null };
const ModalContext = createContext<Ctx | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used inside ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ModalName | null>(null);
  const openModal = useCallback((name: ModalName) => {
    console.log(`[openModal] ${name}`);
    setCurrent(name);
  }, []);
  const closeModal = useCallback(() => setCurrent(null), []);
  const value = useMemo(() => ({ openModal, closeModal, current }), [openModal, closeModal, current]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {current && (
        <Modal title={titles[current]} onClose={closeModal}>
          <p className={s.stub}>
            Макет этого окна придет на этапе 3. Компонент уже умеет: закрытие по Esc, клику вне окна и крестику,
            блокировку скролла и удержание фокуса внутри.
          </p>
        </Modal>
      )}
    </ModalContext.Provider>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("scroll-locked");
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("scroll-locked");
      prevFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
        <button type="button" className={s.close} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        <h2 id="modal-title" className={s.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
