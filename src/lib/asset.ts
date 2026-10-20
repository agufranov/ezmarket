// Префикс для статики: на GitHub Pages сайт живет в подпапке (/ezmarket), локально - в корне
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string) {
  return path.startsWith("/") ? basePath + path : path;
}
