# Оплата

Код `server/src/payments`, тесты `server/test/payments.e2e-spec.ts`, `server/test/cryptopay.e2e-spec.ts`.
Платежка выбирается `PAYMENT_PROVIDER=fake|cryptopay`; в заказе сохраняются `payment_provider`, `payment_id`, `payment_url`.

## Общее для любой платежки
- Любое уведомление переводится в общее событие `{ id, type: payment.succeeded|payment.canceled, payment: { id, amount, currency } }`
  и идет в `PaymentsService.applyEvent`: одна обработка на `id` события (уникальный `payment_events.provider_event_id`, P2002 -> `duplicate`),
  сумма и валюта сверяются с заказом, оплачивается только `pending` (условный переход).
- Итоги в `payment_events.result`: `applied`, `already_paid`, `late` (оплата после отмены/истечения - вернуть деньги вручную), `amount_mismatch`, `unknown_payment`.
- Неизвестный платеж и несовпадение суммы - 200 (чтобы платежка не слала повторы), с пометкой в событии и предупреждением в логе.

## Тестовая платежка (`fake`, по умолчанию)
- `paymentUrl` - `/api/payments/fake/:paymentId`: страница с «Оплатить» / «Отменить» (деньги не списываются).
- Кнопки шлют подписанное уведомление в тот же обработчик, что и `POST /api/payments/webhook`:
  `X-Signature` = hex(HMAC-SHA256(`PAYMENT_WEBHOOK_SECRET`, тело байт в байт)). Сырое тело - `rawBody: true` в `NestFactory.create`.

## Crypto Pay (`cryptopay`, @CryptoBot / @CryptoTestnetBot)
- API: `https://testnet-pay.crypt.bot/api` / `https://pay.crypt.bot/api`, заголовок `Crypto-Pay-API-Token`, ответ `{ ok, result | error }`.
- Счет - фиатный в валюте заказа (`currency_type: fiat`, `fiat`, `amount` строкой `"500.00"`), `payload` = id заказа,
  `expires_in` = остаток жизни заказа, `paid_btn_name: callback` + `SITE_URL`. `paymentUrl` = `bot_invoice_url` (t.me).
  Сумма в ответе приходит без хвоста нулей (`"500"`). Принимаются даже 0.01.
- Вебхук `POST /api/payments/cryptopay/webhook`: подпись `crypto-pay-api-signature` = hex(HMAC-SHA256(SHA256(токен) как байты, тело)).
  `update_type: invoice_paid`. `update_id` не уникален - id события строим по счету: `cryptopay:<invoice_id>:paid`.
- Вебхуки Crypto Pay шлет только на HTTPS - поэтому **опрос** `getInvoices(status: paid)` раз в 10 с по всем `pending`-заказам Crypto Pay
  пачками по 100 от старых к новым. Вебхук и опрос по одному счету дают одно зачисление.
- **Истечение** заказа Crypto Pay - не общим воркером, а `PaymentsService.expireCryptoPay`: сначала статус счета;
  оплачен - проводим оплату; активен - `deleteInvoice` и только потом `expired`; Crypto Pay не ответил - ждем следующего прохода.
- **Отмена** заказа (`OrdersService.cancel`) тоже сначала закрывает счет: оплачен - 409 (опрос проведет оплату); активен - удаляем;
  нет ответа - 502, отмену можно повторить.
- Клиент Crypto Pay - провайдер `CRYPTOPAY` в `cryptopay.module.ts` (общий для заказов и оплаты; `null`, если платежка не Crypto Pay).
- Одновременные «Оплатить»: если счет создал другой запрос, лишний удаляется.
- Crypto Pay недоступен при создании счета - 502, заказ остается `created`, повтор проходит.
