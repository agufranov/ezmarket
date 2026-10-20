import { hits } from "@/data/mocks";
import { routes } from "@/config/routes";
import { site } from "@/config/site";
import { Icon } from "@/components/ui/Icon";
import { MoreLink } from "@/components/ui/MoreLink";
import { Countdown } from "@/components/ui/Countdown";
import { ProductCard } from "@/components/ui/ProductCard";
import s from "./Hits.module.scss";

export function Hits() {
  return (
    <section className={s.panel} aria-labelledby="hits-title">
      <div className={s.ribbon}>
        <span className={s.ribbonCircle} aria-hidden />
        <span className={s.icon} aria-hidden>
          <Icon src="/img/icons/fire.svg" size={20} />
        </span>
        <div className={s.heading}>
          <h2 id="hits-title" className={s.title}>
            Хиты недели
          </h2>
          <p className={s.sub}>Самое популярное за 7 дней</p>
        </div>
        <div className={s.timer}>
          <span className={s.timerLabel}>обновим через</span>
          <Countdown durationMs={site.hitsRefreshInMs} />
        </div>
        <MoreLink href={routes.hits} variant="onOrange" className={s.more}>
          Все хиты
        </MoreLink>
      </div>
      <div className={s.grid}>
        {hits.map((p) => (
          <ProductCard key={p.id} product={p} className={s.card} />
        ))}
      </div>
    </section>
  );
}
