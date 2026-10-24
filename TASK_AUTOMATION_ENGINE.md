# Задача: Движок сценариев (автоматизации)

Статус: **код готов, тестирование НЕ проведено** (зафиксировано 12.09.2026)

## Что сделано

- Ядро движка: `artifacts/api-server/src/scenarios/engine.ts` (+ `conditions.ts`, `climate.ts`, `device-state.ts`, `types.ts`)
- API: `artifacts/api-server/src/routes/engine.ts`
- UI: вкладка «Автоматизации» `artifacts/smart-home/src/pages/engineering-panel/automations-tab.tsx`,
  диалог климат-настроек `climate-settings-dialog.tsx`, хук `hooks/use-engine.ts`, клиент `src/lib/engine-api.ts`
- `pnpm run typecheck` — проходит (api-server + smart-home)
- Сборка dist выполнена (12.09 09:11)

## Текущее состояние (settings.json → engine_v1)

- `enabled: false` — движок выключен, ни разу не запускался (`runCount: 0`)
- `token: null` — токен Яндекса не задан в движке (хм: как приходит токен)
- `scenarios[]` содержит только дефолтный сценарий `Климат` (climate), `devices: {}` — устройства не настроены
- `presence: "home"`

## TODO: протестировать автоматизацию

1. Запустить `pnpm dev` (или `dev.cmd`), открыть http://localhost:5173, инженерная панель → вкладка «Автоматизации»
2. Проверить, что вкладка загружается и показывает движок (включён/выключен, сценарий «Климат»)
3. Убедиться, что токен движка берётся корректно (из localStorage/settings) — сейчас `token: null`
4. В диалоге климат-настроек назначить устройства: roomTemp, outdoorTemp, vent, радиаторы/тёплый пол/кондиционер
5. Включить движок и проверить:
   - `lastRun`/`nextRun`/`runCount` обновляются (цикл каждые 60 с)
   - история (history) пишет реальные события информативного уровня
   - климат реально управляет устройствами (не превышать колдауны, учесть `heaterRequiresVent`)
6. Проверить ошибки/предупреждения в истории при отсутствии устройств или проблемах с API
7. Проверить ручной запуск сценария через UI и переопределения (overrides)

## На что обратить внимание при тесте

- `engine.ts` использует `ENGINE_SETTINGS_KEY = "engine_v1"` — сохраняется в `api-server/data/settings.json`
- Климат-сценарий: `minIntervalMs`/`commandCooldownMs` = 60 с, безопасность `heaterRequiresVent: true`
- WebSocket бродкастит обновления `broadcastAll` после цикла