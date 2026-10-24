# _study — Сервисная папка для изучения кода

Эта папка **не является частью проекта** (не входит в `packages` workspace,
не участвует в сборке, типов и тестах). Сюда выносятся копии/выдержки кода для
чтения, анализа и экспериментов, не затрагивая рабочую копию.

## Структура

### 01-websocket-lifecycle
Проблемная зона: соединение/переподключение WebSocket.
- `use-websocket.ts` — клиентский хук `@workspace/smart-home`.
  HIGH-баги: гонка закрытия старого сокета, `disconnect()` не останавливает
  реконнект (строки 87-99, 113-123, 131-139).
- `server-websocket.ts` — серверный WS `@workspace/api-server` (broadcast по токену).
- `use-yandex-token.ts` — источник токена, от которого зависит WS.

### 02-scenario-engine
Движок сценариев автоматизации.
- `engine.ts` — ядро: правила, расписания, обработка шагов.
- `conditions.ts` — проверка условий срабатывания.
- `climate.ts` — климат-логика (AC + electricHeater).
  MEDIUM-баг: обогреватель не выключается (строки 217-225).
- `device-state.ts` — чтение/запись состояния устройств.
- `types.ts` — модели сценариев.

### 03-widget-payloads
Формирование payload команд в карточках умного дома.
- `QuickActionCard.tsx` — HIGH: игнорирует `action.instance`, хардкод
  `instance: "on"/"brightness"` (строки 49-54).
- `MediaCard.tsx` — HIGH: `isPlaying === "playing"` никогда не true
  (Yandex отдаёт `play/pause/stop`); строка 45.
- `yandex.ts` — helpers по устройствам; MEDIUM: расхождение фильтрации
  `parameters.instance` vs `state.instance` (строка 307).
- `command-queue.ts` — очередование команд (используется в web-сборке).

### 04-layout-grid
Разметка инженерной панели (layout grid).
- `layout-tab.tsx` — перенос AC-карточки поверх существующей ячейки (H1),
  невозможность уменьшить AC (M1) — строки 302, 371, 460-465.

## Зачем это нужно

- Закрепляет точки для регрессионных тестов (см. `_study/02-*` и `03-*`).
- Даёт «витрину» кода без риска задеть работающий проект.
- Копии файлов синхронизируются вручную при значимых фиксах.

## Тесты Фазы 0 (набор-страховка)

Запуск: `pnpm test`. Раннер — vitest (добавлен в каталог workspace).

- `artifacts/api-server/src/scenarios/device-state.test.ts` — нормализация устройств, capability/property.
- `artifacts/api-server/src/scenarios/conditions.test.ts` — И/ИЛИ/НЕ, гистерезис, время, дни, датчики.
- `artifacts/api-server/src/scenarios/climate.test.ts` — режимы, away, AC, приоритеты отопления, приток.
  - `it.fails` фиксирует MEDIUM-баг: электроконвектор не выключается при тепле (`climate.ts:223-225`).
- `artifacts/smart-home/src/lib/command-queue.test.ts` — последовательность, изоляция ошибок, `clear`.
- `artifacts/smart-home/src/lib/yandex.test.ts` — capabilities, статусы, иконки, сортировка, сигнал.
  - `it.fails` фиксирует MEDIUM-баг: instance только через `parameters`, не через `state` (`yandex.ts:305-309`).
- `artifacts/smart-home/src/components/smart-card/QuickActionCard.test.tsx` — payload быстрых действий.
  - `it.fails` фиксирует HIGH-баг: игнорируется `action.instance` (`QuickActionCard.tsx:49-54`).
- `artifacts/smart-home/src/components/smart-card/MediaCard.test.tsx` — play/pause/stop.
  - `it.fails` фиксирует HIGH-баг: `isPlaying === "playing"` (`MediaCard.tsx:45,149`).
- `artifacts/smart-home/src/hooks/use-websocket.test.ts` — жизненный цикл WS-соединения.
  - 2 × `it.fails`: гонка закрытия старого сокета и неработающий `disconnect()`.

Механизм `it.fails`: тест помечен как «ожидаемо падающий». Он держит ожидаемое
(правильное) поведение, пока баг не исправлен. Когда баг починят, тест начнёт
падать — это сигнал убрать `.fails` и закрепить корректное поведение.