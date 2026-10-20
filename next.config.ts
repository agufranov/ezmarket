import type { NextConfig } from "next";

// Сборка под GitHub Pages: PAGES_BASE_PATH=/ezmarket npm run build -> статика в out/
const pagesBase = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = {
  // Отдельная папка сборки для проверок (NEXT_DIST_DIR=.next-check npm run build),
  // чтобы не затирать кэш запущенного dev-сервера в .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: { NEXT_PUBLIC_BASE_PATH: pagesBase ?? "" },
  ...(pagesBase !== undefined && {
    output: "export",
    basePath: pagesBase,
    trailingSlash: true,
    images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
  }),
};

export default nextConfig;
