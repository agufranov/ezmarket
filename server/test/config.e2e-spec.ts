import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../src/config";

// Настройки сервера: запуск «одной командой» без .env (docker compose передает пустые строки)
describe("config", () => {
  const required = {
    DATABASE_URL: "postgresql://u:p@db:5432/ezmarket",
    AUTH_CODE_SECRET: "x".repeat(32),
    PAYMENT_WEBHOOK_SECRET: "y".repeat(32),
  };

  // файлы из корня репозитория: в Docker-образе тестов есть только server/ - там эти проверки пропускаются,
  // а настоящий запуск без .env проверяет шаг CI «Весь проект (docker compose up)»
  const composeFile = path.join(__dirname, "../../docker-compose.yml");
  const exampleFile = path.join(__dirname, "../../.env.example");
  const withRepoFiles = existsSync(composeFile) && existsSync(exampleFile) ? it : it.skip;

  it("пустые необязательные настройки считаются не заданными", () => {
    // значения, которые docker compose передает пустыми (`${NAME:-}`) при запуске без .env
    const empty = { SITE_URL: "", CRYPTOPAY_TOKEN: "", SMTP_USER: "", SMTP_PASS: "", CRYPTOPAY_API_URL: " " };
    const c = loadConfig({ ...empty, ...required });
    expect(c.SITE_URL).toBeUndefined();
    expect(c.CRYPTOPAY_TOKEN).toBeUndefined();
    expect(c.SMTP_USER).toBeUndefined();
    expect(c.CRYPTOPAY_API_URL).toBeUndefined();
    expect(c.PAYMENT_PROVIDER).toBe("fake");
  });

  withRepoFiles("все пустые по умолчанию переменные из docker-compose.yml не роняют запуск", () => {
    const compose = readFileSync(composeFile, "utf8");
    const empty = [...compose.matchAll(/^\s+([A-Z0-9_]+): \$\{[A-Z0-9_]+:-\}\s*$/gm)].map((m) => m[1]);
    expect(empty).toEqual(expect.arrayContaining(["SITE_URL", "CRYPTOPAY_TOKEN", "AUTH_CODE_SECRET", "SMTP_USER"]));
    const env = Object.fromEntries(empty.map((k) => [k, ""]));
    const c = loadConfig({ ...env, ...required });
    expect(c.SITE_URL).toBeUndefined();
    expect(c.CRYPTOPAY_TOKEN).toBeUndefined();
  });

  withRepoFiles("пустые строки из .env.example тоже не роняют запуск", () => {
    const example = readFileSync(exampleFile, "utf8");
    const env = Object.fromEntries([...example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2]]));
    expect(() => loadConfig({ ...env, ...required })).not.toThrow();
  });

  it("заданный, но неверный адрес - по-прежнему ошибка", () => {
    expect(() => loadConfig({ ...required, SITE_URL: "не адрес" })).toThrow(/SITE_URL/);
  });

  it("cryptopay без токена - ошибка, пустой токен = не задан", () => {
    expect(() => loadConfig({ ...required, PAYMENT_PROVIDER: "cryptopay", CRYPTOPAY_TOKEN: "" })).toThrow(/CRYPTOPAY_TOKEN/);
  });
});
