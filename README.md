# EzMarket - главная страница

Next.js 15 (App Router), TypeScript, SCSS-модули.

## Запуск

Нужен Node 22 LTS (версия в `.node-version`).

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

## Структура

- `src/app/globals.scss` - дизайн-токены из ТЗ (цвета, скругления, тени, отступы), базовые стили
- `src/styles/_mixins.scss` - брейкпоинты и миксины
- `src/components/sections` - секции главной
- `src/components/ui` - переиспользуемые компоненты
- `src/lib/modal.tsx` - общий Modal и `openModal(name)` для модалок этапа 3
- `src/config/routes.ts` - все ссылки в одном месте (пока `#`, URL пришлет заказчик)
- `src/config/site.ts` - тайминги, валюты, лимиты
- `src/data/mocks.ts` - моковые данные до подключения API

## Статус

Этап 1, десктоп. Мобильная версия - после мобильных макетов.
