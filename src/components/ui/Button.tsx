import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./Button.module.scss";

type Variant = "primary" | "dark" | "graphite" | "soft" | "white";

type Common = {
  variant?: Variant;
  size?: "md" | "sm";
  arrow?: boolean;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const arrowFor: Record<Variant, string> = {
  primary: "/img/icons/arrow-dark.svg",
  dark: "/img/icons/arrow-dark.svg",
  graphite: "/img/icons/arrow-login.svg",
  soft: "/img/icons/arrow-dark.svg",
  white: "/img/icons/arrow-dark.svg",
};

export function Button(props: AsButton | AsLink) {
  const { variant = "primary", size = "md", arrow, loading, block, children, className, ...rest } = props;
  const cls = [s.btn, s[variant], s[size], arrow && s.withArrow, block && s.block, loading && s.loading, className]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className={s.label}>{children}</span>
      {arrow && (
        <span className={s.arrow} aria-hidden>
          {loading ? <span className={s.spinner} /> : <Icon src={arrowFor[variant]} width={7} height={11} />}
        </span>
      )}
      {!arrow && loading && <span className={s.spinner} aria-hidden />}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  const btn = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={cls} aria-busy={loading || undefined} {...btn} disabled={btn.disabled || loading}>
      {inner}
    </button>
  );
}
