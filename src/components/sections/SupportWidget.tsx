"use client";

import type { Ref } from "react";
import { SupportMascot } from "./SupportMascot";
import s from "./SupportWidget.module.scss";

type Props = { onOpen: () => void; open: boolean; ref?: Ref<HTMLButtonElement> };

// Плавающая кнопка поддержки; панели - components/support (12.16-12.20)
export function SupportWidget({ onOpen, open, ref }: Props) {
  return (
    <button
      ref={ref}
      type="button"
      className={s.toggle}
      data-support-toggle
      aria-label="Поддержка"
      aria-expanded={open}
      onClick={onOpen}
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
  );
}
