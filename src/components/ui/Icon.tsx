/* eslint-disable @next/next/no-img-element -- мелкие SVG-иконки, оптимизация next/image не нужна */
import { asset } from "@/lib/asset";

type Props = {
  src: string;
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
};

export function Icon({ src, size = 16, width, height, alt = "", className }: Props) {
  return (
    <img
      src={asset(src)}
      width={width ?? size}
      height={height ?? size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      decoding="async"
    />
  );
}
