import Image from "next/image";
import { rating, reviews } from "@/data/mocks";
import { routes } from "@/config/routes";
import { Icon } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { MoreLink } from "@/components/ui/MoreLink";
import { SectionTitle } from "@/components/ui/SectionTitle";
import s from "./Reviews.module.scss";

function Stars({ value, variant }: { value: number; variant: "white" | "orange" }) {
  return (
    <span className={`${s.stars} ${s[variant]}`} role="img" aria-label={`Оценка ${value} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < value ? s.on : s.off}>
          <Icon src={variant === "white" ? "/img/icons/star-orange.svg" : "/img/icons/star-white.svg"} size={12} />
        </span>
      ))}
    </span>
  );
}

export function Reviews() {
  return (
    <section className={s.section} aria-labelledby="reviews-title">
      <SectionTitle id="reviews-title" action={<MoreLink href={routes.reviews}>Все отзывы</MoreLink>}>
        Последние отзывы
      </SectionTitle>
      <div className={s.row}>
        <a href={routes.reviews} className={s.rating}>
          <span className={s.ratingCircle} aria-hidden />
          <span className={s.ratingCircle2} aria-hidden />
          <span className={s.ratingValue}>{rating.value}</span>
          <Stars value={5} variant="white" />
          <span className={s.ratingCount}>{rating.count}</span>
          <Mascot size={70} mood="surprised" float floatDuration={3.4} className={s.ratingMascot} />
        </a>
        <ul className={s.cards}>
          {reviews.map((r) => (
            <li key={r.id} className={s.card}>
              <div className={s.cardTop}>
                <Stars value={r.stars} variant="orange" />
                <p className={s.text}>{r.text}</p>
                <a href={routes.product(r.productSlug)} className={s.chip}>
                  <Image src={r.productIcon} alt="" width={24} height={24} />
                  {r.product}
                </a>
              </div>
              <div className={s.author}>
                <span className={s.avatar} style={{ background: r.color }} aria-hidden>
                  {r.author[0]}
                </span>
                <div>
                  <p className={s.name}>{r.author}</p>
                  <p className={s.date}>{r.date}</p>
                </div>
                <span className={s.verified}>
                  <Icon src="/img/icons/check.svg" size={13} />
                  Покупка
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
