"use client";

import { SupportMascot } from "./SupportMascot";
import s from "./SupportWidget.module.scss";

type Props = { onOpen: () => void };

// Плавающая кнопка поддержки. Сценарий поддержки (меню-пузыри, вопросы, «Написать нам») - по разделам 12.16-12.20
export function SupportWidget({ onOpen }: Props) {
  return (
    <button type="button" className={s.toggle} data-support-toggle aria-label="Поддержка" onClick={onOpen}>
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
