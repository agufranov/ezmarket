import { Icon } from "./Icon";
import s from "./MoreLink.module.scss";

type Props = {
  href: string;
  children: string;
  // onOrange - на оранжевой ленте "Хиты", plain - "Смотреть все", pill - белая плашка ("Все статьи")
  variant?: "onOrange" | "plain" | "pill";
  className?: string;
};

export function MoreLink({ href, children, variant = "pill", className }: Props) {
  return (
    <a href={href} className={[s.link, s[variant], className].filter(Boolean).join(" ")}>
      <span className={s.text}>{children}</span>
      <span className={s.circle} aria-hidden>
        <Icon src="/img/icons/arrow-dark-sm.svg" width={7} height={11} className={s.dark} />
        <Icon src="/img/icons/arrow-white.svg" width={7} height={11} className={s.light} />
      </span>
    </a>
  );
}
