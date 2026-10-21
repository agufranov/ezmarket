"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import s from "./modal.module.scss";

// login/register - одно окно с переключателем (ТЗ 12.7-12.8).
// Для остальных макетов еще нет: пока только пишем в консоль, окно не показываем.
export type ModalName = "login" | "register" | "bonus" | "quick-buy" | "promo" | "steam-pay";

type AuthMode = "login" | "register";
type Ctx = { openModal: (name: ModalName) => void; closeModal: () => void; current: AuthMode | null };
const ModalContext = createContext<Ctx | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used inside ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AuthMode | null>(null);
  const openModal = useCallback((name: ModalName) => {
    console.log(`[openModal] ${name}`);
    if (name === "login" || name === "register") setCurrent(name);
  }, []);
  const closeModal = useCallback(() => setCurrent(null), []);
  const value = useMemo(() => ({ openModal, closeModal, current }), [openModal, closeModal, current]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {current && <AuthModal initialMode={current} onClose={closeModal} />}
    </ModalContext.Provider>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';
const CLOSE_MS = 180;

type ModalProps = {
  labelledBy: string;
  onClose: () => void;
  className?: string;
  children: (close: () => void) => ReactNode;
};

// Каркас модалки (ТЗ 12.1): затемнение, фокус-трап, Esc и клик по затемнению, блокировка скролла
// с компенсацией скроллбара, анимация закрытия. Первый фокус - элемент с data-autofocus.
export function Modal({ labelledBy, onClose, className, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), CLOSE_MS);
  }, []);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    html.style.paddingRight = scrollbar ? `${scrollbar}px` : "";

    const root = dialogRef.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent);
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
      html.style.overflow = "";
      html.style.paddingRight = "";
      prevFocus?.focus();
    };
  }, [close]);

  return (
    <div
      className={s.overlay}
      data-closing={closing || undefined}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className={[s.dialog, className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={dialogRef}
      >
        {children(close)}
      </div>
    </div>
  );
}
