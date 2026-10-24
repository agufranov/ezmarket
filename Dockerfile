# Фронт: статическая сборка Next.js + nginx, который отдает ее и проксирует /api на сервер (один адрес - cookie без CORS)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# пустой базовый путь - сайт в корне; запросы к API - на тот же адрес
ENV PAGES_BASE_PATH="" NEXT_PUBLIC_API_URL="/api"
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
