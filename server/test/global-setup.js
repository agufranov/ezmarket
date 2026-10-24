// Перед тестами - миграции на тестовую базу (без удаления данных: таблицы чистит каждый тест сам)
const { execSync } = require("node:child_process");

module.exports = async () => {
  const url = process.env.TEST_DATABASE_URL || "postgresql://ezmarket:ezmarket@localhost:5433/ezmarket_test";
  process.env.TEST_DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
};
