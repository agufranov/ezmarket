"use client";

import { useCallback, useEffect, useState } from "react";
import { asset } from "@/lib/asset";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ModalProvider, useModal } from "@/lib/modal";
import { apiEnabled, type ApiError } from "@/services/api";
import { cancelOrder, getOrder, listOrders, payOrder, type OrderDto, type OrderStatus } from "@/services/orders";
import s from "./OrdersPage.module.scss";

// Мои заказы: простая страница без макета - список заказов, статусы и история переходов.
// Пока есть незавершенные заказы, список обновляется каждые 5 секунд.

const STATUS: Record<OrderStatus, { label: string; tone: "wait" | "ok" | "bad" | "off" }> = {
  created: { label: "Создан", tone: "wait" },
  pending: { label: "Ждет оплаты", tone: "wait" },
  paid: { label: "Оплачен", tone: "wait" },
  processing: { label: "Выполняется", tone: "wait" },
  completed: { label: "Выполнен", tone: "ok" },
  failed: { label: "Ошибка", tone: "bad" },
  canceled: { label: "Отменен", tone: "off" },
  expired: { label: "Истек", tone: "off" },
};
const FINAL: OrderStatus[] = ["completed", "failed", "canceled", "expired"];
const REFRESH_MS = 5000;

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrdersPage() {
  return (
    <AuthProvider>
      <ModalProvider>
        <div className={s.page}>
          <header className={s.top}>
            <a href={asset("/")} className={s.back}>
              ← На главную
            </a>
            <h1 className={s.title}>Мои заказы</h1>
          </header>
          <Orders />
        </div>
      </ModalProvider>
    </AuthProvider>
  );
}

function Orders() {
  const { user } = useAuth();
  const { openModal } = useModal();
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setOrders(await listOrders());
      setError("");
    } catch (e) {
      setError((e as ApiError).error);
    }
  }, []);

  useEffect(() => {
    if (apiEnabled && user) load();
  }, [user, load]);

  const active = orders?.some((o) => !FINAL.includes(o.status));
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => !document.hidden && load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [active, load]);

  if (!apiEnabled) return <p className={s.note}>Заказы видны только с сервером: запустите проект через Docker или npm run local.</p>;
  if (user === undefined) return <p className={s.note}>Загружаем…</p>;
  if (user === null)
    return (
      <div className={s.note}>
        <p>Войдите, чтобы увидеть свои заказы.</p>
        <button type="button" className={s.btn} onClick={() => openModal("login")}>
          Войти
        </button>
      </div>
    );
  if (error && !orders) return <p className={s.note}>{error}</p>;
  if (!orders) return <p className={s.note}>Загружаем…</p>;
  if (!orders.length)
    return (
      <div className={s.note}>
        <p>Заказов пока нет.</p>
        <a href={asset("/")} className={s.btn}>
          Пополнить Steam
        </a>
      </div>
    );

  return (
    <ul className={s.list}>
      {orders.map((o) => (
        <OrderRow key={`${o.id}:${o.status}`} order={o} onChange={load} />
      ))}
    </ul>
  );
}

function OrderRow({ order, onChange }: { order: OrderDto; onChange: () => void }) {
  const [history, setHistory] = useState<OrderDto["history"]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const st = STATUS[order.status];
  const cancelable = order.status === "created" || order.status === "pending";

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelOrder(order.id);
      onChange();
    } catch (e) {
      setError((e as ApiError).error);
      setBusy(false);
    }
  };

  // заказ без счета (платежка была недоступна) - создать счет через /pay; окно открывается сразу по клику,
  // иначе браузер заблокирует всплывающее; при ошибке закрывается (ревью F8)
  const pay = async () => {
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    setBusy(true);
    setError("");
    try {
      const url = await payOrder(order.id);
      if (win && !win.closed) win.location.href = url;
      else window.location.assign(url);
      onChange();
    } catch (e) {
      win?.close();
      setError((e as ApiError).error);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={s.card}>
      <div className={s.main}>
        <div>
          <div className={s.sum}>{money(order.amount, order.currency)}</div>
          <div className={s.meta}>
            Пополнение Steam · <b>{order.steamLogin}</b> · {when(order.createdAt)}
          </div>
        </div>
        <span className={s.status} data-tone={st.tone}>
          {st.label}
        </span>
      </div>

      {cancelable && (
        <div className={s.actions}>
          {order.paymentUrl ? (
            <a href={order.paymentUrl} target="_blank" rel="noopener noreferrer" className={s.btn}>
              Оплатить
            </a>
          ) : (
            <button type="button" className={s.btn} onClick={pay} disabled={busy}>
              Оплатить
            </button>
          )}
          <button type="button" className={s.btnGhost} onClick={cancel} disabled={busy}>
            Отменить
          </button>
          <span className={s.hint}>Оплатить до {when(order.expiresAt)}</span>
        </div>
      )}
      {error && <p className={s.error}>{error}</p>}

      <details
        className={s.details}
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open && !history) getOrder(order.id).then((o) => setHistory(o.history), () => {});
        }}
      >
        <summary>История статусов</summary>
        {history ? (
          <ol className={s.history}>
            {history.map((h, i) => (
              <li key={i}>
                <span className={s.histTime}>{when(h.at)}</span>
                <b>{STATUS[h.to].label}</b>
                {h.reason && <span className={s.histReason}> - {h.reason}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.hint}>Загружаем…</p>
        )}
        <p className={s.id}>Заказ {order.id}</p>
      </details>
    </li>
  );
}
