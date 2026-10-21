"use client";

import { useEffect, useState, type RefObject } from "react";

type Options = {
  open: boolean;
  onClose: (returnFocus?: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLElement | null>;
};

const ITEMS = 'a[href], button:not([disabled]), [role="menuitem"], [role="tab"]';

// Общее поведение поповеров шапки (ТЗ 12.1): клик вне (pointerdown вне панели и триггера), Esc с возвратом
// фокуса, Tab наружу, ↑↓ по пунктам, закрытие при переходе через 1024. Возвращает отступ носика от правого края.
export function useHeaderPopover({ open, onClose, triggerRef, panelRef, rowRef }: Options) {
  const [noseRight, setNoseRight] = useState(0);

  useEffect(() => {
    if (!open) return;
    const inside = (n: EventTarget | null) =>
      panelRef.current?.contains(n as Node) || triggerRef.current?.contains(n as Node);
    const place = () => {
      const row = rowRef.current?.getBoundingClientRect();
      const btn = triggerRef.current?.getBoundingClientRect();
      const pad = rowRef.current ? parseFloat(getComputedStyle(rowRef.current).paddingRight) || 0 : 0;
      if (row && btn) setNoseRight(row.right - pad - (btn.left + btn.width / 2));
    };
    place();

    const onDown = (e: PointerEvent) => !inside(e.target) && onClose();
    const onFocus = (e: FocusEvent) => !inside(e.target) && onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose(true);
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !panelRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(ITEMS));
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    };
    const mq = window.matchMedia("(max-width: 1023px)");
    const onBp = () => onClose();

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    mq.addEventListener("change", onBp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      mq.removeEventListener("change", onBp);
    };
  }, [open, onClose, triggerRef, panelRef, rowRef]);

  return noseRight;
}

// Открыли с клавиатуры (click.detail === 0) - фокус на первый пункт панели
export function focusFirst(panel: HTMLElement | null) {
  requestAnimationFrame(() => panel?.querySelector<HTMLElement>(ITEMS)?.focus());
}
