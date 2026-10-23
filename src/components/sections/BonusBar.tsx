"use client";

import { bonusSteps } from "@/data/mocks";
import { useModal } from "@/lib/modal";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";
import s from "./BonusBar.module.scss";

export function BonusBar() {
  const { openModal } = useModal();

  return (
    <section className={s.bar} aria-labelledby="bonus-title">
      <span className={s.blob} aria-hidden />
      <div className={s.mascot}>
        <Mascot size={112} coin hands float floatDuration={3.6} />
      </div>
      <div className={s.text}>
        <h2 id="bonus-title" className={s.title}>
          1 бонус = 1 ₽ скидки
        </h2>
        <p className={s.sub}>
          {/* пробел перед переносом: на мобилке перенос скрыт, и без него слова склеиваются */}
          Копите бонусы за покупки и отзывы{" "}
          <br />- оплачивайте ими до 30% заказа
        </p>
      </div>
      <ol className={s.steps}>
        {bonusSteps.map((step) => (
          <li key={step.label} className={s.step}>
            <span className={s.stepIcon} aria-hidden>
              {step.icon}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      <Button variant="dark" arrow className={s.btn} onClick={() => openModal("bonus")}>
        Как это работает
      </Button>
    </section>
  );
}
