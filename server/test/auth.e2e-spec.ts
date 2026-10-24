import request from "supertest";
import { ageCodes, codeFromMail, mail, resetDb, startApp, type TestApp } from "./helpers";

// Вход по коду из письма: критерии из плана недели
describe("auth", () => {
  let t: TestApp;
  const http = () => request(t.url);
  const email = "alex@mail.ru";

  const askCode = (body: object = {}) => http().post("/api/auth/code").send({ email, ...body });
  const verify = (code: string, e = email) => http().post("/api/auth/verify").send({ email: e, code });
  const sessionCookie = (res: request.Response) => {
    const raw = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    return raw.find((c) => c.startsWith("ez_session="))!;
  };

  beforeAll(async () => {
    t = await startApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.logs.length = 0;
  });

  it("код из 6 цифр приходит письмом, в базе только хеш", async () => {
    const res = await askCode();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resendIn: 60 });

    const code = await codeFromMail(t.prisma, email);
    expect(code).toMatch(/^\d{6}$/);
    const rows = await t.prisma.$queryRaw<{ row: string }[]>`SELECT a::text AS row FROM "auth_codes" a`;
    expect(rows).toHaveLength(1);
    expect(rows[0].row).not.toContain(code);
  });

  it("email без учета регистра и пробелов", async () => {
    await askCode({ email: "  Alex@Mail.RU " });
    const res = await verify(await codeFromMail(t.prisma, email), "ALEX@mail.ru");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("верный код - вход: cookie сессии httpOnly, /me отдает пользователя", async () => {
    await askCode();
    const res = await verify(await codeFromMail(t.prisma, email));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email, bonuses: 0 });

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await http().get("/api/me").set("Cookie", cookie.split(";")[0]);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    // в базе хеш токена, а не сам токен
    const token = cookie.split(";")[0].split("=")[1];
    const sessions = await t.prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(token);
  });

  it("код одноразовый", async () => {
    await askCode();
    const code = await codeFromMail(t.prisma, email);
    expect((await verify(code)).status).toBe(200);
    const again = await verify(code);
    expect(again.status).toBe(422);
    expect(again.body.field).toBe("code");
  });

  it("код действует 10 минут", async () => {
    await askCode();
    const code = await codeFromMail(t.prisma, email);
    await ageCodes(t.prisma, email, 10 * 60 * 1000 + 1000);
    expect((await verify(code)).status).toBe(422);
  });

  it("новый код не чаще раза в минуту", async () => {
    expect((await askCode()).status).toBe(200);
    const res = await askCode();
    expect(res.status).toBe(429);
    expect(res.body.retryIn).toBeGreaterThan(0);
    expect(res.body.retryIn).toBeLessThanOrEqual(60);

    await ageCodes(t.prisma, email, 61 * 1000);
    expect((await askCode()).status).toBe(200);
  });

  it("не больше 5 кодов в час", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await askCode()).status).toBe(200);
      await ageCodes(t.prisma, email, 61 * 1000);
    }
    const res = await askCode();
    expect(res.status).toBe(429);
    expect(await t.prisma.authCode.count({ where: { email } })).toBe(5);

    // через час от первого кода - снова можно
    await ageCodes(t.prisma, email, 60 * 60 * 1000);
    expect((await askCode()).status).toBe(200);
  });

  it("лимиты считаются отдельно для каждого email", async () => {
    expect((await askCode()).status).toBe(200);
    expect((await http().post("/api/auth/code").send({ email: "other@mail.ru" })).status).toBe(200);
  });

  it("после 5 неверных попыток код сгорает", async () => {
    await askCode();
    const code = await codeFromMail(t.prisma, email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let left = 4; left >= 1; left--) {
      const res = await verify(wrong);
      expect(res.status).toBe(422);
      expect(res.body.attemptsLeft).toBe(left);
    }
    const fifth = await verify(wrong);
    expect(fifth.status).toBe(422);
    expect(fifth.body.attemptsLeft).toBeUndefined();
    // даже верный код больше не подходит
    expect((await verify(code)).status).toBe(422);
  });

  it("новый код гасит прошлый", async () => {
    await askCode();
    const first = await codeFromMail(t.prisma, email);
    await ageCodes(t.prisma, email, 61 * 1000);
    await askCode();
    const second = await codeFromMail(t.prisma, email);
    if (first !== second) expect((await verify(first)).status).toBe(422);
    expect((await verify(second)).status).toBe(200);
  });

  it("10 одновременных проверок одного кода - ровно один вход", async () => {
    await askCode();
    const code = await codeFromMail(t.prisma, email);
    const results = await Promise.all(Array.from({ length: 10 }, () => verify(code)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await t.prisma.session.count()).toBe(1);
  });

  it("одновременные запросы кода не обходят лимит", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => askCode()));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await t.prisma.authCode.count({ where: { email } })).toBe(1);
  });

  it("код не попадает в логи", async () => {
    await askCode();
    const code = await codeFromMail(t.prisma, email);
    await verify(code);
    expect(t.logs.length).toBeGreaterThan(0);
    expect(t.logs.join("\n")).not.toContain(code);
  });

  it("регистрация с промокодом: неверный - ошибка поля, верный - сохраняется", async () => {
    const bad = await askCode({ mode: "register", promo: "NOPE" });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ field: "promo", error: "Промокод не найден" });

    expect((await askCode({ mode: "register", promo: "ez100" })).status).toBe(200);
    await verify(await codeFromMail(t.prisma, email));
    const user = await t.prisma.user.findUnique({ where: { email } });
    expect(user?.promo).toBe("EZ100");
  });

  it("неверный email - 422 с полем email", async () => {
    const res = await http().post("/api/auth/code").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
    expect(res.body.field).toBe("email");
  });

  it("выход удаляет сессию", async () => {
    await askCode();
    const cookie = sessionCookie(await verify(await codeFromMail(t.prisma, email))).split(";")[0];
    expect((await http().post("/api/auth/logout").set("Cookie", cookie)).status).toBe(204);
    expect((await http().get("/api/me").set("Cookie", cookie)).status).toBe(401);
    expect(await t.prisma.session.count()).toBe(0);
  });

  it("без сессии /me отвечает 401", async () => {
    expect((await http().get("/api/me")).status).toBe(401);
    expect((await http().get("/api/me").set("Cookie", "ez_session=forged")).status).toBe(401);
  });

  it("сбой почты не ломает выдачу кода: письмо остается в очереди с ошибкой", async () => {
    expect((await askCode()).status).toBe(200);
    expect(await mail(t.app).flush()).toBe(0);
    const row = await t.prisma.emailOutbox.findFirstOrThrow({ where: { to: email } });
    expect(row.sentAt).toBeNull();
    expect(row.attempts).toBe(1);
    expect(row.error).toBeTruthy();
    expect(row.nextTryAt.getTime()).toBeGreaterThan(Date.now());
  });
});
