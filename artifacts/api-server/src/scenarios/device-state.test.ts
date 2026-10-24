import { describe, it, expect } from "vitest";
import {
  indexDevices,
  getOnOff,
  getTemp,
  getMode,
  getToggle,
  getReading,
  isOnline,
  resolveValue,
  isAvailable,
  toYandexAction,
  entryKey,
  type DeviceMap,
} from "./device-state";

function makeDevices(): DeviceMap {
  return indexDevices({
    devices: [
      {
        id: "ac-1",
        name: "Кондиционер",
        type: "devices.types.thermostat.ac",
        online: true,
        capabilities: [
          { type: "devices.capabilities.on_off", state: { instance: "on", value: true } },
          { type: "devices.capabilities.mode", state: { instance: "thermostat", value: "cool" } },
          { type: "devices.capabilities.range", state: { instance: "temperature", value: 22 } },
          { type: "devices.capabilities.toggle", state: { instance: "ionization", value: true } },
          { type: "devices.capabilities.on_off" },
        ],
        properties: [
          { type: "devices.properties.float", state: { instance: "temperature", value: 23.5 } },
          { type: "devices.properties.float", state: { instance: "humidity", value: 41 } },
        ],
      },
      {
        id: "light-1",
        name: "Лампа",
        type: "devices.types.light",
        online: false,
        capabilities: [
          { type: "devices.capabilities.on_off", state: { instance: "on", value: false } },
          { type: "devices.capabilities.range", state: { instance: "brightness", value: 30 } },
        ],
      },
    ],
  });
}

describe("indexDevices", () => {
  it("индексирует устройства и отбрасывает способности без state", () => {
    const map = makeDevices();
    const ac = map.devices.get("ac-1")!;
    expect(map.devices.size).toBe(2);
    expect(ac.capabilities).toHaveLength(4);
    expect(ac.name).toBe("Кондиционер");
    expect(ac.online).toBe(true);
  });

  it("читает instance/value из state свойства", () => {
    const ac = makeDevices().devices.get("ac-1")!;
    expect(ac.capabilities.find((c) => c.type === "devices.capabilities.range")).toEqual({
      type: "devices.capabilities.range",
      instance: "temperature",
      value: 22,
    });
  });
});

describe("getOnOff / getTemp / getMode / getToggle", () => {
  it("getOnOff возвращает boolean, а не undefined для отсутствующего устройства", () => {
    const devices = makeDevices();
    expect(getOnOff(devices.devices.get("ac-1"))).toBe(true);
    expect(getOnOff(devices.devices.get("light-1"))).toBe(false);
    expect(getOnOff(devices.devices.get("missing"))).toBeUndefined();
  });

  it("getTemp читает range/temperature", () => {
    expect(getTemp(makeDevices().devices.get("ac-1"))).toBe(22);
  });

  it("getMode по умолчанию читает instance thermostat", () => {
    expect(getMode(makeDevices().devices.get("ac-1"))).toBe("cool");
    expect(getMode(makeDevices().devices.get("light-1"))).toBeUndefined();
  });

  it("getToggle читает конкретный toggle-инстанс", () => {
    expect(getToggle(makeDevices().devices.get("ac-1"), "ionization")).toBe(true);
    expect(getToggle(makeDevices().devices.get("ac-1"), "unknown")).toBeUndefined();
  });
});

describe("getReading / isOnline", () => {
  it("getReading возвращает числовое свойство", () => {
    const devices = makeDevices();
    expect(getReading(devices.devices.get("ac-1"), "temperature")).toBe(23.5);
    expect(getReading(devices.devices.get("ac-1"), "humidity")).toBe(41);
    expect(getReading(devices.devices.get("ac-1"), "co2")).toBeUndefined();
    expect(getReading(undefined, "temperature")).toBeUndefined();
  });

  it("isOnline учитывает флаг online", () => {
    const devices = makeDevices();
    expect(isOnline(devices.devices.get("ac-1"))).toBe(true);
    // indexDevices нормализует отсутствие online в false (!!d.online)
    expect(isOnline(devices.devices.get("light-1"))).toBe(false);
    expect(isOnline(undefined)).toBe(false);
  });
});

describe("resolveValue", () => {
  it("резолвит constant / property / capability / room_temp", () => {
    const devices = makeDevices();
    expect(resolveValue({ kind: "constant", value: 7 }, devices, {})).toBe(7);
    expect(resolveValue({ kind: "property", device: "ac-1", instance: "humidity" }, devices, {})).toBe(41);
    expect(
      resolveValue(
        { kind: "capability", device: "ac-1", type: "devices.capabilities.range", instance: "temperature" },
        devices,
        {}
      )
    ).toBe(22);
    expect(resolveValue({ kind: "room_temp" }, devices, { roomTemp: 19 })).toBe(19);
    expect(resolveValue({ kind: "mode_temp", device: "ac-1" }, devices, {})).toBe(22);
  });

  it("возвращает undefined для нечисловой capability", () => {
    const devices = makeDevices();
    expect(
      resolveValue(
        { kind: "capability", device: "ac-1", type: "devices.capabilities.mode", instance: "thermostat" },
        devices,
        {}
      )
    ).toBeUndefined();
  });
});

describe("isAvailable", () => {
  it("проверяет capability по типу и instance", () => {
    const devices = makeDevices();
    expect(isAvailable("ac-1", devices, "capability", "devices.capabilities.on_off", "on")).toBe(true);
    expect(isAvailable("ac-1", devices, "capability", "devices.capabilities.on_off", "off")).toBe(false);
    expect(isAvailable("missing", devices, "capability", "devices.capabilities.on_off")).toBe(false);
  });

  it("проверяет property по instance", () => {
    const devices = makeDevices();
    expect(isAvailable("ac-1", devices, "property", "devices.properties.float", "humidity")).toBe(true);
    expect(isAvailable("ac-1", devices, "property", "devices.properties.float", "co2")).toBe(false);
  });
});

describe("toYandexAction / entryKey", () => {
  it("подставляет instance по умолчанию для on_off/range/mode", () => {
    expect(toYandexAction({ deviceId: "d", type: "devices.capabilities.on_off", label: "t", value: true })).toEqual({
      type: "devices.capabilities.on_off",
      state: { instance: "on", value: true },
    });
    expect(toYandexAction({ deviceId: "d", type: "devices.capabilities.range", label: "t", value: 50 })).toEqual({
      type: "devices.capabilities.range",
      state: { instance: "temperature", value: 50 },
    });
    expect(toYandexAction({ deviceId: "d", type: "devices.capabilities.mode", label: "t", value: "cool" })).toEqual({
      type: "devices.capabilities.mode",
      state: { instance: "thermostat", value: "cool" },
    });
  });

  it("entryKey различает инстансы", () => {
    expect(entryKey({ deviceId: "d", type: "devices.capabilities.on_off", instance: "on", label: "t", value: true })).toBe(
      "d::devices.capabilities.on_off::on"
    );
    expect(
      entryKey({ deviceId: "d", type: "devices.capabilities.range", instance: "brightness", label: "t", value: 1 })
    ).not.toBe(entryKey({ deviceId: "d", type: "devices.capabilities.range", instance: "volume", label: "t", value: 1 }));
  });
});
