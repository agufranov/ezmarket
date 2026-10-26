#!/bin/sh
# Старт сервера в Docker: секреты (коды входа, подпись уведомлений об оплате) и миграции базы.
set -e

# Секрета нет в .env - генерируем один раз и храним в томе /data (в репозиторий он не попадает)
if [ -z "$AUTH_CODE_SECRET" ]; then
  if [ ! -s /data/auth_code_secret ]; then
    mkdir -p /data
    head -c 48 /dev/urandom | base64 | tr -d '\n' > /data/auth_code_secret
  fi
  AUTH_CODE_SECRET="$(cat /data/auth_code_secret)"
  export AUTH_CODE_SECRET
fi

# То же для секрета подписи уведомлений об оплате (встроенная тестовая платежка подписывает им же)
if [ -z "$PAYMENT_WEBHOOK_SECRET" ]; then
  if [ ! -s /data/payment_webhook_secret ]; then
    mkdir -p /data
    head -c 48 /dev/urandom | base64 | tr -d '\n' > /data/payment_webhook_secret
  fi
  PAYMENT_WEBHOOK_SECRET="$(cat /data/payment_webhook_secret)"
  export PAYMENT_WEBHOOK_SECRET
fi

npx prisma migrate deploy
exec "$@"
