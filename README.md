# EzMarket - главная страница и сервер

Фронт: Next.js 15 (App Router), TypeScript, SCSS-модули.
Сервер (`server/`): NestJS на Fastify, Prisma, PostgreSQL; письма - через очередь в базе, локально в Mailpit.

## Весь проект одной командой

Нужен Docker (Docker Desktop на Windows/macOS).

```bash
docker compose up --build
```

- сайт - http://localhost:8080 (nginx отдает фронт и проксирует `/api` на сервер: один адрес, сессия в httpOnly cookie)
- письма - http://localhost:8025 (Mailpit: сюда приходят коды входа)

`.env` не обязателен: секрет для кодов входа сервер сгенерирует при первом старте и сохранит в томе.
Переменные (пароль базы, SMTP для настоящей почты, `COOKIE_SECURE` для HTTPS) - в `.env.example`.

## Локально без Docker

Нужен только Node 22. Одна команда поднимает базу, почту, сервер и сайт:

```bash
npm install
npm run local
```

- сайт - http://localhost:3010 (`/api` проксируется на сервер `:3001`)
- письма - http://localhost:1080 (MailDev)

База - настоящая PostgreSQL из npm-пакета `embedded-postgres`, данные и секрет для кодов - в `.local/` (не в git).
Для ручных проверок повторный код можно запросить через 5 секунд (на сервере по умолчанию - через 60, не больше 5 в час:
`AUTH_RESEND_SECONDS`, `AUTH_CODES_PER_HOUR`). Остановить - Ctrl+C.

## Тесты сервера

```bash
docker compose run --rm test
```

Поднимает отдельную базу в памяти и прогоняет e2e-тесты API (`server/test`): код из 6 цифр приходит письмом
и действует 10 минут, одноразовый, в базе только хеш, в логи не попадает; новый код не чаще раза в минуту и
не больше 5 в час; после 5 неверных попыток код сгорает; параллельные проверки - ровно один вход; выход;
сбой почты не ломает выдачу кода.

Без Docker: PostgreSQL на `localhost:5433` (пользователь/пароль `ezmarket`, база `ezmarket_test`) и
`cd server && npm install && npm test`.

## Разработка

Нужен Node 22 LTS (версия в `.node-version`).

```bash
npm install
npm run dev     # фронт на моках: http://localhost:3000
```

С сервером: сервер на `:3001` (`cd server && npm run dev`, переменные - как в `docker-compose.yml`), фронт:

```bash
API_PROXY=http://localhost:3001 NEXT_PUBLIC_API_URL=/api npm run dev
```

## API (сервер)

| Метод | Путь | Ответ |
|---|---|---|
| POST | `/api/auth/code` `{ email, mode: "login" \| "register", promo? }` | `{ resendIn }`, 422 `{ field, error }`, 429 `{ error, retryIn }` |
| POST | `/api/auth/verify` `{ email, code }` | `{ user }` + cookie сессии, 422 `{ field: "code", error, attemptsLeft? }` |
| GET | `/api/me` | `{ user }`, 401 |
| POST | `/api/auth/logout` | 204 |

## Структура

- `server/src/auth` - коды входа, сессии, выход; `server/src/mail` - очередь писем с повторами
- `server/prisma` - схема и миграции (CHECK баланса бонусов, уникальные ключи)
- `src/app/globals.scss` - дизайн-токены из ТЗ, базовые стили; `src/styles/_mixins.scss` - брейкпоинты и миксины
- `src/components/sections` - секции главной и шапка (каталог, поиск, валюта, профиль, уведомления, пузырь гостя)
- `src/components/auth` - окно «Вход / Регистрация»; `src/components/support` - поддержка у виджета
- `src/services` - запросы к API (`api.ts`, `auth.ts`); без `NEXT_PUBLIC_API_URL` работают моки (GitHub Pages)
- `src/lib/auth.tsx` - текущий пользователь: с API - по сессии (`/api/me`), без API - мок

## Демо-состояния на моках (GitHub Pages)

- `?auth=1` - войти мок-пользователем, `?auth=0` - выйти
- `?auth=1&notif=0` - пустые уведомления «Пока тихо»
- в форме «Написать нам» текст `error` - ошибка отправки; email `error@…` в окне входа - ошибка отправки кода
- промокоды для регистрации: `EZ100`, `FRIEND-2026`, `WELCOME`

## Статус

Готово: главная (десктоп и мобилка 360/440), модалки, сервер авторизации с тестами.
Шаг «Ввод кода» - простая верстка по ТЗ 12.9 (макета нет), только с сервером; на моках (GitHub Pages) после
«Получить код» окно закрывается. Вход через соцсети - пока на моках.
