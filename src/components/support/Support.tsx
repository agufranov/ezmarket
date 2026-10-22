"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { routes } from "@/config/routes";
import { useModal } from "@/lib/modal";
import { SupportWidget } from "@/components/sections/SupportWidget";
import { SupportMenu } from "./SupportMenu";
import { SupportFaq } from "./SupportFaq";
import { SupportMail } from "./SupportMail";
import { SupportSent, SupportToast } from "./SupportDone";
import s from "./Support.module.scss";

// Поддержка у виджета (ТЗ 12.16-12.20): один компонент со стеком экранов menu → faq | mail → sent → toast
export type Screen = "menu" | "faq" | "mail" | "sent" | "toast";

type Ctx = { openSupport: () => void };
const SupportContext = createContext<Ctx | null>(null);

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error("useSupport must be used inside SupportProvider");
  return ctx;
}

export const telegramUrl = routes.telegramSupport;

export function SupportProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([]);
  const [mailTopic, setMailTopic] = useState<string | undefined>();
  const [sent, setSent] = useState<{ email: string; ticketId: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLButtonElement>(null);
  const { current: modalOpen } = useModal();

  const screen = stack[stack.length - 1] ?? null;
  const go = useCallback((next: Screen) => setStack((st) => [...st, next]), []);
  const back = useCallback(() => setStack((st) => st.slice(0, -1)), []);
  const openSupport = useCallback(() => setStack(["menu"]), []);
  const close = useCallback((returnFocus?: boolean) => {
    setStack([]);
    if (returnFocus) widgetRef.current?.focus();
  }, []);
  // «Письмо отправлено» закрывается в карточку «Готово, мы на связи!»
  const finish = useCallback(() => setStack(["toast"]), []);

  // Esc закрывает, клик вне панели и виджета закрывает (карточку «Готово» - нет, это уведомление)
  useEffect(() => {
    if (!screen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (screen === "sent") finish();
      else close(true);
    };
    const onDown = (e: PointerEvent) => {
      if (screen === "toast") return;
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || widgetRef.current?.contains(t)) return;
      if (screen === "sent") finish();
      else close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [screen, close, finish]);

  // модалка закрывает поддержку
  useEffect(() => {
    if (modalOpen) setStack([]);
  }, [modalOpen]);

  const value = useMemo(() => ({ openSupport }), [openSupport]);
  const isPanel = screen === "faq" || screen === "mail" || screen === "sent";

  return (
    <SupportContext.Provider value={value}>
      {children}
      <div ref={rootRef} className={s.root}>
        {screen === "menu" && <SupportMenu onPick={go} onTelegram={() => close()} />}
        {isPanel && (
          <div key={screen} className={s.panel} role="dialog" aria-labelledby="support-title">
            {screen === "faq" && (
              <SupportFaq
                onBack={back}
                onClose={() => close(true)}
                onWrite={(topic) => {
                  setMailTopic(topic);
                  go("mail");
                }}
              />
            )}
            {screen === "mail" && (
              <SupportMail
                topic={mailTopic}
                onBack={stack.length > 1 ? back : undefined}
                onClose={() => close(true)}
                onSent={(r) => {
                  setSent(r);
                  setMailTopic(undefined);
                  setStack(["sent"]);
                }}
              />
            )}
            {screen === "sent" && sent && <SupportSent {...sent} onDone={finish} />}
          </div>
        )}
        {screen === "toast" && <SupportToast onClose={() => close()} />}
      </div>
      <SupportWidget
        ref={widgetRef}
        open={screen !== null && screen !== "toast"}
        onOpen={() => (screen && screen !== "toast" ? close() : openSupport())}
      />
    </SupportContext.Provider>
  );
}
