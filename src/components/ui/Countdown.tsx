"use client";

import { useEffect, useState } from "react";
import s from "./Countdown.module.scss";

type Props = { durationMs: number; className?: string };

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60000));
  return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 };
}

// Обратный отсчет д/ч/м. Дата окончания пока считается от загрузки (позже - из API).
export function Countdown({ durationMs, className }: Props) {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const start = Date.now();
    setEnd(start + durationMs);
    setNow(start);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [durationMs]);

  // До гидрации показываем стартовое значение, чтобы не было скачка верстки
  const { d, h, m } = split(end === null ? durationMs : end - now);
  const parts = [
    { v: String(d), u: "д", label: "дней" },
    { v: String(h), u: "ч", label: "часов" },
    { v: String(m).padStart(2, "0"), u: "м", label: "минут" },
  ];

  return (
    <span className={[s.root, className].filter(Boolean).join(" ")} role="timer" aria-label={`${d} дн ${h} ч ${m} мин`}>
      {parts.map((p) => (
        <span key={p.u} className={s.cell}>
          <b key={p.v} className={s.value}>
            {p.v}
          </b>
          <span className={s.unit}>{p.u}</span>
        </span>
      ))}
    </span>
  );
}
