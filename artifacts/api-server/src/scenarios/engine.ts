/**
 * Ядро движка сценариев.
 *
 * Один цикл: получить user/info → собрать контекст → обсчитать каждый
 * включённый сценарий → сформировать "желаемое" состояние устройств →
 * отправить только отличия от текущего (с дебаунсом, коолдаунами,
 * ручными переопределениями и защитой от "спам-команд").
 */

import { loadSettings, updateSettings } from "../lib/settings";
import { logger } from "../lib/logger";
import { broadcastAll } from "../lib/websocket";
import { fetchYandexUserInfo, sendYandexDeviceActions } from "../lib/yandex-client";
import { getYandexToken, hasYandexToken, setYandexToken } from "../lib/token-vault";
import {
  ENGINE_SETTINGS_KEY,
  type EngineState,
  type ScenarioConfig,
  type Override,
  type HistoryEntry,
  type ScenarioRunResult,
  type DesiredEntry,
  type HomeMode,
  type Condition,
  type ActionConfig,
  DEFAULT_CLIMATE,
} from "./types";
import {
  indexDevices,
  type DeviceMap,
  entryKey,
  toYandexAction,
  getOnOff,
  getMode,
} from "./device-state";
import { evaluateConditions, describeCondition, type ConditionCtx } from "./conditions";
import { decideClimate, collectReadings, resolveHomeMode } from "./climate";

const HISTORY_LIMIT = 500;
const DEFAULT_POLL = 60_000;

function normalizeScenarios(raw: unknown): ScenarioConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === "object" && typeof (s as any).id === "string") as ScenarioConfig[];
}

function loadRt(): Record<string, unknown> {
  return loadSettings();
}

export class ScenarioEngine {
  private state: EngineState;
  private history: HistoryEntry[] = [];
  private lastCommands: Map<string, number> = new Map();
  private acModeChangedAt: Record<string, number> = {};
  private devices: DeviceMap = { devices: new Map(), byName: new Map() };
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private lastFetchAt = 0;

  constructor() {
    const saved = loadRt()[ENGINE_SETTINGS_KEY] as Partial<EngineState> | undefined;
    this.state = {
      enabled: saved?.enabled ?? true,
      pollIntervalMs: this.normalizePoll(saved?.pollIntervalMs),
      token: hasYandexToken() ? "***" : null,
      scenarios: saved?.scenarios ? normalizeScenarios(saved.scenarios) : this.defaultScenarios(),
      overrides: Array.isArray(saved?.overrides) ? saved.overrides as Override[] : [],
      presence: (saved?.presence as HomeMode) ?? "home",
      lastRun: saved?.lastRun ?? null,
      nextRun: saved?.nextRun ?? null,
      runCount: saved?.runCount ?? 0,
      serial: saved?.serial ?? 0,
    };
    if (!saved?.scenarios) this.persist();
  }

  private defaultScenarios(): ScenarioConfig[] {
    const now = Date.now();
    return [
      {
        id: "climate",
        name: "Климат",
        description: "Поддержание температуры: отопление, вентиляция, охлаждение",
        kind: "climate",
        enabled: true,
        poll: true,
        climate: structuredClone(DEFAULT_CLIMATE),
        conditionHoldMs: 0,
        created: now,
      },
    ];
  }

  private normalizePoll(v: unknown): number {
    if (typeof v === "number" && v >= 10000 && v <= 10 * 60_000) return Math.round(v);
    return DEFAULT_POLL;
  }

  private persist() {
    // The token lives in the encrypted vault, not in the engine state.
    // Merge instead of overwriting: updateSettings keeps dashboard layouts,
    // visibility configs, and every other key stored in settings.json.
    const persisted: Partial<EngineState> = { ...this.state };
    delete persisted.token;
    updateSettings({ [ENGINE_SETTINGS_KEY]: persisted });
  }

  private bumpSerial() {
    this.state.serial += 1;
  }

  // ── Публичный доступ ──────────────────────────────────────────────

  getState(): EngineState {
    return {
      ...this.state,
      token: hasYandexToken() ? "***" : null,
      scenarios: this.state.scenarios,
      overrides: this.state.overrides,
      lastRun: this.state.lastRun,
      nextRun: this.state.nextRun,
      runCount: this.state.runCount,
      serial: this.state.serial,
    };
  }

  getHistory(limit = 50): HistoryEntry[] {
    return this.history.slice(-limit);
  }

  hasToken(): boolean {
    return hasYandexToken();
  }

  setToken(token: string | null) {
    setYandexToken(token);
    this.state.token = token ? "***" : null;
    this.persist();
  }

  setEnabled(enabled: boolean) {
    this.state.enabled = enabled;
    this.persist();
  }

  setPresence(mode: HomeMode) {
    this.state.presence = mode;
    this.persist();
    this.log("info", undefined, `Режим дома задан вручную: ${mode}`);
  }

  getScenario(id: string): ScenarioConfig | undefined {
    return this.state.scenarios.find((s) => s.id === id);
  }

  setScenarioEnabled(id: string, enabled: boolean) {
    const s = this.getScenario(id);
    if (!s) return;
    s.enabled = enabled;
    this.persist();
    this.log("info", id, `Сценарий "${s.name}" ${enabled ? "включён" : "выключен"}`);
    this.broadcastState();
  }

  updateScenario(id: string, patch: Partial<ScenarioConfig>) {
    const s = this.getScenario(id);
    if (!s) return;
    Object.assign(s, patch);
    this.persist();
    this.log("info", id, `Сценарий "${s.name}" обновлён`);
    this.broadcastState();
  }

  createScenario(config: ScenarioConfig) {
    const existing = this.state.scenarios.find((s) => s.id === config.id);
    if (existing) return existing;
    this.state.scenarios.push(config);
    this.persist();
    return config;
  }

  deleteScenario(id: string) {
    if (id === "climate") return false;
    this.state.scenarios = this.state.scenarios.filter((s) => s.id !== id);
    this.persist();
    return true;
  }

  getOverrides(): Override[] {
    return this.state.overrides.filter((o) => o.until === 0 || o.until > Date.now());
  }

  setOverride(o: Override) {
    const base = this.state.overrides.find((x) => x.deviceId === o.deviceId);
    if (base) Object.assign(base, o);
    else this.state.overrides.push(o);
    this.persist();
    this.log("warn", undefined, `Ручное управление: ${o.label} (${o.reason})`);
    this.broadcastState();
  }

  clearOverride(deviceId: string) {
    this.state.overrides = this.state.overrides.filter((o) => o.deviceId !== deviceId);
    this.persist();
    this.log("info", undefined, `Ручное управление снято (${deviceId})`);
    this.broadcastState();
  }

  private log(level: HistoryEntry["level"], scenarioId: string | undefined, message: string, details?: Record<string, unknown>) {
    this.history.push({ ts: Date.now(), level, scenarioId, message, details });
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT);
  }

  start() {
    this.timer = setInterval(() => this.tick().catch((e) => logger.warn({ err: e }, "Engine tick failed")), this.state.pollIntervalMs);
    logger.info({ poll: this.state.pollIntervalMs }, "Scenario engine started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ── Основной цикл ─────────────────────────────────────────────────

  async tick() {
    if (!this.state.enabled) return;
    if (!this.hasToken()) return;
    if (this.running) return;
    this.running = true;
    try {
      const started = Date.now();
      this.state.nextRun = started + this.state.pollIntervalMs;
      await this.refreshDevices();
      const results = await this.runAll();
      this.state.lastRun = Date.now();
      this.state.runCount += 1;
      this.bumpSerial();
      this.persist();
      this.broadcastState();
      if (this.state.runCount % 20 === 0) logger.info({ runCount: this.state.runCount }, "Engine cycle");
      void results;
    } finally {
      this.running = false;
    }
  }

  private async refreshDevices(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastFetchAt < 10_000) return;
    this.lastFetchAt = now;

    const token = getYandexToken();
    if (!token) {
      this.log("error", undefined, "Токен Яндекса не настроен");
      return;
    }

    try {
      const userInfo = await fetchYandexUserInfo(token);
      this.devices = indexDevices(userInfo as any);
    } catch (err) {
      this.log("error", undefined, "Не удалось получить устройства с Яндекса", { err: String(err) });
    }
  }

  private async runAll(): Promise<ScenarioRunResult[]> {
    const results: ScenarioRunResult[] = [];
    for (const scenario of this.state.scenarios) {
      if (!scenario.enabled) continue;
      if (scenario.kind === "manual" && !scenario.poll) {
        continue; // manual-сценарии запускаются вручную
      }
      const result = await this.evaluateScenario(scenario);
      results.push(result);
    }
    // очистка протухших оверрайдов
    const now = Date.now();
    const activeOverrides = this.state.overrides.filter((o) => o.until === 0 || o.until > now);
    if (activeOverrides.length !== this.state.overrides.length) {
      this.state.overrides = activeOverrides;
      this.persist();
    }
    return results;
  }

  /**
   * Ручной запуск сценария (нажатие кнопки в UI / API).
   */
  async runScenarioNow(id: string, force = false): Promise<ScenarioRunResult | null> {
    const scenario = this.getScenario(id);
    if (!scenario) return null;
    await this.refreshDevices(true);
    const result = await this.evaluateScenario(scenario, { force });
    this.bumpSerial();
    this.broadcastState();
    return result;
  }

  private async evaluateScenario(
    scenario: ScenarioConfig,
    opts: { force?: boolean } = {}
  ): Promise<ScenarioRunResult> {
    const started = Date.now();
    const result: ScenarioRunResult = {
      scenarioId: scenario.id,
      ok: true,
      desired: [],
      sent: [],
      skipped: [],
      errors: [],
    };

    try {
      if (scenario.kind === "climate") {
        const config = scenario.climate ?? structuredClone(DEFAULT_CLIMATE);
        const homeMode = resolveHomeMode(this.state.presence, config);
        result.homeMode = homeMode;
        const readings = collectReadings(config, this.devices, started);
        const decision = decideClimate(config, {
          devices: this.devices,
          presence: homeMode,
          homeMode,
          readings,
          acModeChangedAt: this.acModeChangedAt,
          now: started,
        });
        for (const n of decision.notes) this.log("info", scenario.id, n);
        await this.applyDesired(scenario, decision.desired, result);
      } else {
        // auto/manual: условия + действия
        if (scenario.condition) {
          if (scenario.condition.type !== "true" && !scenario.condition) {
            result.ok = false;
            return result;
          }
          const fired = this.evaluateAutoCondition(scenario);
          if (!fired) {
            this.log("info", scenario.id, "Условия не выполнены", { cond: describeCond(scenario.condition) });
            return result;
          }
        }
        const actions = scenario.actions ?? [];
        const desired: DesiredEntry[] = [];
        for (const a of actions) await this.actionToDesired(a, desired);
        this.log("info", scenario.id, "Сценарий сработал", { actions: actions.length });
        await this.applyDesired(scenario, desired, result);
      }
    } catch (err) {
      result.ok = false;
      result.errors.push(String(err));
      this.log("error", scenario.id, `Ошибка выполнения: ${String(err)}`);
    }

    return result;
  }

  private evaluateAutoCondition(scenario: ScenarioConfig): boolean {
    const ctx: ConditionCtx = {
      presence: this.state.presence,
      devices: this.devices,
      roomTemp: this.readRoomTemp(),
      supplyTemp: undefined,
    };
    return evaluateConditions(scenario.condition!, ctx);
  }

  private readRoomTemp(): number | undefined {
    const climate = this.getScenario("climate");
    if (!climate?.climate?.devices.roomTemp) return undefined;
    const dev = this.devices.devices.get(climate.climate.devices.roomTemp);
    const p = dev?.properties.find((x) => x.instance === "temperature");
    return typeof p?.value === "number" ? p.value : undefined;
  }

  private async actionToDesired(a: ActionConfig, out: DesiredEntry[]) {
    const device = this.devices.devices.get(a.device);
    if (!device) return;
    if (a.on !== undefined) {
      out.push({ deviceId: a.device, type: "devices.capabilities.on_off", instance: "on", value: a.on, label: device.name + (a.on ? ": вкл" : ": выкл") });
    }
    if (a.temperature !== undefined) {
      out.push({ deviceId: a.device, type: "devices.capabilities.range", instance: "temperature", value: a.temperature, label: `${device.name}: ${a.temperature}°C` });
    }
    if (a.mode) {
      out.push({ deviceId: a.device, type: "devices.capabilities.mode", instance: a.mode.instance, value: a.mode.value, label: `${device.name}: режим ${a.mode.value}` });
    }
    if (a.toggle) {
      out.push({ deviceId: a.device, type: "devices.capabilities.toggle", instance: a.toggle.instance, value: a.toggle.value, label: `${device.name}: тумблер ${a.toggle.instance}` });
    }
  }

  /**
   * Дифф желанных команд против фактического состояния устройств.
   * Отправляет только реальные изменения, уважая коолдауны, оверрайды
   * и единообразие команд.
   */
  private async applyDesired(scenario: ScenarioConfig, desired: DesiredEntry[], result: ScenarioRunResult) {
    const now = Date.now();
    result.desired = desired;

    const grouped = new Map<string, DesiredEntry[]>();
    for (const e of desired) {
      const arr = grouped.get(e.deviceId) ?? [];
      arr.push(e);
      grouped.set(e.deviceId, arr);
    }

    for (const [deviceId, entries] of grouped) {
      // Ручное управление
      const ovr = this.state.overrides.find((o) => o.deviceId === deviceId && (o.until === 0 || o.until > now));
      if (ovr) {
        for (const e of entries) result.skipped.push({ entry: e, reason: `ручное управление (${ovr.reason})` });
        this.log("info", scenario.id, `Пропущено: ${entries.length} команд для ${deviceId} — ручное управление`);
        continue;
      }

      const device = this.devices.devices.get(deviceId);
      if (!device) {
        for (const e of entries) result.skipped.push({ entry: e, reason: "устройство не найдено" });
        continue;
      }

      const pending: DesiredEntry[] = [];
      for (const e of entries) {
        // коолдаун
        const key = entryKey(e);
        const last = this.lastCommands.get(key);
        if (last && now - last < (scenario.climate?.minIntervalMs ?? 60_000)) {
          result.skipped.push({ entry: e, reason: "коолдаун команды" });
          continue;
        }

        // не отправлять одинаковые команды
        const current = this.deviceStateValue(device, e.type, e.instance);
        if (current === e.value) {
          // уже в таком состоянии
          continue;
        }

        pending.push(e);
      }

      if (pending.length === 0) continue;

      const token = getYandexToken();
      if (!token) {
        result.ok = false;
        for (const e of pending) {
          result.skipped.push({ entry: e, reason: "токен Яндекса не настроен" });
        }
        this.log("error", scenario.id, "Токен Яндекса не настроен — команды не отправлены");
        continue;
      }

      const actions = pending.map((e) => toYandexAction(e));
      try {
        await sendYandexDeviceActions(token, deviceId, actions);
        for (const e of pending) {
          this.lastCommands.set(entryKey(e), Date.now());
          result.sent.push(e);
          if (e.type === "devices.capabilities.mode" && e.instance === "thermostat") {
            this.acModeChangedAt[deviceId] = Date.now();
          }
        }
        this.log("info", scenario.id, `Сценарий → ${device.name}: ${pending.map((p) => p.label).join(", ")}`);
        this.broadcastDevices(deviceId);
      } catch (err) {
        result.ok = false;
        for (const e of pending) result.skipped.push({ entry: e, reason: `ошибка отправки: ${String(err)}` });
        this.log("error", scenario.id, `Ошибка отправки команды для ${device.name}: ${String(err)}`);
      }
    }
  }

  private deviceStateValue(device: any, type: string, instance?: string): unknown {
    if (type === "devices.capabilities.on_off") return getOnOff(device);
    if (type === "devices.capabilities.mode") return getMode(device, instance ?? "thermostat");
    if (type === "devices.capabilities.range") {
      const c = device.capabilities.find((x: any) => x.type === type && x.instance === (instance ?? "temperature"));
      return c?.value;
    }
    if (type === "devices.capabilities.toggle") {
      const c = device.capabilities.find((x: any) => x.type === type && x.instance === instance);
      return c?.value;
    }
    return undefined;
  }

  private broadcastDevices(deviceId: string) {
    // Уведомляем клиентов через WS, чтобы UI обновился без полного рефреша
    broadcastAll({ type: "device_changed", deviceId });
  }

  private broadcastState() {
    broadcastAll({ type: "engine_state", ...this.getState() } as unknown as Record<string, unknown>);
  }
}

function describeCond(cond: Condition | undefined): string {
  if (!cond) return "нет условий";
  return describeCondition(cond);
}

/**
 * Создаёт (или возвращает уже созданный) движок.
 */
export function getEngine(): ScenarioEngine {
  if (!single) single = new ScenarioEngine();
  return single;
}

let single: ScenarioEngine | null = null;

export function startEngine(): ScenarioEngine {
  const engine = getEngine();
  engine.start();
  return engine;
}