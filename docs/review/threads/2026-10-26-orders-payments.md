# Ревью: заказ пополнения Steam, оплата и Crypto Pay

```
status: open
turn: reviewer
round: 1
автор: Claude Opus 5.5
ревьюер: Codex
ветка: main
коммиты: 0bac99b..57b3ff6
```

Протокол - [docs/review/PROTOCOL.md](../PROTOCOL.md).

## 1. REQUEST - автор (Claude Opus 5.5), 2026-10-26

**Что сделано:** заказ пополнения Steam со статусами и историей, оплата через встроенную тестовую платежку и Crypto Pay
(testnet), фоновые задачи истечения и выполнения, лимиты суммы с сервера, подключение плашки Steam на фронте,
страница «Мои заказы». 15 коммитов, ~2600 строк (сервер `server/src/orders`, `server/src/payments`, миграции
`server/prisma/migrations/20261026*`, тесты `server/test/*.e2e-spec.ts`, фронт `src/services/orders.ts`,
`src/components/sections/SteamBar.tsx`, `src/components/orders`).

**Что проверить особо:**
1. Деньги и гонки: одно зачисление на событие и на счет (вебхук + опрос + повторы), условные переходы статусов,
   истечение и отмена против одновременной оплаты, два экземпляра сервера на одном заказе, ключ повтора при одновременных запросах.
2. Подписи уведомлений: тестовая платежка (`X-Signature`) и Crypto Pay (`crypto-pay-api-signature`, HMAC от SHA256 токена) -
   считаются ли по сырому телу, сравнение без утечки по времени, что будет с кривым телом.
3. Триггеры в миграциях: правила переходов (`order_status_guard`), история (`order_status_log`), время в UTC.
4. Доступ: чужие заказы, отмена/оплата чужого, что отдается без входа (`/orders/limits`, тестовая страница оплаты по id платежа).
5. Crypto Pay: создание счета (сумма строкой, валюта, срок жизни), опрос пачками, закрытие счета перед `expired` и `canceled`,
   поведение при недоступном API (502, ничего не меняется).
6. Фронт: ключ повтора в плашке, окно оплаты открывается по клику (без блокировки всплывающих окон), опрос на странице заказов.

**Чего не проверять:** бонусы, скидку 5%, уведомления - еще не сделаны (`docs/kb/todo.md`). Временный `ORDER_MIN_AMOUNT` - известен.

**Как проверить:**
```bash
# тесты сервера в Docker (нужен запущенный Docker Desktop)
docker compose run --rm test
# или без Docker: PostgreSQL на localhost:5433 (ezmarket/ezmarket, база ezmarket_test), затем
cd server && npm install && npm test
# фронт
npm install && npx tsc --noEmit -p . && npx eslint src && NEXT_DIST_DIR=.next-check npx next build
# весь путь руками: npm run local -> http://localhost:3010 (платежка из .env; без .env - тестовая страница оплаты)
```
У автора на момент запроса: сервер 76 тестов зеленые, линтер и сборка фронта чистые.

**Контекст:** `docs/kb/features/orders.md`, `docs/kb/features/payments.md`, `docs/kb/decisions.md`, `docs/kb/pitfalls.md`;
критерии приемки «Заказ Steam» и «Уведомления об оплате» - в плане недели (сводка в `docs/kb/features/orders.md`).
