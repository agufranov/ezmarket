"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { auth, authProviders, type AuthProviderId } from "@/config/auth";
import { Modal } from "@/lib/modal";
import { requestCode, oauthLogin, MOCK_CODE, type AuthError } from "@/services/auth.mock";
import { Mascot } from "@/components/ui/Mascot";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { ProviderIcon } from "./ProviderIcon";
import { CodeStep } from "./CodeStep";
import s from "./AuthModal.module.scss";

type Mode = "login" | "register";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KEY_EMAIL = "ez_auth_email";
const KEY_REF = "ez_ref_code";
const KEY_SENT = "ez_code_sent_at";

const copy = {
  login: { title: "Вход в EzMarket", sub: "Пришлём код на почту — пароль не нужен", btn: "Получить код", bonus: "ждут вас после входа", tip: "Войти через" },
  register: { title: "Регистрация", sub: "Пароль не нужен — только код из письма", btn: "Создать аккаунт", bonus: "сразу после регистрации", tip: "Продолжить через" },
};

function readSession(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeSession(key: string, value: string) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

function validateEmail(raw: string) {
  const v = raw.trim().toLowerCase();
  if (!v) return "Введите email";
  if (v.length > 254 || !EMAIL_RE.test(v)) return "Проверьте email";
  return "";
}

const normalizePromo = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

// Вход и регистрация - одно окно с переключателем (ТЗ 12.7-12.9).
// Email общий для обеих вкладок, промокод не теряется при переключении.
export function AuthModal({ initialMode, onClose }: { initialMode: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [emailError, setEmailError] = useState("");
  const [promoError, setPromoError] = useState("");
  const [serverError, setServerError] = useState("");
  const [validateOnInput, setValidateOnInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AuthProviderId | null>(null);
  const [shake, setShake] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // Email из этой сессии, код друга из ?ref=; если код отправлен меньше минуты назад - сразу шаг кода
  useEffect(() => {
    const saved = readSession(KEY_EMAIL);
    const ref = new URLSearchParams(window.location.search).get("ref");
    setEmail(saved);
    setPromo(normalizePromo(ref ?? readSession(KEY_REF)));
    const sent = Number(readSession(KEY_SENT));
    if (saved && sent && Date.now() - sent < auth.resendSeconds * 1000) {
      setSentAt(sent);
      setStep("code");
    }
  }, []);

  const t = copy[mode];
  const busy = loading || provider !== null;

  const fail = (msg: string) => {
    setEmailError(msg);
    setValidateOnInput(true);
    setShake(true);
    emailRef.current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err = validateEmail(email);
    if (err) return fail(err);
    const value = email.trim().toLowerCase();
    setEmail(value);
    writeSession(KEY_EMAIL, value);
    setServerError("");
    setPromoError("");
    setLoading(true);
    try {
      await requestCode(value, mode === "register" ? promo || undefined : undefined);
      const now = Date.now();
      writeSession(KEY_SENT, String(now));
      setSentAt(now);
      setStep("code");
      console.log(`[auth] код отправлен на ${value} (мок: ${MOCK_CODE})`);
    } catch (x) {
      const error = x as AuthError;
      if (error.field === "promo") setPromoError(error.error);
      else setServerError(error.error);
      setShake(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal labelledBy="auth-title" onClose={onClose} className={s.modal}>
      {(close) => (
        <>
          <div className={s.promo}>
            <span className={`${s.star} ${s.star1}`} aria-hidden />
            <span className={`${s.star} ${s.star2}`} aria-hidden />
            <span className={`${s.star} ${s.star3}`} aria-hidden />
            <span className={`${s.spark} ${s.spark1}`} aria-hidden />
            <span className={`${s.spark} ${s.spark2}`} aria-hidden />
            <div className={s.mascotWrap}>
              <Mascot size={150} sideHand float floatDuration={3.4} />
            </div>
            <b className={s.bonus}>+100 бонусов</b>
            <span key={mode} className={s.bonusSub}>
              {t.bonus}
            </span>
            <ul className={s.perks}>
              <li>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8.6 1.75H13c.69 0 1.25.56 1.25 1.25v4.4c0 .33-.13.65-.37.88l-6.1 6.1a1.25 1.25 0 0 1-1.77 0L1.62 9.99a1.25 1.25 0 0 1 0-1.77l6.1-6.1c.23-.24.55-.37.88-.37Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="10.9" cy="5.1" r="1.1" fill="currentColor" />
                </svg>
                кэшбэк до 5%
              </li>
              <li>
                <MaskIcon src="/img/icons/bolt.svg" size={16} />
                выдача за минуты
              </li>
            </ul>
          </div>

          <div className={s.main} data-shake={shake || undefined} onAnimationEnd={(e) => e.target === e.currentTarget && setShake(false)}>
            <button type="button" className={s.close} onClick={close} aria-label="Закрыть">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {step === "code" ? (
              <CodeStep
                email={email}
                sentAt={sentAt}
                onChangeEmail={() => {
                  writeSession(KEY_SENT, "");
                  setStep("form");
                }}
                onResent={(at) => {
                  writeSession(KEY_SENT, String(at));
                  setSentAt(at);
                }}
                onSuccess={() => {
                  writeSession(KEY_SENT, "");
                  writeSession(KEY_REF, "");
                  console.log(`[auth] вход выполнен: ${email}`);
                  close();
                }}
              />
            ) : (
              <>
                <div className={s.tabs} role="tablist" aria-label="Вход или регистрация" data-mode={mode}>
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      className={s.tab}
                      disabled={busy}
                      onClick={() => setMode(m)}
                    >
                      {m === "login" ? "Вход" : "Регистрация"}
                    </button>
                  ))}
                </div>

                <div key={mode} className={s.head}>
                  <h2 id="auth-title" className={s.title}>
                    {t.title}
                  </h2>
                  <p className={s.sub}>{t.sub}</p>
                </div>

                <form className={s.form} onSubmit={submit} noValidate>
                  <label className={s.field} data-error={emailError ? true : undefined}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <rect x="2.25" y="3.75" width="13.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
                      <path d="m2.75 5 6.25 4.5L15.25 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="visually-hidden">Email</span>
                    <input
                      ref={emailRef}
                      data-autofocus
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Ваш email"
                      value={email}
                      readOnly={busy}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? "auth-email-error" : undefined}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        writeSession(KEY_EMAIL, e.target.value.trim());
                        if (validateOnInput) setEmailError(validateEmail(e.target.value));
                      }}
                      onBlur={() => {
                        if (email.trim()) {
                          const err = validateEmail(email);
                          setEmailError(err);
                          if (err) setValidateOnInput(true);
                        }
                      }}
                    />
                  </label>
                  {emailError && (
                    <p id="auth-email-error" className={s.error} role="alert">
                      {emailError}
                    </p>
                  )}

                  <div className={s.collapse} data-open={mode === "register" || undefined}>
                    <div className={s.collapseInner}>
                      <label className={s.field} data-error={promoError ? true : undefined}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                          <rect x="2.5" y="6" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M3.75 9.5v4.25c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1V9.5M9 6v8.75M9 6S7.9 2.75 5.9 3.6C4.3 4.3 6 6 9 6Zm0 0s1.1-3.25 3.1-2.4C13.7 4.3 12 6 9 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                        <span className="visually-hidden">Промокод или код друга, по желанию</span>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="Промокод или код друга"
                          value={promo}
                          readOnly={busy}
                          tabIndex={mode === "register" ? 0 : -1}
                          aria-invalid={promoError ? true : undefined}
                          onChange={(e) => {
                            const v = normalizePromo(e.target.value);
                            setPromo(v);
                            writeSession(KEY_REF, v);
                            setPromoError("");
                          }}
                        />
                        <span className={s.optional} aria-hidden>
                          по желанию
                        </span>
                      </label>
                      {promoError && (
                        <p className={s.error} role="alert">
                          {promoError}
                        </p>
                      )}
                    </div>
                  </div>

                  <button type="submit" className={s.submit} disabled={busy} aria-busy={loading || undefined}>
                    <span className={s.submitSparks} aria-hidden>
                      <i />
                      <i />
                    </span>
                    {t.btn}
                    <span className={s.submitArrow} aria-hidden>
                      {loading ? (
                        <span className={s.spinner} />
                      ) : (
                        <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                          <path d="M2 1.5 6.5 6 2 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {serverError && (
                    <p className={`${s.error} ${s.serverError}`} role="alert">
                      {serverError}
                    </p>
                  )}
                </form>

                <p className={s.divider}>
                  <span>или через</span>
                </p>
                <ul className={s.providers}>
                  {authProviders.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={s.provider}
                        disabled={busy}
                        aria-label={`${t.tip} ${p.label}`}
                        aria-busy={provider === p.id || undefined}
                        onClick={async () => {
                          setProvider(p.id);
                          await oauthLogin(p.id);
                          setProvider(null);
                          close();
                        }}
                      >
                        {provider === p.id ? <span className={`${s.spinner} ${s.spinnerDark}`} /> : <ProviderIcon id={p.id} />}
                        <span className={s.tip} aria-hidden>
                          {t.tip} {p.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <p className={s.terms}>
                  Продолжая, вы принимаете{" "}
                  <a href={auth.termsUrl} target="_blank" rel="noopener noreferrer">
                    условия соглашения
                  </a>
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
