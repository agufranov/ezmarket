import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отдельная папка сборки для проверок (NEXT_DIST_DIR=.next-check npm run build),
  // чтобы не затирать кэш запущенного dev-сервера в .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
