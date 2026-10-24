/**
 * Core types of the scenario engine.
 */

/** Режим дома: home/away/night/morning */
export type HomeMode = "home" | "away" | "night" | "morning";

export type NumericOp = "lt" | "lte" | "gt" | "gte" | "eq" | "ne";

/** Источник числового значения для условий сравнения */
export type ValueSource =
  | { kind: "room_temp" }
  | { kind: "outdoor_temp" }
  | { kind: "supply_temp" }
  | { kind: "property"; device: string; instance: string }
  | { kind: "capability"; device: string; type: string; instance?: string }
  | { kind: "constant"; value: number }
  | { kind: "mode_temp"; device: string };

/** Дерево условий сценария */
export type Condition =
  | { type: "and"; children: Condition[] }
  | { type: "or"; children: Condition[] }
  | { type: "not"; child: Condition }
  | { type: "compare"; source: ValueSource; op: NumericOp; value: number; hysteresis?: number }
  | { type: "device_on"; device: string }
  | { type: "device_off"; device: string }
  | { type: "mode"; device: string; value: string }
  | { type: "time_between"; from: string; to: string }
  | { type: "weekday_in"; days: number[] }
  | { type: "home_mode"; value: HomeMode }
  | { type: "sensor_available"; device: string; source: "capability" | "property"; capType: string; instance?: string }
  | { type: "true" };

/** Действие, выдаваемое сценарием */
export interface ActionConfig {
  device: string;
  /** Установить on_off */
  on?: boolean;
  /** Установить temperature (range) */
  temperature?: number;
  /** Установить mode: { instance, value } */
  mode?: { instance: string; value: string };
  /** Переключить toggle */
  toggle?: { instance: string; value: unknown };
  /** Задержка перед выполнением (сек) */
  delayMs?: number;
}

/** Одно "желаемое" значение для устройства — ставится в очередь на отправку */
export interface DesiredEntry {
  deviceId: string;
  type: string;
  instance?: string;
  value: unknown;
  /** человекочитаемое описание для логов/интерфейса */
  label: string;
}

/** Конфигурация климат-сценария */
export interface ClimateConfig {
  devices: {
    roomTemp?: string;
    outdoorTemp?: string;
    supplyTemp?: string;
    vent?: string;
    supplyHeater?: string;
    radiator?: string;
    floor?: string;
    electricHeater?: string;
    ac?: string;
  };
  targets: {
    home: number;
    away: number;
    night: number;
    morning: number;
    supply: number;
    acCool: number;
    acOnThreshold: number;
  };
  times: {
    nightStart: string;
    nightEnd: string;
    morningStart: string;
    morningEnd: string;
  };
  hysteresis: number;
  commandCooldownMs: number;
  minIntervalMs: number;
  safety: {
    heaterRequiresVent: boolean;
    minAcModeChangeIntervalMs: number;
  };
  priorities: Array<"radiator" | "floor" | "electricHeater">;
  floorOffset: number;
}

export type ScenarioKind = "auto" | "manual" | "climate";

export interface ScenarioConfig {
  id: string;
  name: string;
  description?: string;
  kind: ScenarioKind;
  enabled: boolean;
  /** учёт в фоновом цикле (для auto/climate) */
  poll: boolean;
  /** auto/manual: дерево условий */
  condition?: Condition;
  /** auto/manual: действия при срабатывании */
  actions?: ActionConfig[];
  /** климат-сценарий */
  climate?: ClimateConfig;
  /** задержка подтверждения условия (сек) */
  conditionHoldMs?: number;
  created: number;
}

/** Ручное переопределение устройства */
export interface Override {
  deviceId: string;
  label: string;
  reason: string;
  since: number;
  until: number; // 0 = бессрочно
}

export type HistoryLevel = "info" | "warn" | "error";

export interface HistoryEntry {
  ts: number;
  level: HistoryLevel;
  scenarioId?: string;
  message: string;
  /** краткие детали (что отправлено/пропущено) */
  details?: Record<string, unknown>;
}

/** Результат одного цикла сценария */
export interface ScenarioRunResult {
  scenarioId: string;
  ok: boolean;
  /** найденные решения (устройства) до фильтрации */
  desired: DesiredEntry[];
  /** что реально отправлено */
  sent: DesiredEntry[];
  /** что пропущено (коолдаун/оверрайд/дубликат) с причинами */
  skipped: Array<{ entry: DesiredEntry; reason: string }>;
  errors: string[];
  /** режим дома для климат-сценария */
  homeMode?: HomeMode;
}

export interface EngineState {
  enabled: boolean;
  pollIntervalMs: number;
  token: string | null;
  scenarios: ScenarioConfig[];
  overrides: Override[];
  presence: HomeMode;
  lastRun: number | null;
  nextRun: number | null;
  runCount: number;
  serial: number;
}

export const DEFAULT_CLIMATE: ClimateConfig = {
  devices: {},
  targets: {
    home: 22,
    away: 14,
    night: 19,
    morning: 21,
    supply: 20,
    acCool: 24,
    acOnThreshold: 25,
  },
  times: {
    nightStart: "22:00",
    nightEnd: "07:00",
    morningStart: "07:00",
    morningEnd: "10:00",
  },
  hysteresis: 0.5,
  commandCooldownMs: 60_000,
  minIntervalMs: 60_000,
  safety: {
    heaterRequiresVent: true,
    minAcModeChangeIntervalMs: 5 * 60_000,
  },
  priorities: ["radiator", "floor", "electricHeater"],
  floorOffset: 1.5,
};

export const ENGINE_SETTINGS_KEY = "engine_v1";

export const HOME_MODES: HomeMode[] = ["home", "away", "night", "morning"];