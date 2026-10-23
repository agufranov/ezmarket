"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { sendTicket } from "@/services/support.mock";
import { BackIcon, ClipIcon, CloseIcon, MailIcon } from "./SupportIcons";
import s from "./Support.module.scss";

type Props = {
  topic?: string;
  onBack?: () => void;
  onClose: () => void;
  onSent: (r: { email: string; ticketId: number }) => void;
};

const topics = ["Заказ не пришел", "Возврат", "Оплата", "Другое"];
const DRAFT_KEY = "ez_support_draft";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN = 10;
const MAX = 1000;
const MAX_FILE_MB = 5;
const FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Errors = Partial<Record<"email" | "topic" | "text" | "file" | "server", string>>;

function validate(email: string, topic: string, text: string): Errors {
  const e: Errors = {};
  const v = email.trim().toLowerCase();
  if (!v || v.length > 254 || !EMAIL_RE.test(v)) e.email = "Проверьте email";
  if (!topic) e.topic = "Выберите тему";
  if (text.trim().length < MIN) e.text = "Опишите вопрос подробнее";
  return e;
}

// «Написать нам» (ТЗ 12.18): email, тема, текст, скрин; черновик в sessionStorage
export function SupportMail({ topic: initialTopic, onBack, onClose, onSent }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // черновик этой сессии; email у авторизованного - из профиля
  useEffect(() => {
    let draft: { email?: string; topic?: string; text?: string } = {};
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}");
    } catch {}
    setEmail(draft.email ?? user?.email ?? "");
    setTopic(initialTopic ?? draft.topic ?? "");
    setText(draft.text ?? "");
    requestAnimationFrame(() => emailRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии формы
  }, []);

  // сохраняем черновик с задержкой 500 ms
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email, topic, text }));
      } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [email, topic, text]);

  // поле растет до ~6 строк
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const recheck = (next: { email?: string; topic?: string; text?: string }) => {
    if (!checked) return;
    const e = validate(next.email ?? email, next.topic ?? topic, next.text ?? text);
    setErrors((prev) => ({ ...e, file: prev.file }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const errs = { ...validate(email, topic, text), file: errors.file };
    if (!errs.file) delete errs.file;
    setChecked(true);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]");
      first?.focus();
      return;
    }
    setLoading(true);
    try {
      const r = await sendTicket({ email: email.trim().toLowerCase(), topic, message: text, file });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      onSent({ email: email.trim().toLowerCase(), ticketId: r.ticketId });
    } catch (x) {
      setErrors({ server: (x as Error).message });
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} className={s.mail} onSubmit={submit} noValidate>
      <div className={s.mailHead}>
        {/* «Назад» есть, если форму открыли из меню или вопросов; в мобильном макете вместо него значок письма */}
        {onBack && (
          <button type="button" className={`${s.round} ${s.mailBack}`} onClick={onBack} aria-label="Назад">
            <BackIcon />
          </button>
        )}
        <span className={s.mailIcon} aria-hidden>
          <MailIcon size={22} />
        </span>
        <div className={s.mailTitles}>
          <h2 id="support-title" className={s.mailTitle}>
            Написать нам
          </h2>
          <p className={s.mailSub}>Ответим на почту за ~2 часа</p>
        </div>
        <button type="button" className={s.round} onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
      </div>

      <label className={s.field} data-error={errors.email ? true : undefined}>
        <MailIcon size={18} />
        <span className="visually-hidden">Email для ответа</span>
        <input
          ref={emailRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Ваш email"
          value={email}
          readOnly={loading}
          aria-invalid={errors.email ? true : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            recheck({ email: e.target.value });
          }}
          onBlur={() => email.trim() && setErrors((p) => ({ ...p, email: validate(email, "x", "x".repeat(MIN)).email }))}
        />
      </label>
      {errors.email && <p className={s.error}>{errors.email}</p>}

      <div className={s.chips} role="radiogroup" aria-label="Тема обращения" aria-invalid={errors.topic ? true : undefined} tabIndex={-1}>
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={topic === t}
            className={s.chip}
            disabled={loading}
            onClick={() => {
              setTopic(t);
              recheck({ topic: t });
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {errors.topic && <p className={s.error}>{errors.topic}</p>}

      <label className={`${s.field} ${s.area}`} data-error={errors.text ? true : undefined}>
        <span className="visually-hidden">Текст обращения</span>
        <textarea
          ref={textRef}
          rows={3}
          maxLength={MAX}
          placeholder="Опишите, что случилось. Если есть - номер заказа"
          value={text}
          readOnly={loading}
          aria-invalid={errors.text ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            recheck({ text: e.target.value });
          }}
        />
        {text.length > 900 && (
          <span className={s.counter}>
            {text.length}/{MAX}
          </span>
        )}
      </label>
      {errors.text && <p className={s.error}>{errors.text}</p>}

      <div className={s.mailFoot}>
        <input
          ref={fileRef}
          type="file"
          accept={FILE_TYPES.join(",")}
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            if (!FILE_TYPES.includes(f.type)) return setErrors((p) => ({ ...p, file: "Только PNG, JPG, WEBP" }));
            if (f.size > MAX_FILE_MB * 1024 * 1024) return setErrors((p) => ({ ...p, file: `Файл больше ${MAX_FILE_MB} МБ` }));
            setErrors((p) => ({ ...p, file: undefined }));
            setFile(f);
          }}
        />
        {file ? (
          <span className={s.fileName}>
            <ClipIcon />
            <span>{file.name}</span>
            <button type="button" className={s.fileRemove} aria-label="Убрать файл" onClick={() => setFile(null)}>
              <CloseIcon />
            </button>
          </span>
        ) : (
          <button type="button" className={s.attach} onClick={() => fileRef.current?.click()} disabled={loading}>
            <ClipIcon />
            Прикрепить скрин
          </button>
        )}
        <button type="submit" className={s.send} aria-busy={loading || undefined} disabled={loading}>
          Отправить
          <span className={s.sendArrow} aria-hidden>
            {loading ? (
              <span className={s.spinner} />
            ) : (
              <svg width="7" height="11" viewBox="0 0 7 11" fill="none">
                <path d="M1.5 1 6 5.5 1.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>
      </div>
      {(errors.file || errors.server) && <p className={s.error}>{errors.file ?? errors.server}</p>}
    </form>
  );
}
