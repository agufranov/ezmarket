# Система

## Стек
- Фронт: Next.js 15 (App Router), TypeScript, SCSS-модули, шрифт Nunito. Собирается **статикой** (`output: export`)
  для GitHub Pages и для Docker (nginx отдает `out/`). Без `NEXT_PUBLIC_API_URL` работает на моках.
- Сервер (`server/`): NestJS 11 на Fastify, Prisma 6, PostgreSQL 16, zod для проверки входа, nodemailer.
- Письма - через очередь `email_outbox` в базе (создается в той же транзакции, что и действие), воркер с повторами.
- Фоновые задачи - `@nestjs/schedule` (`@Interval`), выключаются `WORKERS=false` (в тестах их зовут вручную).

## Структура
- `src/app` - страницы: `/` (главная), `/orders` (мои заказы)
- `src/components/sections` - секции главной и шапка; `src/components/auth` - окно входа; `src/components/support` - поддержка у виджета; `src/components/orders` - страница заказов
- `src/services` - запросы к API (`api.ts`, `auth.ts`, `orders.ts`) и моки; `src/lib/auth.tsx` - текущий пользователь
- `src/config` - то, что заказчик меняет без верстки: `site.ts` (лимиты Steam по умолчанию, тайминги), `routes.ts`, `currencies.ts`
- `server/src/auth` - коды входа, сессии; `server/src/mail` - очередь писем
- `server/src/orders` - заказ, `OrderStatusService` (единственное место смены статуса), воркер истечения/выполнения, заглушка пополнения Steam
- `server/src/payments` - ссылка на оплату, вебхуки, тестовая платежка, клиент и модуль Crypto Pay
- `server/prisma` - схема и миграции (CHECK, частичный индекс, триггеры статусов)
- `server/test` - e2e-тесты по API на настоящей PostgreSQL

## Запуск
| Способ | Команда | Адреса |
|---|---|---|
| Docker, весь проект | `docker compose up --build` | сайт :8080 (nginx, `/api` -> сервер), Mailpit :8025 |
| Без Docker | `npm run local` | сайт :3010, API :3001, MailDev :1080, embedded PostgreSQL :5434 (данные в `.local/`) |
| Фронт на моках | `npm run dev` | :3000 |
| Тесты сервера в Docker | `docker compose run --rm test` | отдельная база в памяти |
| Тесты сервера без Docker | PostgreSQL на :5433 (`ezmarket`/`ezmarket`, база `ezmarket_test`) + `cd server && npm test` | |

`npm run local` читает из `.env` в корне `PAYMENT_PROVIDER`, `CRYPTOPAY_TOKEN`, `CRYPTOPAY_NETWORK`, `ORDER_MIN_AMOUNT`;
демо-код входа включен, повтор кода через 5 с.

## Переменные окружения (сервер)
Полный список с пояснениями - `.env.example`; проверка и значения по умолчанию - `server/src/config.ts`.
Секреты `AUTH_CODE_SECRET` и `PAYMENT_WEBHOOK_SECRET` без `.env` генерируются при первом старте
(Docker - том `apidata`, `npm run local` - `.local/`).

## CI (`.github/workflows`)
- `docker.yml` - на push в main: тесты сервера в контейнере, весь проект в compose, сайт и API на одном адресе, письмо с кодом в Mailpit.
- `pages.yml` - на push в main: статическая сборка с `PAGES_BASE_PATH=/ezmarket` и выкладка на GitHub Pages (моки, без API).
