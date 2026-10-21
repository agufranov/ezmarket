"use client";

import { useId, useState } from "react";
import { site } from "@/config/site";
import { useModal } from "@/lib/modal";
import { formatAmount, formatPrice } from "@/lib/format";
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

  const value = Number(amount || 0);
  const amountError =
    touched && value < site.steam.minAmount
      ? `Минимум ${site.steam.minAmount}`
      : value > site.steam.maxAmount
        ? `Максимум ${site.steam.maxAmount.toLocaleString("ru-RU")}`
        : "";
  const canPay = login.trim().length > 0 && value >= site.steam.minAmount && value <= site.steam.maxAmount;

  const pay = () => {
    if (!canPay || loading) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      openModal("steam-pay");
    }, 1200);
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
        <label className={s.field}>
          <Icon src="/img/icons/user.svg" size={24} />
          <span className="visually-hidden">Логин Steam</span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин Steam"
            autoComplete="off"
            spellCheck={false}
          />
          <span className={s.info} tabIndex={0} aria-describedby={`${uid}-tip`}>
            <Icon src="/img/icons/info-circle.svg" size={20} alt="Где найти логин Steam" />
            <span id={`${uid}-tip`} role="tooltip" className={s.tip}>
              Логин - это имя для входа в Steam, а не никнейм в профиле
            </span>
          </span>
        </label>

        <div className={s.field} data-error={amountError ? "" : undefined}>
          <Icon src="/img/icons/buy-crypto.svg" size={24} />
          <label className={s.amount}>
            <span className={s.amountLabel}>{amountError || "Сумма"}</span>
            <input
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(formatAmount(e.target.value))}
              onBlur={() => setTouched(true)}
              aria-invalid={!!amountError}
            />
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

        <button type="submit" className={s.pay} disabled={!canPay} aria-busy={loading || undefined}>
          {loading ? <span className={s.spinner} aria-label="Обработка" /> : `Оплатить ${formatPrice(value, currency.symbol)}`}
        </button>
      </form>
    </section>
  );
}
