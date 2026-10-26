# Грабли

## Figma и браузеры
- **Figma MCP почти не работает**: на файле место View (план Professional) - лимит вызовов кончился после 2-3 запросов
  (`get_screenshot` отказал). Делать один `get_metadata` на страницу `0:1` (1.3 МБ XML), сохранить и грепать локально.
- Смотреть макет - **в Chrome пользователя** (Claude in Chrome), не во встроенном браузере: пользователь так просил.
  Если расширение «не подключено» - `list_connected_browsers` пуст, подождать/попросить подключить.
- В Figma без входа: глобала `figma` в консоли нет, Dev Mode нет, `Shift+2` (зум к выделению) не работает - только скриншоты и `zoom`.
- Скриншоты в Chrome масштабированы (1568 вместо 1920 по ширине) - координаты брать из XML, а не со скриншота.
- Если окно Chrome перекрыто, анимации не тикают: замеры «посреди анимации» (scale .95/.96, translateX 12). Ждать `getAnimations().finished` или считать по родителю.
- Chrome пользователя не открывает стенд по `http://` (страница ошибки) - проверять стенд `curl`-ом.

## Окружение Windows / Git Bash
- Git Bash превращает `/ezmarket` в `C:/Program Files/Git/ezmarket`: `MSYS_NO_PATHCONV=1 PAGES_BASE_PATH=/ezmarket ...`.
  То же в `curl -w "/path"` и подобном.
- Файлы в рабочей копии с CRLF (autocrlf). Правка через Python в текстовом режиме меняет переводы строк, а `'\n'`
  в обычной строке Python внутри bash-heredoc превращается в настоящий перевод строки (сломало `tr -d '\n'` в entrypoint и
  регулярки в `local.mjs`). Для таких правок - инструмент Edit или raw-строки `r'''...'''` и работа с байтами.
- Shell-скрипт `server/docker-entrypoint.sh` - только LF (иначе контейнер не стартует); проверять `sh -n` и `grep -c $'\r'`.
- `npm install` здесь меняет `package-lock.json` (другая версия npm) - не коммитить.
- `taskkill` выводит кракозябры (cp866) - смотреть код возврата, а не текст.

## База и Prisma
- **Часовой пояс**: embedded PostgreSQL на Windows работает в `Asia/Yekaterinburg`, Docker - в UTC. Prisma пишет время в UTC
  в `TIMESTAMP` без пояса; значение по умолчанию `CURRENT_TIMESTAMP`, вставленное триггером, - в поясе сессии.
  История статусов уехала на 5 часов. Решение - в триггере явно `now() AT TIME ZONE 'UTC'`; тест ставит базе чужой пояс.
- `prisma generate` падает с `EPERM ... query_engine-windows.dll.node`, пока запущен сервер (`npm run local`) - остановить его.
- `npm run local` после остановки оставляет дочерние процессы (сервер :3001, сайт :3010, MailDev :1080, база :5434) -
  гасить по порту: `netstat -ano | grep :3001` -> `taskkill //PID <pid> //T //F`. Базу можно оставить - скрипт ее подхватит.
- `prisma migrate diff --from-migrations` падает, если в `migrations/` есть пустая папка: сначала сгенерировать SQL в файл, потом создать папку.
  Нужна теневая база: `--shadow-database-url .../shadow` (создать `CREATE DATABASE shadow`).
- Docker Desktop может быть не запущен - тесты гонять на embedded PostgreSQL :5433 (скрипт `testdb.mjs` в рабочей папке сессии:
  `EmbeddedPostgres` из `server/node_modules`, база `ezmarket_test`).
- `NOT { a, b }` в Prisma при `NULL` в колонке дает `NULL` - заказ выпадает из выборки. Писать явное `OR` с `{ field: null }`.

## Next.js
- `@Headers()` в Nest не принимает пайпы - проверять заголовок в методе (`new ZodPipe(schema).transform(raw)`).
- Экспорт (`output: export`) с `NEXT_DIST_DIR` кладет статику в эту папку, а не в `out/`.
- `.env` в корне Next тоже читает, но в браузер уходят только `NEXT_PUBLIC_*` - токен Crypto Pay в бандл не попадает.
  В Docker-образы `.env` не копируется (`.dockerignore`).

## Браузер и UX
- `window.open` после `await` блокируется как всплывающее окно - открывать окно сразу по клику (`about:blank`), потом менять `location`.

## Внешние сервисы
- Crypto Pay: вебхуки только на HTTPS; `update_id` не уникален; сумма в ответе без хвоста нулей; кириллица в `curl -d` из Git Bash портится (в коде на Node - нормально).
- SSH на стенд с нового компьютера: сначала ключ хоста (сверить отпечаток), потом добавить свой `id_rsa.pub` в `/root/.ssh/authorized_keys`
  (права 700/600, без `\r`). Пароль root за пользователя не вводим.
