"use client";

import { useEffect, useId, useRef, useState } from "react";
import { site } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { useModal } from "@/lib/modal";
import { apiEnabled } from "@/services/api";
import { fetchLimits, newIdempotencyKey, startSteamTopUp, type Limits, type TopUpError } from "@/services/orders";
import { formatAmount, formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import s from "./SteamBar.module.scss";

export function SteamBar() {
  const { openModal } = useModal();
  const uid = useId();
  const [login, setLogin] = useState("");
  const [amount, setAmount] = useState("500");
  const [currency, setCurrency] = useState<(typeof site.steam.currencies)[number]>(site.steam.currencies[0]);
  const [touched, setTouched] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // ошибка с сервера: у поля (логин, сумма) или общая (сеть, заказ уже нельзя оплатить)
  const [serverError, setServerError] = useState<TopUpError | null>(null);
  const { user } = useAuth();
  // лимиты суммы с сервера (ТЗ 8.3); пока не пришли - из site.ts
  const [limits, setLimits] = useState<Limits>({ minAmount: site.steam.minAmount, maxAmount: site.steam.maxAmount });
  useEffect(() => {
    fetchLimits().then(setLimits);
  }, []);
  // ключ повтора живет, пока не поменялись логин, сумма или валюта: двойной клик и повтор после ошибки - тот же заказ
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    keyRef.current = null;
    setServerError(null);
  }, [login, amount, currency]);

  const value = Number(amount || 0);
  const amountError =
    serverError?.field === "amount"
      ? serverError.error
      : touched && value < limits.minAmount
      ? `Минимум ${limits.minAmount}`
      : value > limits.maxAmount
        ? `Максимум ${limits.maxAmount.toLocaleString("ru-RU")}`
        : "";
  const canPay = login.trim().length > 0 && value >= limits.minAmount && value <= limits.maxAmount;

  const loginError = serverError?.field === "steamLogin" ? serverError.error : "";
  const commonError = serverError && !serverError.field ? serverError.error : "";

  const pay = async () => {
    if (!canPay || loading) return;
    // заказ создается только с сессией: гостю - окно входа
    if (apiEnabled && !user) return openModal("login");
    keyRef.current ??= newIdempotencyKey();
    // оплата - в новом окне. Открываем его сразу по клику (после ответа сервера браузер заблокирует всплывающее окно),
    // ссылку подставляем, когда заказ создан; при ошибке окно закрываем
    const win = apiEnabled ? window.open("about:blank", "_blank") : null;
    if (win) win.opener = null;
    setLoading(true);
    setServerError(null);
    try {
      const { paymentUrl } = await startSteamTopUp({ steamLogin: login.trim(), amount: value, currency: currency.id }, keyRef.current);
      setLoading(false);
      if (!paymentUrl) return openModal("steam-pay");
      if (win && !win.closed) win.location.href = paymentUrl;
      // всплывающие окна запрещены - уходим на оплату в этой же вкладке
      else window.location.assign(paymentUrl);
    } catch (e) {
      const err = e as TopUpError;
      win?.close();
      setLoading(false);
      if (err.status === 401) return openModal("login");
      setServerError(err.field === "currency" ? { ...err, field: undefined } : err);
    }
  };

  return (
    <section className={s.bar} aria-labelledby={`${uid}-title`}>
      <div className={s.head}>
        <Icon src="/img/brands/steam-round.svg" size={56} className={s.logo} />
        <div className={s.headText}>
          <h2 id={`${uid}-title`} className={s.title}>
            Пополнение Steam <span className={s.badge}>5%</span>
          </h2>
          {promoOpen ? (
            <input
              className={s.promoInput}
              placeholder="Промокод"
              aria-label="Промокод"
              autoFocus
              onBlur={(e) => !e.target.value && setPromoOpen(false)}
              onKeyDown={(e) => e.key === "Enter" && console.log("[promo]", e.currentTarget.value)}
            />
          ) : (
            <button type="button" className={s.promo} onClick={() => setPromoOpen(true)}>
              Ввести промокод
              <Icon src="/img/icons/chevron-small.svg" size={14} className={s.promoChevron} />
            </button>
          )}
        </div>
      </div>

      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          pay();
        }}
      >
        <label className={s.field} data-error={loginError ? "" : undefined} title={loginError || undefined}>
          {/* в мобильном макете иконки полей контурные */}
          <Icon src="/img/icons/user.svg" size={24} className={s.iconDesk} />
          <Icon src="/img/icons/user-line.svg" size={20} className={s.iconMob} />
          <span className="visually-hidden">Логин Steam{loginError && `: ${loginError}`}</span>
          <input
            value={login}
            aria-invalid={!!loginError}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин Steam"
            autoComplete="off"
            spellCheck={false}
          />
          <span className={s.info} tabIndex={0} aria-describedby={`${uid}-tip`}>
            <Icon src="/img/icons/info-circle.svg" size={20} alt="Где найти логин Steam" className={s.iconDesk} />
            <Icon src="/img/icons/info-line.svg" size={16} alt="Где найти логин Steam" className={s.iconMob} />
            <span id={`${uid}-tip`} role="tooltip" className={s.tip}>
              Логин - это имя для входа в Steam, а не никнейм в профиле
            </span>
          </span>
        </label>

        <div className={s.field} data-error={amountError ? "" : undefined}>
          <Icon src="/img/icons/buy-crypto.svg" size={24} className={s.iconDesk} />
          <Icon src="/img/icons/coins-line.svg" size={20} className={s.iconMob} />
          <label className={s.amount}>
            <span className={s.amountLabel}>{amountError || "Сумма"}</span>
            {/* символ валюты сразу после суммы, как в макете («500$») */}
            <span className={s.amountValue}>
              <span className={s.amountGhost} aria-hidden>
                {amount}
                <b>{currency.symbol}</b>
              </span>
            <input
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(formatAmount(e.target.value))}
              onBlur={() => setTouched(true)}
              aria-invalid={!!amountError}
            />
            </span>
          </label>
          <div className={s.currencies} role="radiogroup" aria-label="Валюта">
            {site.steam.currencies.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === currency.id}
                aria-label={c.id}
                className={s.cur}
                onClick={() => setCurrency(c)}
              >
                {c.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* общей ошибки в макете нет: пока только для экранных дикторов, кнопка снова доступна для повтора */}
        <span className="visually-hidden" role="alert">
          {commonError}
        </span>
        <button type="submit" className={s.pay} disabled={!canPay} aria-busy={loading || undefined}>
          {loading ? <span className={s.spinner} aria-label="Обработка" /> : `Оплатить ${formatNumber(value)}${currency.symbol}`}
        </button>
      </form>
    </section>
  );
}
