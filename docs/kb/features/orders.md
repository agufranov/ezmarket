# Заказ пополнения Steam

Код `server/src/orders`, миграции `server/prisma/migrations/2026102609*_orders` и далее, тесты `server/test/orders*.e2e-spec.ts`.

## Статусы и переходы
```
created -> pending -> paid -> processing -> completed | failed
created | pending -> canceled | expired
```
| Статус | Кто переводит |
|---|---|
| `created` | сайт: «Оплатить» (`POST /api/orders`) |
| `pending` | сайт: тот же клик, `POST /api/orders/:id/pay` - создан платеж, есть `paymentUrl` |
| `paid` | платежка: уведомление (вебхук) или опрос Crypto Pay |
| `processing` | воркер выполнения (раз в 3 с) - захват заказа с ограниченным сроком (5 минут) |
| `completed` / `failed` | воркер: заглушка пополнения Steam; `failed` - только подтвержденный отказ (`TopUpError`, логин `fail_*`) |
| `canceled` | пользователь (`/cancel`) или платеж отменен в платежке |
| `expired` | 30 минут без оплаты: воркер истечения (раз в 15 с), для Crypto Pay - модуль оплаты после проверки счета |

- Текущий статус - в `orders.status`; каждая смена пишется **триггером** в `order_status_history` в той же транзакции (с причиной).
- Недопустимый переход отклоняет **триггер в базе** (`order_status_guard`, `check_violation`), даже если ошибется код.
- Менять статус - только через `OrderStatusService.move(id, from[], to, reason, data?, tx?)`: условный
  `UPDATE ... WHERE status IN (from)`, причина - через `set_config('ezmarket.status_reason', ..., true)`. Вернул false - переход сделал кто-то другой.
- **`from` - не шире прочитанного статуса** (урок кросс-ревью): прочитал `created` - переводи из `["created"]`, а не из всех
  неоплаченных; не получилось - перечитай заказ и реши заново (так устроены `/pay`, отмена и общая задача истечения).

## Правила (критерии плана недели)
- Суммы - целым числом в минимальных единицах валюты (`50000` = 500 ₽), CHECK `amount > 0`, `0 <= pay_amount <= amount`, валюта RUB/USD/KZT.
  К оплате деньгами - `pay_amount = amount - bonus_spent × 100` (бонусы - [bonuses.md](bonuses.md)).
- Лимиты: 100..50 000; минимум - настройкой `ORDER_MIN_AMOUNT` (по умолчанию 10000), отдается в `GET /api/orders/limits`.
- Повтор с тем же `Idempotency-Key` (и 10 одновременных) - один заказ (уникальный индекс `user_id, idempotency_key`, P2002 -> отдать существующий); тот же ключ с другими данными - 409.
- Чужой заказ - 404 (неотличим от несуществующего).
- Неоплаченный заказ истекает через 30 минут (частичный индекс `orders_unpaid_expires_at_idx`).
- Два экземпляра сервера не выполнят заказ дважды: захват `paid -> processing` условным переходом.
- Выполнение переживает падение процесса: захват пишет `fulfil_claimed_at`; заказ в `processing` дольше 5 минут
  перезахватывается условно по прежнему времени захвата (`fulfil_attempts` +1) и снова идет к поставщику с id заказа
  ключом повтора. Неизвестный исход (сеть, таймаут) и сбой записи `completed` после успешного пополнения - не `failed`,
  а повтор; после 5 попыток - ошибка в лог «нужна ручная сверка», заказ остается `processing`.

## API
| Метод | Путь | Ответ |
|---|---|---|
| GET | `/api/orders/limits` | `{ minAmount, maxAmount, currencies, bonus }` - без входа |
| POST | `/api/orders` `{ steamLogin, amount, currency, bonuses? }` + `Idempotency-Key` | 201 / 200 повтор / 409 / 422 `{ field, error }` |
| GET | `/api/orders` | `{ orders }` свои, новые сверху (до 50) |
| GET | `/api/orders/:id` | `{ order }` с `history` |
| POST | `/api/orders/:id/cancel` | `{ order }`; 409 оплачен; 502 Crypto Pay не ответил |
| POST | `/api/orders/:id/pay` | `{ order, paymentUrl }`; 409 отменен/истек; 502 платежка недоступна |

В `OrderDto` поле `paymentUrl` есть только пока заказ `pending`.

## Не сделано
Скидка 5% на первое пополнение, уведомления о статусах - см. todo.md. Бонусы - [bonuses.md](bonuses.md).
