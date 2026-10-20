import Image from "next/image";
import { Mascot } from "@/components/ui/Mascot";
import { Icon } from "@/components/ui/Icon";
import s from "./HeroArt.module.scss";

// Правая часть главного баннера по слоям из Figma (узел 1:121), все слои прозрачные.
// Временное решение: по ТЗ баннеры - готовые картинки, их ждем от заказчика.
// Целиком PNG из Figma не годится - экспорт запекает фон баннера и дает шов на других ширинах.
export function HeroArt({ className }: { className?: string }) {
  return (
    <div className={[s.art, className].filter(Boolean).join(" ")} aria-hidden>
      <span className={s.halo} />
      <span className={s.steam}>
        <Image src="/img/brands/steam.png" alt="" width={110} height={110} priority />
      </span>
      <span className={s.rub}>₽</span>
      <Mascot size={150} sideHand className={s.mascot} />
      <span className={s.chip}>
        <Icon src="/img/icons/coin.svg" size={30} />
        +5%
      </span>
    </div>
  );
}
