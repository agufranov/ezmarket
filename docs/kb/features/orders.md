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
| `processing` | воркер выполнения (раз в 3 с) - захват заказа |
| `completed` / `failed` | воркер: заглушка пополнения Steam (логин `fail_*` - отказ) |
| `canceled` | пользователь (`/cancel`) или платеж отменен в платежке |
| `expired` | 30 минут без оплаты: воркер истечения (раз в 15 с), для Crypto Pay - модуль оплаты после проверки счета |

- Текущий статус - в `orders.status`; каждая смена пишется **триггером** в `order_status_history` в той же транзакции (с причиной).
- Недопустимый переход отклоняет **триггер в базе** (`order_status_guard`, `check_violation`), даже если ошибется код.
- Менять статус - только через `OrderStatusService.move(id, from[], to, reason, data?, tx?)`: условный
  `UPDATE ... WHERE status IN (from)`, причина - через `set_config('ezmarket.status_reason', ..., true)`. Вернул false - переход сделал кто-то другой.

## Правила (критерии плана недели)
- Суммы - целым числом в минимальных единицах валюты (`50000` = 500 ₽), CHECK `amount > 0`, `0 <= pay_amount <= amount`, валюта RUB/USD/KZT.
- Лимиты: 100..50 000; минимум - настройкой `ORDER_MIN_AMOUNT` (по умолчанию 10000), отдается в `GET /api/orders/limits`.
- Повтор с тем же `Idempotency-Key` (и 10 одновременных) - один заказ (уникальный индекс `user_id, idempotency_key`, P2002 -> отдать существующий); тот же ключ с другими данными - 409.
- Чужой заказ - 404 (неотличим от несуществующего).
- Неоплаченный заказ истекает через 30 минут (частичный индекс `orders_unpaid_expires_at_idx`).
- Два экземпляра сервера не выполнят заказ дважды: захват `paid -> processing` условным переходом.

## API
| Метод | Путь | Ответ |
|---|---|---|
| GET | `/api/orders/limits` | `{ minAmount, maxAmount, currencies }` - без входа |
| POST | `/api/orders` `{ steamLogin, amount, currency }` + `Idempotency-Key` | 201 / 200 повтор / 409 / 422 `{ field, error }` |
| GET | `/api/orders` | `{ orders }` свои, новые сверху (до 50) |
| GET | `/api/orders/:id` | `{ order }` с `history` |
| POST | `/api/orders/:id/cancel` | `{ order }`; 409 оплачен; 502 Crypto Pay не ответил |
| POST | `/api/orders/:id/pay` | `{ order, paymentUrl }`; 409 отменен/истек; 502 платежка недоступна |

В `OrderDto` поле `paymentUrl` есть только пока заказ `pending`.

## Не сделано
Бонусы (списание до 30%, возврат, начисление, история), скидка 5% на первое пополнение, уведомления о статусах - см. todo.md.
