"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@/data/user";
import { requestCode, verifyCode, type AuthError, type Mode } from "@/services/auth";
import s from "./AuthModal.module.scss";

const CODE_LENGTH = 6;
const KEY_SENT_AT = "ez_code_sent_at";

// Время, когда снова можно запросить код: переживает закрытие окна и перезагрузку (ТЗ 12.9)
function readResendAt() {
  try {
    return Number(sessionStorage.getItem(KEY_SENT_AT)) || 0;
  } catch {
    return 0;
  }
}

export function saveResendAt(seconds: number) {
  try {
    sessionStorage.setItem(KEY_SENT_AT, String(Date.now() + seconds * 1000));
  } catch {}
}

const formatLeft = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

// Шаг «Ввод кода» (ТЗ 12.9). Макета нет - по ТЗ простая верстка в той же модалке, тексты - плейсхолдеры ТЗ.
// Ввод последней цифры сразу проверяет код; после 5 неверных попыток или истечения - только повторная отправка.
export function CodeStep({
  email,
  mode,
  promo,
  onEdit,
  onShake,
  onDone,
}: {
  email: string;
  mode: Mode;
  promo?: string;
  onEdit: () => void;
  onShake: () => void;
  onDone: (user: User) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendAt, setResendAt] = useState(readResendAt);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const left = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (!left) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [left]);

  useEffect(() => inputRef.current?.focus(), []);

  const check = async (value: string) => {
    setChecking(true);
    setError("");
    try {
      onDone(await verifyCode(email, value));
    } catch (x) {
      const e = x as AuthError;
      setError(e.error);
      // без attemptsLeft код сгорел или истек - вводить больше нечего
      if (e.attemptsLeft === undefined) setLocked(true);
      setCode("");
      onShake();
      setChecking(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const resend = async () => {
    if (left || sending) return;
    setSending(true);
    setError("");
    try {
      const { resendIn } = await requestCode(email, mode, promo);
      saveResendAt(resendIn);
      setLocked(false);
      setCode("");
      inputRef.current?.focus();
    } catch (x) {
      const e = x as AuthError;
      if (e.retryIn) saveResendAt(e.retryIn);
      setError(e.error);
    } finally {
      setResendAt(readResendAt());
      setNow(Date.now());
      setSending(false);
    }
  };

  return (
    <div className={s.step}>
      <div className={s.head}>
        <h2 id="auth-title" className={s.title}>
          Введите код из письма
        </h2>
        <p className={s.sub}>
          Отправили код на {email}{" "}
          <button type="button" className={s.link} onClick={onEdit} disabled={checking}>
            Изменить
          </button>
        </p>
      </div>

      <div className={s.form}>
        <label className={`${s.field} ${s.codeField}`} data-error={error ? true : undefined}>
          <span className="visually-hidden">Код из письма</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            placeholder={"0".repeat(CODE_LENGTH)}
            value={code}
            readOnly={checking || locked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "auth-code-error" : undefined}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(v);
              if (error && !locked) setError("");
              if (v.length === CODE_LENGTH) check(v);
            }}
          />
          {checking && <span className={s.spinner} aria-label="Проверяем код" />}
        </label>
        {error && (
          <p id="auth-code-error" className={s.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <p className={s.resend}>
        {left ? (
          `Отправить код повторно через ${formatLeft(left)}`
        ) : (
          <button type="button" className={s.link} onClick={resend} disabled={sending}>
            Отправить код повторно
          </button>
        )}
      </p>
    </div>
  );
}
