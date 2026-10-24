# Yandex Smart Home Dashboard

Панель управления устройствами умного дома Яндекс. Два интерфейса: инженерная панель для полного управления и пользовательская панель с настраиваемыми виджетами.

## Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19, TypeScript 5.9, Vite 7 |
| UI | shadcn/ui, Tailwind CSS 4, Framer Motion |
| State | TanStack React Query, localStorage |
| Routing | Wouter |
| Backend | Express 5, Node.js |
| Validation | Zod (zod/v4) |
| API | OpenAPI + Orval codegen |
| Build | pnpm workspaces, esbuild |

## Quick Start

```bash
pnpm install
```

**Простой способ (одна команда, оба сервера):**

```bash
pnpm dev
```

Или двойным кликом по `dev.cmd` в Windows (собирает и запускает всё).

Открыть http://localhost:5173

## Production (один процесс)

Сборка фронтенда и запуск единого сервера, который раздаёт и API, и собранный фронтенд:

```bash
pnpm build      # typecheck + сборка всех пакетов
DASHBOARD_PASSWORD='...' SESSION_SECRET='...' pnpm start
# один процесс на порту 8080 (API + статика + WebSocket)
```

`DASHBOARD_PASSWORD` обязателен: без него сервер откажется стартовать (кроме
`NODE_ENV=development`). Или двойным кликом по `start.cmd` — он спросит пароль.

## Commands

```bash
pnpm dev            # Both servers via concurrently (dev mode)
pnpm dev:api        # API server only (`NODE_ENV=development`)
pnpm dev:web        # Frontend only (dev server)
pnpm build          # Typecheck + build all packages
pnpm build:web      # Build frontend only
pnpm start          # Production single-process: API + static frontend on :8080
pnpm preview        # Serve built frontend via Vite preview (forwards /api to :8080)
pnpm typecheck      # Typecheck only
pnpm codegen        # Regenerate API from OpenAPI spec
```

## Project Structure

```
├── artifacts/
│   ├── api-server/       # Express proxy to Yandex IoT API
│   └── smart-home/       # React frontend
├── lib/
│   ├── api-spec/         # OpenAPI spec
│   ├── api-client-react/ # Generated React Query hooks
│   └── api-zod/          # Generated Zod schemas
```

## Architecture

- **Backend** acts as CORS proxy to Yandex IoT API, validating via Zod, rate limiting, logging
- **Frontend** uses Smart Card system with progressive disclosure (4 sizes per device type)
- **WebSocket** for real-time device state updates (connects directly to API server port 8080)
- **Access**: the whole app is gated by `DASHBOARD_PASSWORD` (HTTP Basic auth + signed session cookie)
- **Yandex auth**: OAuth token is verified by the server and stored in an encrypted vault (`data/settings.json`, key `yandex_token_v1`); the browser never sees it. The scenario engine and WebSocket use the server-side token. A legacy `localStorage` token is migrated automatically on first load.

## Online Deployment

Проект — классическое клиент-серверное приложение (React SPA + Express API). Подойдёт любой хостинг
с постоянно работающим Node.js процессом: VPS, Render, Railway, Fly.io, Docker.

> **Приватный Git-репозиторий не делает панель приватной.** Видимость репозитория скрывает только
> исходники. Развёрнутый сайт по-прежнему доступен по URL всем, у кого он есть. Доступ к самой панели
> закрывается паролем (`DASHBOARD_PASSWORD`) или авторизацией на уровне reverse-proxy / VPN.

### Обязательные переменные окружения

| Переменная | Обязательна | Назначение |
|------------|-------------|------------|
| `DASHBOARD_PASSWORD` | **да** (кроме `NODE_ENV=development`) | Пароль на всю панель (UI + API + WebSocket). Без него сервер не стартует. |
| `SESSION_SECRET` | рекомендуется | Подпись session-cookie для WebSocket. Если не задан — используется `DASHBOARD_PASSWORD`. Также может использоваться для шифрования серверного Yandex-токена. |
| `TOKEN_ENCRYPTION_KEY` | нет | Отдельный ключ для шифрования Yandex-токена в хранилище (рекомендуется в production, приоритетнее `SESSION_SECRET`). |
| `DASHBOARD_USER` | нет | Логин для Basic auth, по умолчанию `admin`. |
| `DATA_DIR` | нет | Каталог `settings.json` и картинок. По умолчанию `./data`; в Docker — `/app/data`. |
| `PUBLIC_DIR` | для single-process | Путь к собранному фронтенду (`artifacts/smart-home/dist/public`). |
| `CORS_ORIGIN` | при раздельном хостинге | Origin фронтенда; для same-origin не нужен. |
| `HTTP_REDIRECT_PORT` | нет | Включает HTTP→HTTPS редирект, например `80`. По умолчанию выключен (TLS обычно терминирует прокси). |
| `COOKIE_SECURE` | нет | `false` отключает флаг `Secure` у session-cookie. Нужен только для локальной проверки production по HTTP. |

Сгенерировать секреты:

```bash
openssl rand -base64 24   # DASHBOARD_PASSWORD
openssl rand -hex 32      # SESSION_SECRET
```

### 1. Docker (рекомендуется)

```bash
# создайте .env из .env.example и заполните DASHBOARD_PASSWORD / SESSION_SECRET
docker compose up -d --build
```

- Панель: `http://localhost:8080` (браузер спросит логин/пароль).
- `docker-compose.yml` уже монтирует постоянный volume в `/app/data` — настройки и картинки
  переживают перезапуск контейнера.
- TLS ставьте перед контейнером: Caddy/Nginx/Traefik или TLS-терминация хостинга.

### 2. Один процесс (VPS / PaaS)

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production \
PORT=8080 \
PUBLIC_DIR=artifacts/smart-home/dist/public \
DATA_DIR=/var/lib/yandex-dashboard \
DASHBOARD_PASSWORD='...' \
SESSION_SECRET='...' \
node artifacts/api-server/dist/index.mjs
```

Или `pnpm start` (он подставляет `PUBLIC_DIR` относительно пакета API). Сервер раздаёт статику
(SPA fallback), `/api` и WebSocket `/ws` на одном порту. Healthcheck — `GET /api/healthz`
(доступен без пароля для платформ).

### 3. Два сервиса

- `api-server` на порту 8080 (API + WS), обязательно с `DASHBOARD_PASSWORD`.
- Фронтенд: раздать `artifacts/smart-home/dist/public` статик-хостингом, настроив прокси `/api`
  и `/ws` на 8080 и SPA-fallback. API и WS должны быть на одном origin с фронтендом, иначе
  session-cookie для WS не отправится.

### Место и данные

- Исходники без `node_modules` — около 25 МБ; собранные артефакты — около 7 МБ; Docker-образ
  на `node:22-alpine` — порядка 150–200 МБ. Бесплатных тарифов с 512 МБ–1 ГБ диска обычно хватает.
- `settings.json` хранит layout и загруженные картинки в base64. Сейчас файл ~1.2 МБ и растёт с
  каждым загруженным изображением, поэтому на хостинге нужен **постоянный диск** (persistent disk).
- Git на самом хостинге не нужен: платформа собирает проект из репозитория (можно приватного),
  а в рантайме работает только `node`. Git нужен лишь для деплоя/обновлений.

### Безопасность

- Токен Яндекса хранится в браузере (`localStorage`) и передаётся в заголовке `x-yandex-token`.
  Он не попадает в URL и не пишется в серверные логи.
- Токен фонового движка сценариев хранится на сервере в `settings.json` и **никогда** не отдаётся
  через `GET /api/settings` (значение маскируется). Записывать его можно только через
  `POST /api/engine/token` — за паролем панели.
- Не коммитьте `.env` и `artifacts/api-server/data/` — они уже в `.gitignore`.
- Используйте HTTPS: без него пароль панели и токен Яндекса можно перехватить.

## License

MIT
