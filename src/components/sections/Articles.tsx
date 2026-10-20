import { articles } from "@/data/mocks";
import { routes } from "@/config/routes";
import { Icon } from "@/components/ui/Icon";
import { MoreLink } from "@/components/ui/MoreLink";
import { SectionTitle } from "@/components/ui/SectionTitle";
import s from "./Articles.module.scss";

function Meta({ date, views, light }: { date: string; views: string; light?: boolean }) {
  return (
    <p className={s.meta}>
      <span>
        <Icon src={light ? "/img/icons/calendar-white.svg" : "/img/icons/calendar.svg"} size={14} />
        <time>{date}</time>
      </span>
      <span>
        <Icon src={light ? "/img/icons/eye-white.svg" : "/img/icons/eye.svg"} size={14} />
        {views}
        <span className="visually-hidden"> просмотров</span>
      </span>
    </p>
  );
}

export function Articles() {
  const { main, list } = articles;
  return (
    <section className={s.section} aria-labelledby="articles-title">
      <SectionTitle id="articles-title" action={<MoreLink href={routes.blog}>Все статьи</MoreLink>}>
        Интересные статьи
      </SectionTitle>
      <div className={s.grid}>
        <a href={routes.article(main.slug)} className={s.main}>
          <span className={s.mainImage} aria-hidden />
          <div className={s.mainBody}>
            <span className={s.tagLight}>{main.tag}</span>
            <h3 className={s.mainTitle}>{main.title}</h3>
            <Meta date={main.date} views={main.views} light />
          </div>
        </a>
        <ul className={s.list}>
          {list.map((a) => (
            <li key={a.slug}>
              <a href={routes.article(a.slug)} className={s.item}>
                <span className={s.thumb} style={{ backgroundImage: a.gradient }} aria-hidden />
                <div className={s.itemBody}>
                  <span className={s.tag}>{a.tag}</span>
                  <h3 className={s.itemTitle}>{a.title}</h3>
                  <Meta date={a.date} views={a.views} />
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
