/**
 * Клиент REST API движка сценариев (/api/engine/*).
 * Использует глобальный fetch — как и остальной код панели.
 */

export type HomeMode = "home" | "away" | "night" | "morning";
export type ScenarioKind = "auto" | "manual" | "climate";
export type HistoryLevel = "info" | "warn" | "error";

export interface ClimateDevicesConfig {
  roomTemp?: string;
  outdoorTemp?: string;
  supplyTemp?: string;
  vent?: string;
  supplyHeater?: string;
  radiator?: string;
  floor?: string;
  electricHeater?: string;
  ac?: string;
}

export interface ClimateConfig {
  devices: ClimateDevicesConfig;
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

export interface EngineScenario {
  id: string;
  name: string;
  description?: string;
  kind: ScenarioKind;
  enabled: boolean;
  poll: boolean;
  climate?: ClimateConfig;
  conditionHoldMs?: number;
  created: number;
}

export interface EngineOverride {
  deviceId: string;
  label: string;
  reason: string;
  since: number;
  until: number;
}

export interface EngineHistoryEntry {
  ts: number;
  level: HistoryLevel;
  scenarioId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface EngineState {
  enabled: boolean;
  pollIntervalMs: number;
  token: string | null;
  scenarios: EngineScenario[];
  overrides: EngineOverride[];
  presence: HomeMode;
  lastRun: number | null;
  nextRun: number | null;
  runCount: number;
  serial: number;
}

async function engineFetch<T>(path: string, init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> }): Promise<T> {
  const res = await fetch(`/api/engine${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error ?? "";
    } catch {}
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const engineApi = {
  state: () => engineFetch<EngineState>("/state"),
  history: (limit = 100) => engineFetch<EngineHistoryEntry[]>(`/history?limit=${limit}`),
  overrides: () => engineFetch<EngineOverride[]>("/overrides"),

  setEnabled: (enabled: boolean) =>
    engineFetch<{ ok: boolean }>("/enabled", { method: "POST", body: JSON.stringify({ enabled }) }),

  setPresence: (mode: HomeMode) =>
    engineFetch<{ ok: boolean }>("/presence", { method: "POST", body: JSON.stringify({ mode }) }),

  setToken: (token: string) =>
    engineFetch<{ ok: boolean }>("/token", { method: "POST", body: JSON.stringify({ token }) }),

  deleteToken: () => engineFetch<{ ok: boolean }>("/token", { method: "DELETE" }),

  updateScenario: (id: string, patch: Partial<EngineScenario>) =>
    engineFetch<EngineScenario>(`/scenarios/${id}/update`, { method: "POST", body: JSON.stringify(patch) }),

  setScenarioEnabled: (id: string, enabled: boolean) =>
    engineFetch<{ ok: boolean }>(`/scenarios/${id}/enable`, { method: "POST", body: JSON.stringify({ enabled }) }),

  runScenario: (id: string) =>
    engineFetch<Record<string, unknown>>(`/scenarios/${id}/run`, { method: "POST", body: JSON.stringify({}) }),

  setOverride: (deviceId: string, label: string, reason: string, ttlMs?: number) =>
    engineFetch<{ ok: boolean }>("/overrides", {
      method: "POST",
      body: JSON.stringify({ deviceId, label, reason, ttlMs }),
    }),

  clearOverride: (deviceId: string) =>
    engineFetch<{ ok: boolean }>(`/overrides/${encodeURIComponent(deviceId)}`, { method: "DELETE" }),
};

export const HOME_MODES: { value: HomeMode; label: string }[] = [
  { value: "home", label: "Дома" },
  { value: "away", label: "Уехал" },
  { value: "night", label: "Ночь" },
  { value: "morning", label: "Утро" },
];