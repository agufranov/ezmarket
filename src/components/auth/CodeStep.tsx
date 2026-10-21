"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { auth } from "@/config/auth";
import { requestCode, verifyCode } from "@/services/auth.mock";
import s from "./AuthModal.module.scss";

type Props = {
  email: string;
  sentAt: number;
  onChangeEmail: () => void;
  onResent: (at: number) => void;
  onSuccess: () => void;
};

const empty = () => Array<string>(auth.codeLength).fill("");

// Шаг «Ввод кода» (ТЗ 12.9). Макета шага нет - логика по ТЗ, визуал в стиле окна входа,
// тексты - плейсхолдеры из ТЗ. Вставка кода целиком, автопереход, Backspace назад.
export function CodeStep({ email, sentAt, onChangeEmail, onResent, onSuccess }: Props) {
  const [digits, setDigits] = useState(empty);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    cells.current[0]?.focus();
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((sentAt + auth.resendSeconds * 1000 - now) / 1000));
  const blocked = attempts >= auth.maxAttempts;
  const focusCell = (i: number) => cells.current[Math.max(0, Math.min(auth.codeLength - 1, i))]?.focus();

  const check = async (code: string) => {
    setChecking(true);
    try {
      await verifyCode(code);
      onSuccess();
    } catch (x) {
      const expired = (x as { error: string }).error === "expired";
      const n = attempts + 1;
      setAttempts(n);
      setError(
        expired
          ? "Код истёк. Отправьте новый"
          : n >= auth.maxAttempts
            ? "Слишком много попыток. Отправьте код повторно"
            : "Неверный код",
      );
      setDigits(empty());
      setChecking(false);
      requestAnimationFrame(() => focusCell(0));
    }
  };

  const fill = (from: number, chars: string) => {
    const next = [...digits];
    let i = from;
    for (const ch of chars.replace(/\D/g, "")) {
      if (i >= auth.codeLength) break;
      next[i++] = ch;
    }
    setDigits(next);
    setError("");
    focusCell(i);
    if (next.every(Boolean)) check(next.join(""));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i]) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      focusCell(i - 1);
    }
    if (e.key === "ArrowLeft") focusCell(i - 1);
    if (e.key === "ArrowRight") focusCell(i + 1);
  };

  const resend = async () => {
    setResending(true);
    try {
      await requestCode(email);
      onResent(Date.now());
      setNow(Date.now());
      setAttempts(0);
      setError("");
      setDigits(empty());
      focusCell(0);
    } catch (x) {
      setError((x as { error: string }).error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={s.code}>
      <div className={s.head}>
        <h2 id="auth-title" className={s.title}>
          Введите код из письма
        </h2>
        <p className={s.sub}>
          Отправили код на <b className={s.codeEmail}>{email}</b>{" "}
          <button type="button" className={s.link} onClick={onChangeEmail}>
            Изменить
          </button>
        </p>
      </div>

      <div className={s.cells} role="group" aria-label="Код из письма" data-error={error ? true : undefined}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={s.cell}
            data-autofocus={i === 0 || undefined}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={auth.codeLength}
            value={d}
            readOnly={checking || blocked}
            aria-label={`Цифра ${i + 1}`}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) {
                const next = [...digits];
                next[i] = "";
                setDigits(next);
                return;
              }
              // в непустой ячейке новая цифра дописывается к старой - берем только новую
              fill(i, d && v.length > 1 && v.startsWith(d) ? v.slice(1) : v);
            }}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
              e.preventDefault();
              fill(0, e.clipboardData.getData("text"));
            }}
            onFocus={(e) => e.target.select()}
          />
        ))}
        {checking && <span className={`${s.spinner} ${s.spinnerDark}`} aria-label="Проверяем код" />}
      </div>
      <p className={s.error} role="alert">
        {error}
      </p>

      <p className={s.resend}>
        {left > 0 ? (
          `Отправить код повторно через 0:${String(left).padStart(2, "0")}`
        ) : (
          <button type="button" className={s.link} onClick={resend} disabled={resending}>
            Отправить код повторно
          </button>
        )}
      </p>
    </div>
  );
}
