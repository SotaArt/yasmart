import { describe, it, expect } from "vitest";
import { decideClimate, resolveHomeMode, collectReadings, type ClimateContext } from "./climate";
import { indexDevices, type DeviceMap } from "./device-state";
import { DEFAULT_CLIMATE, type ClimateConfig, type DesiredEntry } from "./types";
import { setLastWeather } from "../lib/weather-store";

const cap = (type: string, instance: string, value: unknown) => ({ type, state: { instance, value } });
const prop = (instance: string, value: number) => ({
  type: "devices.properties.float",
  state: { instance, value },
});

function map(devices: any[]): DeviceMap {
  return indexDevices({ devices });
}

function config(over: Partial<ClimateConfig> = {}): ClimateConfig {
  return { ...structuredClone(DEFAULT_CLIMATE), ...over };
}

function ctx(devices: DeviceMap, readings: ClimateContext["readings"], over: Partial<ClimateContext> = {}): ClimateContext {
  return {
    devices,
    presence: "home",
    homeMode: "home",
    readings,
    acModeChangedAt: {},
    now: Date.now(),
    ...over,
  };
}

const find = (entries: DesiredEntry[], deviceId: string, type: string) =>
  entries.find((e) => e.deviceId === deviceId && e.type === type);

describe("resolveHomeMode", () => {
  const cfg = config();
  it("away принудительно возвращает away", () => {
    expect(resolveHomeMode("away", cfg, new Date("2026-09-17T12:00:00"))).toBe("away");
  });
  it("днём — home", () => {
    expect(resolveHomeMode("home", cfg, new Date("2026-09-17T12:00:00"))).toBe("home");
  });
  it("ночью — night", () => {
    expect(resolveHomeMode("home", cfg, new Date("2026-09-17T23:00:00"))).toBe("night");
  });
  it("утром — morning", () => {
    expect(resolveHomeMode("home", cfg, new Date("2026-09-17T08:00:00"))).toBe("morning");
  });
});

describe("decideClimate — базовые предохранители", () => {
  it("без комнатного датчика не принимает решений", () => {
    const decision = decideClimate(config(), ctx(map([]), { roomTemp: undefined }));
    expect(decision.desired).toHaveLength(0);
    expect(decision.notes.join(" ")).toContain("Нет данных комнатного датчика");
  });

  it("не трогает устройства, не перечисленные в конфиге", () => {
    const devices = map([
      { id: "rad-1", type: "devices.types.thermostat", capabilities: [cap("devices.capabilities.range", "temperature", 20)] },
    ]);
    const decision = decideClimate(config(), ctx(devices, { roomTemp: 10 }));
    expect(decision.desired).toHaveLength(0);
  });
});

describe("decideClimate — режим away", () => {
  it("выключает климат и переводит радиатор на сохранение", () => {
    const cfg = config({
      devices: { radiator: "rad-1", electricHeater: "eh-1", ac: "ac-1", supplyHeater: "sh-1", floor: "fl-1" },
    });
    const devices = map([
      { id: "rad-1", type: "devices.types.thermostat", capabilities: [cap("devices.capabilities.range", "temperature", 25)] },
      { id: "eh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
      { id: "ac-1", type: "devices.types.thermostat.ac", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
      { id: "sh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
      { id: "fl-1", type: "devices.types.thermostat", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 20 }, { presence: "away", homeMode: "away" }));
    expect(decision.homeMode).toBe("away");
    expect(find(decision.desired, "rad-1", "devices.capabilities.range")?.value).toBe(cfg.targets.away);
    for (const id of ["eh-1", "ac-1", "sh-1", "fl-1"]) {
      expect(find(decision.desired, id, "devices.capabilities.on_off")?.value).toBe(false);
    }
  });
});

describe("decideClimate — кондиционер", () => {
  const cfg = config({
    devices: { ac: "ac-1" },
    safety: { heaterRequiresVent: true, minAcModeChangeIntervalMs: 5 * 60_000 },
  });

  it("включает AC, когда жарко и смена режима не блокирована", () => {
    const devices = map([
      { id: "ac-1", type: "devices.types.thermostat.ac", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 26 }));
    expect(find(decision.desired, "ac-1", "devices.capabilities.on_off")?.value).toBe(true);
    expect(find(decision.desired, "ac-1", "devices.capabilities.mode")?.value).toBe("cool");
  });

  it("не включает AC при недавней смене режима (защита)", () => {
    const devices = map([
      { id: "ac-1", type: "devices.types.thermostat.ac", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 26 }, { acModeChangedAt: { "ac-1": Date.now() - 1000 } }));
    expect(find(decision.desired, "ac-1", "devices.capabilities.on_off")).toBeUndefined();
    expect(decision.notes.join(" ")).toContain("недавно переключался");
  });

  it("выключает AC при достижении цели", () => {
    const devices = map([
      { id: "ac-1", type: "devices.types.thermostat.ac", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 22 }));
    expect(find(decision.desired, "ac-1", "devices.capabilities.on_off")?.value).toBe(false);
  });
});

describe("decideClimate — приоритеты отопления", () => {
  it("радиатор имеет приоритет и глушит электроконвектор и пол", () => {
    const cfg = config({
      devices: { radiator: "rad-1", electricHeater: "eh-1", floor: "fl-1" },
      priorities: ["radiator", "floor", "electricHeater"],
    });
    const devices = map([
      { id: "rad-1", type: "devices.types.thermostat", capabilities: [cap("devices.capabilities.range", "temperature", 20)] },
      { id: "eh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
      { id: "fl-1", type: "devices.types.thermostat", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 10 }));
    expect(find(decision.desired, "rad-1", "devices.capabilities.range")?.value).toBe(cfg.targets.home);
    expect(find(decision.desired, "eh-1", "devices.capabilities.on_off")?.value).toBe(false);
    expect(find(decision.desired, "fl-1", "devices.capabilities.on_off")?.value).toBe(false);
  });

  it("электроконвектор включается, когда он единственный приоритет и холодно", () => {
    const cfg = config({ devices: { electricHeater: "eh-1" }, priorities: ["electricHeater"] });
    const devices = map([
      { id: "eh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 10 }));
    expect(find(decision.desired, "eh-1", "devices.capabilities.on_off")?.value).toBe(true);
  });

  it(
    "электроконвектор должен выключаться, когда в комнате тепло",
    () => {
      const cfg = config({ devices: { electricHeater: "eh-1" }, priorities: ["electricHeater"] });
      const devices = map([
        { id: "eh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
      ]);
      const decision = decideClimate(cfg, ctx(devices, { roomTemp: 25 }));
      expect(find(decision.desired, "eh-1", "devices.capabilities.on_off")?.value).toBe(false);
    }
  );
});

describe("decideClimate — нагреватель притока", () => {
  it("греет приток, когда вентиляция включена и приток холодный", () => {
    const cfg = config({ devices: { supplyHeater: "sh-1", vent: "vent-1", supplyTemp: "st-1" } });
    const devices = map([
      { id: "sh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
      { id: "vent-1", type: "devices.types.ventilation", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 20, supplyTemp: 15 }));
    expect(find(decision.desired, "sh-1", "devices.capabilities.on_off")?.value).toBe(true);
    expect(find(decision.desired, "sh-1", "devices.capabilities.range")?.value).toBe(cfg.targets.supply);
  });

  it("глушит нагреватель при отсутствии вентиляции", () => {
    const cfg = config({
      devices: { supplyHeater: "sh-1", vent: "vent-1", supplyTemp: "st-1" },
      safety: { heaterRequiresVent: true, minAcModeChangeIntervalMs: 0 },
    });
    const devices = map([
      { id: "sh-1", type: "devices.types.thermostat.heater", capabilities: [cap("devices.capabilities.on_off", "on", true)] },
      { id: "vent-1", type: "devices.types.ventilation", capabilities: [cap("devices.capabilities.on_off", "on", false)] },
    ]);
    const decision = decideClimate(cfg, ctx(devices, { roomTemp: 20, supplyTemp: 15 }));
    expect(find(decision.desired, "sh-1", "devices.capabilities.on_off")?.value).toBe(false);
  });
});

describe("collectReadings", () => {
  it("собирает комнатную/приточную/наружную температуру", () => {
    setLastWeather({ temperature_2m: 5, relative_humidity_2m: 50, weather_code: 0, updated_at: Date.now() });
    const cfg = config({ devices: { roomTemp: "rt-1", supplyTemp: "st-1" } });
    const devices = map([
      { id: "rt-1", type: "devices.types.sensor.climate", properties: [prop("temperature", 21.5)] },
      { id: "st-1", type: "devices.types.sensor.climate", properties: [prop("temperature", 18)] },
    ]);
    const readings = collectReadings(cfg, devices, 123);
    expect(readings.roomTemp).toBe(21.5);
    expect(readings.supplyTemp).toBe(18);
    expect(readings.outdoorTemp).toBe(5);
    expect(readings.at).toBe(123);
  });
});
