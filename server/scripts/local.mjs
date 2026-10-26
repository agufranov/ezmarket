// Весь проект локально без Docker: npm run local (из корня репозитория)
//   сайт   http://localhost:3010  (Next dev, /api проксируется на сервер - один адрес, как nginx в Docker)
//   письма http://localhost:1080  (MailDev: сюда приходят коды входа)
// База - настоящая PostgreSQL из npm-пакета embedded-postgres, данные в .local/ (не в git).
import { execSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
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
const webhookSecretFile = path.join(dataDir, "payment_webhook_secret");
if (!existsSync(webhookSecretFile)) writeFileSync(webhookSecretFile, randomBytes(48).toString("base64url"));
const PAYMENT_WEBHOOK_SECRET = readFileSync(webhookSecretFile, "utf8").trim();

// платежка и минимум заказа из .env в корне (там же токен Crypto Pay - в git он не попадает); без .env - встроенная тестовая
const dotenv = {};
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== "") dotenv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const payment = Object.fromEntries(
  ["PAYMENT_PROVIDER", "CRYPTOPAY_TOKEN", "CRYPTOPAY_NETWORK", "ORDER_MIN_AMOUNT"].filter((k) => dotenv[k]).map((k) => [k, dotenv[k]]),
);

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
// база могла остаться запущенной после прошлого запуска - тогда работаем с ней
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const portBusy = (port) =>
  new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1", () => (sock.destroy(), resolve(true)));
    sock.on("error", () => resolve(false));
  });
const { default: pgLib } = await import("pg");
const answers = async () => {
  const client = new pgLib.Client({
    host: "127.0.0.1",
    port: PORTS.db,
    user: "ezmarket",
    password: "ezmarket",
    database: "postgres",
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    client.end().catch(() => {});
  }
};
let reuse = false;
// база может как раз выключаться: несколько попыток, пока она ответит или освободит порт
for (let i = 0; i < 3 && (await portBusy(PORTS.db)); i++) {
  if ((reuse = await answers())) break;
  await sleep(500);
}
if (reuse) console.log(`PostgreSQL уже запущен на порту ${PORTS.db} - подключаюсь к нему`);
else {
  // на Windows дочерние процессы PostgreSQL переживают убитый родительский: держат порт и не дают базе стартовать
  if (process.platform === "win32") {
    // путь к exe у них не читается (урезанные права) - ищем по командной строке, там путь с прямыми слэшами
    const bin = path.join(serverDir, "node_modules", "@embedded-postgres").replaceAll("\\", "/").replaceAll("'", "''");
    const ps = `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -like '*${bin}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    spawnSync("powershell", ["-NoProfile", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")], { stdio: "ignore" });
  }
  for (let i = 0; i < 20 && (await portBusy(PORTS.db)); i++) await sleep(500);
  rmSync(path.join(pgDir, "postmaster.pid"), { force: true });
  await pg.start();
}
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
  PAYMENT_WEBHOOK_SECRET,
  COOKIE_SECURE: "false",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(PORTS.smtp),
  // для ручных проверок: повторный код через 5 с, лимита в час почти нет
  AUTH_RESEND_SECONDS: "5",
  AUTH_CODES_PER_HOUR: "1000",
  // код сразу подставляется в поле - без похода в почту
  AUTH_DEMO_CODE: "true",
  ...payment,
  // «Вернуться в магазин» после оплаты в боте Crypto Pay
  SITE_URL: `http://localhost:${PORTS.web}`,
});
// сайт - после сервера, иначе первые запросы к /api получат ошибку прокси
for (let i = 0; i < 120 && !(await portBusy(PORTS.api)); i++) await sleep(500);
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
