import s from "./Mascot.module.scss";

type Props = {
  size: number;
  mood?: "happy" | "surprised";
  // Аксессуары из макета: монета-₽ и руки (бонусы), рука сбоку (футер, hero)
  coin?: boolean;
  hands?: boolean;
  sideHand?: boolean;
  float?: boolean;
  floatDuration?: number;
  className?: string;
};

// Маскот собран из CSS-фигур так же, как в макете (там он тоже не растровый).
// Размеры заданы в em от базы 112 px, поэтому масштабируется одним параметром size.
export function Mascot({ size, mood = "happy", coin, hands, sideHand, float, floatDuration = 3.6, className }: Props) {
  return (
    <div
      className={[s.mascot, float && s.float, className].filter(Boolean).join(" ")}
      style={{ fontSize: size / 112, ["--float-d" as string]: `${floatDuration}s` }}
      aria-hidden
    >
      <div className={s.body} />
      <div className={s.eyes}>
        <span className={s.eye} />
        <span className={s.eye} />
      </div>
      <span className={`${s.cheek} ${s.cheekL}`} />
      <span className={`${s.cheek} ${s.cheekR}`} />
      <span className={mood === "happy" ? s.mouth : s.mouthO} />
      {hands && (
        <>
          <span className={`${s.hand} ${s.handL}`} />
          <span className={`${s.hand} ${s.handR}`} />
        </>
      )}
      {sideHand && <span className={s.sideHand} />}
      {coin && (
        <span className={s.coin}>
          <span className={s.coinText}>₽</span>
        </span>
      )}
    </div>
  );
}
