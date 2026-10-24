/**
 * Логика климат-сценария.
 *
 * Решает, в каком режиме находиться (home/away/night/morning) и какие цели
 * выставить каждому управляемому устройству. Перманентно вычисляет ЖЕЛАЕМОЕ
 * состояние на каждый цикл; движок отправляет только отличия (дифф).
 * Устройства, не упомянутые в конфигурации, не трогаются.
 */

import type { ClimateConfig, DesiredEntry, HomeMode } from "./types";
import type { DeviceMap } from "./device-state";
import { getOnOff, getReading } from "./device-state";
import { getLastWeather } from "../lib/weather-store";

export interface ClimateReadings {
  roomTemp?: number;
  supplyTemp?: number;
  outdoorTemp?: number;
  at?: number;
}

export interface ClimateContext {
  devices: DeviceMap;
  presence: HomeMode;
  homeMode: HomeMode;
  readings: ClimateReadings;
  acModeChangedAt: Record<string, number>;
  now: number;
}

export interface ClimateDecision {
  desired: DesiredEntry[];
  homeMode: HomeMode;
  /** логи понятий решения */
  notes: string[];
}

function setTarget(
  type: string,
  deviceId: string,
  instance: string,
  value: unknown,
  label: string
): DesiredEntry {
  return { deviceId, type, instance, value, label };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((s) => parseInt(s, 10) || 0);
  return h * 60 + m;
}

/**
 * Определение текущего режима дома на основе времени и presence.
 */
export function resolveHomeMode(
  presence: HomeMode,
  config: ClimateConfig,
  now: Date = new Date()
): HomeMode {
  if (presence === "away") return "away";
  const cur = now.getHours() * 60 + now.getMinutes();
  const nightStart = timeToMinutes(config.times.nightStart);
  const nightEnd = timeToMinutes(config.times.nightEnd);
  const morningStart = timeToMinutes(config.times.morningStart);
  const morningEnd = timeToMinutes(config.times.morningEnd);

  const isNight =
    nightStart > nightEnd
      ? cur >= nightStart || cur < nightEnd
      : cur >= nightStart && cur < nightEnd;
  if (isNight) return "night";

  const isMorning =
    morningStart > morningEnd
      ? cur >= morningStart || cur < morningEnd
      : cur >= morningStart && cur < morningEnd;
  if (isMorning) return "morning";

  return "home";
}

function heatingTarget(mode: HomeMode, config: ClimateConfig): number {
  return config.targets[mode];
}

/**
 * Получить целевые значения для всех управляемых устройств.
 */
export function decideClimate(config: ClimateConfig, ctx: ClimateContext): ClimateDecision {
  const desired: DesiredEntry[] = [];
  const notes: string[] = [];
  const { devices } = ctx.devices;
  const d = config.devices;
  const r = ctx.readings;
  const mode = ctx.homeMode;
  const hyst = config.hysteresis;

  const roomTemp = r.roomTemp;
  notes.push(`Режим дома: ${mode}. В комнате: ${roomTemp != null ? roomTemp + "°C" : "н/д"}`);

  const acId = d.ac;
  const electricHeaterId = d.electricHeater;
  const supplyHeaterId = d.supplyHeater;
  const radiatorId = d.radiator;
  const floorId = d.floor;

  const electricHeaterDev = electricHeaterId ? devices.get(electricHeaterId) : undefined;
  const acDev = acId ? devices.get(acId) : undefined;
  const supplyHeaterDev = supplyHeaterId ? devices.get(supplyHeaterId) : undefined;

  // Bail: если нет комнатного датчика — ничего не делаем (безопасно)
  if (roomTemp == null) {
    notes.push("Нет данных комнатного датчика — решения не принимаются, ничего не трогаем");
    return { desired, homeMode: mode, notes };
  }

  const target = heatingTarget(mode, config);

  // ── Охлаждение (AC)
  const acOn = acDev ? getOnOff(acDev) : false;

  if (mode !== "away" && acId && acOn) {
    // AC уже включён — поддерживаем
    desired.push(setTarget("devices.capabilities.mode", acId, "thermostat", "cool", "AC: режим охлаждение"));
    if (roomTemp < config.targets.acCool - 1) {
      desired.push(setTarget("devices.capabilities.on_off", acId, "on", false, "AC: выкл (достигнуто)"));
      notes.push("AC выключен — температура ниже целевой");
    } else {
      desired.push(setTarget("devices.capabilities.range", acId, "temperature", config.targets.acCool, `AC: цель ${config.targets.acCool}°C`));
      notes.push(`AC работает: охлаждение до ${config.targets.acCool}°C`);
    }
  } else if (mode !== "away" && acId && roomTemp >= config.targets.acOnThreshold) {
    const lastChange = ctx.acModeChangedAt[acId] ?? 0;
    const modeChangedRecently =
      ctx.now - lastChange < config.safety.minAcModeChangeIntervalMs;
    if (!modeChangedRecently) {
      desired.push(setTarget("devices.capabilities.mode", acId, "thermostat", "cool", "AC: режим охлаждение"));
      desired.push(setTarget("devices.capabilities.on_off", acId, "on", true, "AC: вкл"));
      desired.push(setTarget("devices.capabilities.range", acId, "temperature", config.targets.acCool, `AC: цель ${config.targets.acCool}°C`));
      notes.push(`В квартире жарко (${roomTemp}°C ≥ ${config.targets.acOnThreshold}) — включаю AC`);
    } else {
      notes.push("AC недавно переключался — пропуск включения (защита)");
    }
  }

  // ── Режим away: всё выключено, радиаторы на сохранение
  if (mode === "away") {
    if (radiatorId) {
      desired.push(setTarget("devices.capabilities.range", radiatorId, "temperature", config.targets.away, `Радиатор: цель ${config.targets.away}°C`));
      notes.push(`Нет дома: радиатор → ${config.targets.away}°C`);
    }
    if (electricHeaterId) {
      desired.push(setTarget("devices.capabilities.on_off", electricHeaterId, "on", false, "Электроконвектор: выкл"));
    }
    if (acId) {
      desired.push(setTarget("devices.capabilities.on_off", acId, "on", false, "AC: выкл"));
    }
    if (supplyHeaterId) {
      desired.push(setTarget("devices.capabilities.on_off", supplyHeaterId, "on", false, "Нагреватель притока: выкл"));
    }
    if (floorId) {
      desired.push(setTarget("devices.capabilities.on_off", floorId, "on", false, "Тёплый пол: выкл"));
    }
    notes.push("Нет дома: климат-устройства выключены (кроме радиатора на сохранении)");
    return { desired, homeMode: mode, notes };
  }

  // ── Компенсация притока: нагреватель притока
  const ventDev = d.vent ? devices.get(d.vent) : undefined;
  const ventOn = ventDev ? getOnOff(ventDev) === true : false;
  const supplyTemp = r.supplyTemp;
  const supplyTarget = config.targets.supply;

  if (supplyHeaterId && supplyHeaterDev && supplyTemp != null) {
    if (ventOn) {
      if (supplyTemp < supplyTarget - hyst) {
        desired.push(setTarget("devices.capabilities.on_off", supplyHeaterId, "on", true, "Нагреватель притока: вкл"));
        desired.push(setTarget("devices.capabilities.range", supplyHeaterId, "temperature", supplyTarget, `Нагреватель притока: цель ${supplyTarget}°C`));
        notes.push(`Приток ${supplyTemp}°C < ${supplyTarget - hyst}°C — грею`);
      } else if (supplyTemp >= supplyTarget + hyst) {
        desired.push(setTarget("devices.capabilities.on_off", supplyHeaterId, "on", false, "Нагреватель притока: выкл"));
        notes.push("Приток достиг цели — нагреватель выкл");
      }
    } else if (config.safety.heaterRequiresVent) {
      desired.push(setTarget("devices.capabilities.on_off", supplyHeaterId, "on", false, "Нагреватель притока: выкл (нет вентиляции)"));
      notes.push("Вентиляция выключена — нагреватель притока не включаю");
    }
  }

  // ── Отопление: выбираем приоритетный источник
  const radiatorDev = radiatorId ? devices.get(radiatorId) : undefined;
  const floorDev = floorId ? devices.get(floorId) : undefined;
  const needHeat = roomTemp < target - hyst;

  if (needHeat) {
    for (const prio of config.priorities) {
      if (prio === "radiator" && radiatorDev) {
        desired.push(setTarget("devices.capabilities.range", radiatorId!, "temperature", target, `Радиатор: цель ${target}°C`));
        notes.push(`Холодно (${roomTemp}°C < ${target - hyst}) — радиатор → ${target}°C`);
        if (electricHeaterId) {
          desired.push(setTarget("devices.capabilities.on_off", electricHeaterId, "on", false, "Электроконвектор: выкл"));
        }
        if (floorId) {
          desired.push(setTarget("devices.capabilities.on_off", floorId, "on", false, "Тёплый пол: выкл"));
        }
        break;
      }
      if (prio === "floor" && floorDev) {
        desired.push(setTarget("devices.capabilities.on_off", floorId!, "on", true, "Тёплый пол: вкл"));
        notes.push(`Холодно — тёплый пол вкл (${target + config.floorOffset}°C)`);
        if (electricHeaterId) {
          desired.push(setTarget("devices.capabilities.on_off", electricHeaterId, "on", false, "Электроконвектор: выкл"));
        }
        break;
      }
      if (prio === "electricHeater" && electricHeaterDev) {
        desired.push(setTarget("devices.capabilities.on_off", electricHeaterId!, "on", true, "Электроконвектор: вкл"));
        notes.push("Холодно — включаю электроконвектор");
        break;
      }
    }
  } else {
    if (floorId) {
      desired.push(setTarget("devices.capabilities.on_off", floorId, "on", false, "Тёплый пол: выкл (тепло)"));
    }
    if (electricHeaterId) {
      desired.push(setTarget("devices.capabilities.on_off", electricHeaterId, "on", false, "Электроконвектор: выкл (тепло)"));
    }
  }

  return { desired, homeMode: mode, notes };
}

/** Собрать показания для климат-сценария из карты устройств */
export function collectReadings(config: ClimateConfig, devices: DeviceMap, now: number): ClimateReadings {
  const d = config.devices;
  const dev = (id?: string) => (id ? devices.devices.get(id) : undefined);
  const weather = getLastWeather();
  return {
    roomTemp: d.roomTemp ? getReading(dev(d.roomTemp), "temperature") : undefined,
    supplyTemp: d.supplyTemp ? getReading(dev(d.supplyTemp), "temperature") : undefined,
    outdoorTemp: weather?.temperature_2m,
    at: now,
  };
}