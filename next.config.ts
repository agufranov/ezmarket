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
  // Разработка с сервером: API_PROXY=http://localhost:3001 NEXT_PUBLIC_API_URL=/api npm run dev -
  // /api на том же адресе, что и сайт (как nginx в Docker), cookie сессии работают без CORS
  ...(process.env.API_PROXY && {
    rewrites: async () => [{ source: "/api/:path*", destination: `${process.env.API_PROXY}/api/:path*` }],
  }),
};

export default nextConfig;
