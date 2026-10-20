import type { ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./SectionTitle.module.scss";

type Props = {
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
};

// Заголовок секции с оранжевой "каплей" слева и ссылкой "Все …" справа
export function SectionTitle({ icon, children, action, id }: Props) {
  return (
    <div className={s.head}>
      <span className={s.drop} aria-hidden>
        {icon && <Icon src={icon} size={20} />}
      </span>
      <h2 className={s.title} id={id}>
        {children}
      </h2>
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
