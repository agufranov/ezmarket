// Весь проект локально без Docker: npm run local (из корня репозитория)
//   сайт   http://localhost:3010  (Next dev, /api проксируется на сервер - один адрес, как nginx в Docker)
//   письма http://localhost:1080  (MailDev: сюда приходят коды входа)
// База - настоящая PostgreSQL из npm-пакета embedded-postgres, данные в .local/ (не в git).
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(serverDir, "..");
const dataDir = process.env.LOCAL_DATA_DIR || path.join(root, ".local");
const PORTS = { db: 5434, api: 3001, web: 3010, smtp: 1025, mail: 1080 };

if (!existsSync(path.join(serverDir, "node_modules"))) {
  console.log("Ставлю зависимости сервера...");
  execSync("npm install --no-audit --no-fund", { cwd: serverDir, stdio: "inherit", shell: true });
}
const { default: EmbeddedPostgres } = await import("embedded-postgres");
const { MailDev } = await import("maildev");

mkdirSync(dataDir, { recursive: true });

// секрет для кодов входа - один раз на машину, в репозиторий не попадает
const secretFile = path.join(dataDir, "auth_code_secret");
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString("base64url"));
const AUTH_CODE_SECRET = readFileSync(secretFile, "utf8").trim();

const pgDir = path.join(dataDir, "pg");
const pg = new EmbeddedPostgres({
  databaseDir: pgDir,
  user: "ezmarket",
  password: "ezmarket",
  port: PORTS.db,
  persistent: true,
  // кодировка UTF-8 вместо системной Windows-1251; лог initdb не нужен
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});
if (!existsSync(path.join(pgDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
await pg.createDatabase("ezmarket").catch(() => {});
const DATABASE_URL = `postgresql://ezmarket:ezmarket@localhost:${PORTS.db}/ezmarket`;
execSync("npx prisma migrate deploy", { cwd: serverDir, stdio: "inherit", shell: true, env: { ...process.env, DATABASE_URL } });

const maildev = new MailDev({ smtp: PORTS.smtp, web: PORTS.mail, silent: true });
await maildev.start();

const children = [];
const run = (name, args, cwd, env) => {
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  child.on("exit", (code) => code && console.log(`[${name}] завершился с кодом ${code}`));
  children.push(child);
};

run("api", [path.join(serverDir, "node_modules/@nestjs/cli/bin/nest.js"), "start", "--watch"], serverDir, {
  NODE_ENV: "development",
  PORT: String(PORTS.api),
  DATABASE_URL,
  AUTH_CODE_SECRET,
  COOKIE_SECURE: "false",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(PORTS.smtp),
});
run("web", [path.join(root, "node_modules/next/dist/bin/next"), "dev", root, "-p", String(PORTS.web)], root, {
  // своя папка сборки - не мешает обычному npm run dev
  NEXT_DIST_DIR: ".next-local",
  API_PROXY: `http://localhost:${PORTS.api}`,
  NEXT_PUBLIC_API_URL: "/api",
});

console.log(`\n  сайт    http://localhost:${PORTS.web}\n  письма  http://localhost:${PORTS.mail}\n  Ctrl+C - остановить все\n`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  await maildev.stop().catch(() => {});
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
