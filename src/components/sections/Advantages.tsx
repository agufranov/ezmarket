import { advantages } from "@/data/mocks";
import { Icon } from "@/components/ui/Icon";
import s from "./Advantages.module.scss";

export function Advantages() {
  return (
    <section aria-label="Преимущества">
      <ul className={s.list}>
        {advantages.map((a) => (
          <li key={a.id} className={s.card}>
            <div className={s.art} aria-hidden>
              <span className={s.halo} />
              <span className={s.dash} />
              <span className={s.dot} />
              <span className={s.drop}>
                <Icon src={a.icon} size={32} />
              </span>
            </div>
            <div className={s.text}>
              <h3 className={s.title}>{a.title}</h3>
              <p className={s.desc}>{a.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
