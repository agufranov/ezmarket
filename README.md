# EzMarket - главная страница и сервер

Фронт: Next.js 15 (App Router), TypeScript, SCSS-модули.
Сервер (`server/`): NestJS на Fastify, Prisma, PostgreSQL; письма - через очередь в базе, локально в Mailpit.
Вход по коду из письма, заказ пополнения Steam со статусами, оплата через тестовую платежку.

## Весь проект одной командой

Нужен Docker (Docker Desktop на Windows/macOS).

```bash
docker compose up --build
```

- сайт - http://localhost:8080 (nginx отдает фронт и проксирует `/api` на сервер: один адрес, сессия в httpOnly cookie)
- письма - http://localhost:8025 (Mailpit: сюда приходят коды входа)

`.env` не обязателен: секреты для кодов входа и подписи уведомлений об оплате сервер сгенерирует при первом старте и сохранит в томе.
Переменные (пароль базы, SMTP для настоящей почты, `COOKIE_SECURE` для HTTPS) - в `.env.example`.

## Стенд

http://166.88.253.195 - тот же `docker compose` на VPS (Ubuntu 24.04), проект в `/opt/ezmarket`.
Письма с кодами - http://166.88.253.195:8025 (Mailpit закрыт логином и паролем - `MAILPIT_UI_AUTH` в `/opt/ezmarket/.env`).
В `.env` на сервере: `WEB_PORT=80`, случайный `POSTGRES_PASSWORD`, `COOKIE_SECURE=false` (пока без HTTPS),
`AUTH_DEMO_CODE=true` - код входа подставляется в поле сам, почта не нужна (для настоящего запуска - `false` и SMTP),
`AUTH_RESEND_SECONDS=5`.

Обновить стенд после пуша в main:

```bash
ssh root@166.88.253.195 "cd /opt/ezmarket && git pull && docker compose up -d --build"
```

## Локально без Docker

Нужен только Node 22. Одна команда поднимает базу, почту, сервер и сайт:

```bash
npm install
npm run local
```

- сайт - http://localhost:3010 (`/api` проксируется на сервер `:3001`)
- письма - http://localhost:1080 (MailDev)

База - настоящая PostgreSQL из npm-пакета `embedded-postgres`, данные и секрет для кодов - в `.local/` (не в git).
Код подставляется в поле сам (`AUTH_DEMO_CODE=true`: сервер возвращает его в ответе), повторный код - через 5 секунд (на сервере по умолчанию - через 60, не больше 5 в час:
`AUTH_RESEND_SECONDS`, `AUTH_CODES_PER_HOUR`). Остановить - Ctrl+C.

## Тесты сервера

```bash
docker compose run --rm test
```

Поднимает отдельную базу в памяти и прогоняет e2e-тесты API (`server/test`): код из 6 цифр приходит письмом
и действует 10 минут, одноразовый, в базе только хеш, в логи не попадает; новый код не чаще раза в минуту и
не больше 5 в час; после 5 неверных попыток код сгорает; параллельные проверки - ровно один вход; выход;
сбой почты не ломает выдачу кода.

Заказ и оплата: сумма в копейках целым числом; повтор запроса с тем же `Idempotency-Key` (и 10 одновременных) -
один заказ; чужие заказы недоступны; недопустимый переход статуса отклоняет сама база, история пишется на каждую
смену; неоплаченный заказ истекает через 30 минут; уведомление без верной подписи отклоняется, 10 повторов одного
уведомления - одно зачисление, сумма и валюта сверяются с заказом; два экземпляра сервера не выполнят заказ дважды.

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
| POST | `/api/orders` `{ steamLogin, amount, currency }` + заголовок `Idempotency-Key` | 201 `{ order }`, повтор - 200 тот же заказ, 409 ключ занят другим заказом, 422 `{ field, error }` |
| GET | `/api/orders` | `{ orders }` - свои, новые сверху |
| GET | `/api/orders/:id` | `{ order }` с `history`, 404 (и для чужого) |
| POST | `/api/orders/:id/cancel` | `{ order }`, 409 `{ error, status }` - уже оплачен |
| POST | `/api/orders/:id/pay` | `{ order, paymentUrl }` - заказ в `pending`, 409 - отменен/истек |
| POST | `/api/payments/webhook` (от платежки) + `X-Signature` | `{ ok, result }`, 401 - неверная подпись |

Суммы - целым числом в минимальных единицах валюты (`50000` = 500 ₽), от 100 до 50 000; валюта `RUB`, `USD`, `KZT`.

Статусы заказа: `created` → `pending` (создан платеж) → `paid` → `processing` → `completed` | `failed`;
из `created` и `pending` - еще `canceled` и `expired` (30 минут без оплаты). Другие переходы запрещены триггером
в базе. Текущий статус хранится в заказе, история (`order_status_history`) пишется триггером в той же транзакции.

Уведомление об оплате: `X-Signature` = hex(HMAC-SHA256(`PAYMENT_WEBHOOK_SECRET`, тело запроса)), тело
`{ id, type: "payment.succeeded" | "payment.canceled", payment: { id, amount, currency } }`. Каждое уведомление
сохраняется в `payment_events` с итогом: `applied`, `already_paid`, `late` (оплата после отмены/истечения - вернуть
деньги вручную), `amount_mismatch`, `unknown_payment`; повтор того же `id` - `duplicate`.

Платежка выбирается `PAYMENT_PROVIDER`:

- `fake` (по умолчанию) - встроенная тестовая: `paymentUrl` ведет на страницу `/api/payments/fake/:id`
  с кнопками «Оплатить» и «Отменить» - они шлют подписанное уведомление в тот же обработчик.
- `cryptopay` - [Crypto Pay](https://help.cr.bot/en/articles/10279948-crypto-pay-api) (@CryptoBot): счет
  выставляется в валюте заказа (RUB, USD, KZT), покупатель платит любой монетой в боте, `paymentUrl` - ссылка
  на счет в Telegram. Нужен `CRYPTOPAY_TOKEN` (бот → Crypto Pay → My Apps), сеть - `CRYPTOPAY_NETWORK`
  (`testnet` по умолчанию: @CryptoTestnetBot и тестовые монеты). Оплату сервер узнает двумя путями: вебхук
  `POST /api/payments/cryptopay/webhook` (подпись `crypto-pay-api-signature`; Crypto Pay шлет вебхуки только на
  HTTPS - адрес задается в боте: My Apps → приложение → Webhooks) и опрос оплаченных счетов раз в 10 секунд -
  он работает и без HTTPS (проходит все ждущие заказы пачками по 100). Вебхук и опрос по одному счету дают одно
  зачисление. Перед истечением заказа сервер спрашивает статус счета: оплачен - проводит оплату, еще активен -
  удаляет счет в Crypto Pay и только потом истекает заказ, Crypto Pay не ответил - ждет следующего прохода.
  Так оплата в последние секунды не теряется. Отмена заказа так же сначала закрывает счет: оплачен - заказ не
  отменяется (опрос проведет оплату), активен - счет удаляется, Crypto Pay не ответил - 502, отмену можно повторить.

Токен Crypto Pay - только в `.env` (в git и Docker-образы не попадает). `npm run local` и `docker compose`
читают его оттуда:

```bash
PAYMENT_PROVIDER=cryptopay
CRYPTOPAY_TOKEN=...
CRYPTOPAY_NETWORK=testnet
```

Тестовые монеты: в Telegram @testgiver_ton_bot выдает тестовые TON, их нужно перевести на @CryptoTestnetBot. Пополнение Steam - пока
заглушка: заказ выполняется через пару секунд, логин с `fail_` - отказ поставщика (для проверки ошибки).

## Структура

- `server/src/auth` - коды входа, сессии, выход; `server/src/mail` - очередь писем с повторами
- `server/src/orders` - заказ, переходы статусов (`OrderStatusService`), фоновые задачи (истечение, выполнение)
- `server/src/payments` - ссылка на оплату, уведомления платежки, тестовая платежка
- `server/prisma` - схема и миграции (CHECK сумм и баланса бонусов, уникальные ключи, триггеры статусов заказа)
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

Готово: главная (десктоп и мобилка 360/440), модалки, сервер авторизации с тестами, заказ пополнения Steam
со статусами и оплатой через тестовую платежку: «Оплатить» в плашке Steam создает заказ и ведет на страницу оплаты.
Шаг «Ввод кода» - простая верстка по ТЗ 12.9 (макета нет), только с сервером; на моках (GitHub Pages) после
«Получить код» окно закрывается. Вход через соцсети - пока на моках.
