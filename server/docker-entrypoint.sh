#!/bin/sh
# Старт сервера в Docker: секрет для кодов входа и миграции базы.
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

npx prisma migrate deploy
exec "$@"
