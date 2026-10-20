import s from "./SkeletonCard.module.scss";

// Повторяет геометрию ProductCard: обложка, мета, название, цена, кнопка
export function SkeletonCard() {
  return (
    <div className={s.card} aria-hidden>
      <span className={`${s.bar} ${s.cover}`} />
      <span className={`${s.bar} ${s.meta}`} />
      <span className={`${s.bar} ${s.title}`} />
      <span className={`${s.bar} ${s.price}`} />
      <span className={`${s.bar} ${s.btn}`} />
    </div>
  );
}
