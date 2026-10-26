import { readFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../src/config";

// Настройки сервера: запуск «одной командой» без .env (docker compose передает пустые строки)
describe("config", () => {
  const required = {
    DATABASE_URL: "postgresql://u:p@db:5432/ezmarket",
    AUTH_CODE_SECRET: "x".repeat(32),
    PAYMENT_WEBHOOK_SECRET: "y".repeat(32),
  };

  it("пустые необязательные настройки из docker-compose считаются не заданными", () => {
    // все переменные сервиса api, у которых в docker-compose.yml значение по умолчанию пустое: `${NAME:-}`
    const compose = readFileSync(path.join(__dirname, "../../docker-compose.yml"), "utf8");
    const empty = [...compose.matchAll(/^\s+([A-Z0-9_]+): \$\{[A-Z0-9_]+:-\}\s*$/gm)].map((m) => m[1]);
    expect(empty).toEqual(expect.arrayContaining(["SITE_URL", "CRYPTOPAY_TOKEN", "AUTH_CODE_SECRET", "SMTP_USER"]));

    const env = Object.fromEntries(empty.map((k) => [k, ""]));
    const c = loadConfig({ ...env, ...required });
    expect(c.SITE_URL).toBeUndefined();
    expect(c.CRYPTOPAY_TOKEN).toBeUndefined();
    expect(c.SMTP_USER).toBeUndefined();
    expect(c.PAYMENT_PROVIDER).toBe("fake");
  });

  it("пустые строки из .env.example тоже не роняют запуск", () => {
    const example = readFileSync(path.join(__dirname, "../../.env.example"), "utf8");
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
