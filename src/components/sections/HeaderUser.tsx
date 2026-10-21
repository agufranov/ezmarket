"use client";

/* eslint-disable @next/next/no-img-element -- маленькие иконки уведомлений */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { mockNotifications, type AppNotification, type NotificationType, type User } from "@/data/user";
import { routes } from "@/config/routes";
import { asset } from "@/lib/asset";
import { formatNumber, plural } from "@/lib/format";
import { Mascot } from "@/components/ui/Mascot";
import { useHeaderPopover, focusFirst } from "./useHeaderPopover";
import {
  BellIcon,
  BoxIcon,
  Coin,
  GearIcon,
  GiftIcon,
  HeadsetIcon,
  HomeIcon,
  LogoutIcon,
  UsersIcon,
} from "./HeaderIcons";
import s from "./HeaderUser.module.scss";

export type UserPopover = "profile" | "notif";

type Props = {
  user: User;
  open: UserPopover | null;
  setOpen: (p: UserPopover | null) => void;
  rowRef: RefObject<HTMLDivElement | null>;
  onLogout: () => void;
  onHelp: () => void;
};

const READ_KEY = "ez_notif_read";
const TAB_KEY = "ez_notif_tab";
const bonusWord = (n: number) => plural(n, ["бонус", "бонуса", "бонусов"]);
const badge = (n: number, max: number) => (n > max ? `${max}+` : String(n));

function timeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} ч`;
  if (minutes < 48 * 60) return "Вчера";
  return new Date(Date.now() - minutes * 60000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

const tabs: { id: "all" | Exclude<NotificationType, "promo">; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "order", label: "Заказы" },
  { id: "bonus", label: "Бонусы" },
  { id: "referral", label: "Рефералы" },
];

// Правая часть шапки авторизованного пользователя (ТЗ 12.4): колокольчик и чип профиля с поповерами
export function HeaderUser({ user, open, setOpen, rowRef, onLogout, onHelp }: Props) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Уведомления: ?notif=0 - пустой список для демо «Пока тихо»; прочитанные - в localStorage
  const [items, setItems] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  useEffect(() => {
    const empty = new URLSearchParams(window.location.search).get("notif") === "0";
    let read: string[] = [];
    try {
      read = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
      const t = sessionStorage.getItem(TAB_KEY);
      if (tabs.some((x) => x.id === t)) setTab(t as typeof tab);
    } catch {}
    setItems(empty ? [] : mockNotifications.map((n) => ({ ...n, read: n.read || read.includes(n.id) })));
  }, []);

  const saveRead = (list: AppNotification[]) => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(list.filter((n) => n.read).map((n) => n.id).slice(0, 200)));
    } catch {}
  };
  const markRead = (ids: string[] | "all") => {
    const next = items.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n));
    setItems(next);
    saveRead(next);
  };
  const pickTab = (id: typeof tab) => {
    setTab(id);
    try {
      sessionStorage.setItem(TAB_KEY, id);
    } catch {}
  };

  const unread = items.filter((n) => !n.read).length;
  const shown = useMemo(() => (tab === "all" ? items : items.filter((n) => n.type === tab)), [items, tab]);

  const close = useCallback(
    (which: UserPopover, returnFocus?: boolean) => {
      if (open === which) setOpen(null);
      if (returnFocus) (which === "profile" ? chipRef : bellRef).current?.focus();
    },
    [open, setOpen],
  );
  const closeProfile = useCallback((f?: boolean) => close("profile", f), [close]);
  const closeNotif = useCallback((f?: boolean) => close("notif", f), [close]);

  const profileNose = useHeaderPopover({ open: open === "profile", onClose: closeProfile, triggerRef: chipRef, panelRef: profileRef, rowRef });
  const notifNose = useHeaderPopover({ open: open === "notif", onClose: closeNotif, triggerRef: bellRef, panelRef: notifRef, rowRef });

  const initial = (user.name || user.email).trim()[0]?.toUpperCase();

  return (
    <div className={s.user}>
      <button
        ref={bellRef}
        type="button"
        className={s.bell}
        aria-haspopup="dialog"
        aria-expanded={open === "notif"}
        aria-controls="notif-panel"
        aria-label={unread ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
        onClick={(e) => {
          setOpen(open === "notif" ? null : "notif");
          if (open !== "notif" && e.detail === 0) focusFirst(notifRef.current);
        }}
      >
        <BellIcon />
        <span className={s.bellBadge} data-hidden={!unread || undefined} aria-hidden>
          {badge(unread, 9)}
        </span>
        <span className={s.tip} aria-hidden>
          Уведомления
        </span>
      </button>

      <button
        ref={chipRef}
        type="button"
        className={s.chip}
        aria-haspopup="menu"
        aria-expanded={open === "profile"}
        aria-controls="profile-menu"
        onClick={(e) => {
          setOpen(open === "profile" ? null : "profile");
          if (open !== "profile" && e.detail === 0) focusFirst(profileRef.current);
        }}
      >
        <span className={s.chipAvatar} aria-hidden>
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <Coin size={22} />}
        </span>
        <span className={s.chipText}>
          <span className={s.chipName} title={user.name}>
            {user.name}
          </span>
          <span className={s.chipBonus}>
            <span className={s.chipCoin}>
              <Coin size={14} />
            </span>
            {formatNumber(user.bonuses)} {bonusWord(user.bonuses)}
            <span className={s.tip} aria-hidden>
              1 бонус = 1 ₽
            </span>
          </span>
        </span>
        <svg className={s.chevron} width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
          <path d="m1.5 1.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* --- меню профиля (12.10) --- */}
      <div
        ref={profileRef}
        id="profile-menu"
        role="menu"
        aria-label="Меню профиля"
        className={`${s.panel} ${s.profile}`}
        data-open={open === "profile" || undefined}
        style={{ ["--nose-right" as string]: `${profileNose}px` }}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(null)}
      >
        <a href={routes.page("account")} role="menuitem" tabIndex={open === "profile" ? 0 : -1} className={s.card}>
          <span className={s.cardCircle} aria-hidden />
          <span className={s.cardDot} aria-hidden />
          <span className={s.cardAvatar} aria-hidden>
            {initial}
          </span>
          <span className={s.cardWho}>
            <b>{user.name}</b>
            <span>{user.email}</span>
          </span>
        </a>
        <a href={routes.page("bonuses")} role="menuitem" tabIndex={open === "profile" ? 0 : -1} className={s.bonusRow}>
          <span className={s.bonusCoin}>
            <Coin size={26} />
          </span>
          <b>{formatNumber(user.bonuses)}</b>
          <span>{bonusWord(user.bonuses)} · 1 бонус = 1 ₽</span>
        </a>

        <div className={s.tiles}>
          {[
            { id: "orders", label: "Заказы", icon: <BoxIcon />, count: user.counters.orders },
            { id: "bonuses", label: "Бонусы", icon: <GiftIcon />, count: 0 },
            { id: "referrals", label: "Рефералы", icon: <UsersIcon />, count: user.counters.referrals },
          ].map((t) => (
            <a key={t.id} href={routes.page(t.id)} role="menuitem" tabIndex={open === "profile" ? 0 : -1} className={s.tile}>
              <span className={s.tileIcon}>
                {t.icon}
                {t.count > 0 && <span className={s.tileBadge}>{badge(t.count, 99)}</span>}
              </span>
              {t.label}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            tabIndex={open === "profile" ? 0 : -1}
            className={s.tile}
            onClick={() => {
              setOpen(null);
              onHelp();
            }}
          >
            <span className={s.tileIcon}>
              <HeadsetIcon />
            </span>
            Помощь
          </button>
        </div>

        <a href={routes.page("account")} role="menuitem" tabIndex={open === "profile" ? 0 : -1} className={s.row}>
          <span className={s.rowIcon}>
            <HomeIcon />
          </span>
          <span>Личный кабинет</span>
        </a>
        <a href={routes.page("settings")} role="menuitem" tabIndex={open === "profile" ? 0 : -1} className={s.row}>
          <span className={s.rowIcon}>
            <GearIcon />
          </span>
          <span>Настройки</span>
        </a>
        <hr className={s.divider} />
        <button
          type="button"
          role="menuitem"
          tabIndex={open === "profile" ? 0 : -1}
          className={`${s.row} ${s.logout}`}
          onClick={() => {
            setOpen(null);
            onLogout();
          }}
        >
          <span className={s.rowIcon}>
            <LogoutIcon />
          </span>
          <span>Выйти</span>
        </button>
      </div>

      {/* --- уведомления (12.11) и «Пока тихо» (12.12) --- */}
      <div
        ref={notifRef}
        id="notif-panel"
        role="dialog"
        aria-label="Уведомления"
        className={`${s.panel} ${items.length ? s.notif : s.quiet}`}
        data-open={open === "notif" || undefined}
        style={{ ["--nose-right" as string]: `${notifNose}px` }}
      >
        {items.length === 0 ? (
          <Quiet />
        ) : (
          <>
            <div className={s.notifHead}>
              <h2 className={s.notifTitle}>Уведомления</h2>
              <button
                type="button"
                className={s.readAll}
                tabIndex={open === "notif" ? 0 : -1}
                disabled={!unread}
                onClick={() => markRead("all")}
              >
                Прочитать все
              </button>
            </div>
            <div className={s.tabs} role="tablist" aria-label="Тип уведомлений">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  tabIndex={open === "notif" ? 0 : -1}
                  className={s.tab}
                  onClick={() => pickTab(t.id)}
                >
                  {t.label}
                  {t.id === "all" && (
                    <span className={s.tabCount} data-hidden={!unread || undefined}>
                      {badge(unread, 9)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div key={tab} className={s.list}>
              {shown.length === 0 ? (
                <Quiet compact />
              ) : (
                shown.map((n) => (
                  <a
                    key={n.id}
                    href={routes.page(`notification-${n.id}`)}
                    tabIndex={open === "notif" ? 0 : -1}
                    className={s.item}
                    data-unread={!n.read || undefined}
                    onClick={() => {
                      markRead([n.id]);
                      setOpen(null);
                    }}
                  >
                    <span className={s.itemIcon} aria-hidden>
                      {n.icon === "coin" ? <Coin size={24} /> : <img src={asset(n.icon)} alt="" width={40} height={40} />}
                    </span>
                    <span className={s.itemCard}>
                      <span className={s.itemText}>
                        {n.text.map((p, i) => (p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}
                      </span>
                      <span className={s.itemTime}>{timeLabel(n.minutesAgo)}</span>
                      <span className={s.itemDot} aria-hidden />
                    </span>
                  </a>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// «Пока тихо» (12.12): отдельной панелью при пустом списке или внутри панели при пустом фильтре
function Quiet({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? `${s.quietBody} ${s.quietCompact}` : s.quietBody}>
      <span className={s.quietMascot}>
        <Mascot size={compact ? 72 : 96} mood="sleepy" />
        <span className={s.zz} aria-hidden>
          <i>z</i>
          <i>z</i>
        </span>
      </span>
      <b className={s.quietTitle}>Пока тихо</b>
      <span className={s.quietText}>Здесь появятся статусы заказов, бонусы и новости от друзей</span>
    </div>
  );
}
