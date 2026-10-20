import { asset } from "./asset";

// Лоадер next/image для статического экспорта: без оптимизации, только префикс подпапки
export default function imageLoader({ src, width }: { src: string; width: number }) {
  return `${asset(src)}?w=${width}`;
}
