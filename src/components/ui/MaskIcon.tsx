import type { CSSProperties } from "react";
import { asset } from "@/lib/asset";

// size - число в px или CSS-значение (например, переменная, если размер зависит от экрана)
type Props = { src: string; size?: number | string; className?: string };

// Одноцветная SVG-иконка, которая красится через background (currentColor не нужен в самом файле).
// Нужна там, где по ТЗ иконка меняет цвет на hover/active.
export function MaskIcon({ src, size = 16, className }: Props) {
  const style: CSSProperties = {
    width: size,
    height: size,
    flex: "none",
    display: "inline-block",
    background: "var(--icon-color, currentColor)",
    maskImage: `url(${asset(src)})`,
    WebkitMaskImage: `url(${asset(src)})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    transition: "background-color var(--t-base) ease",
  };
  return <span aria-hidden className={className} style={style} />;
}
