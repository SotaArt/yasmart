import { describe, it, expect } from "vitest";
import {
  getDeviceCapability,
  isDeviceOn,
  getDeviceStatus,
  getWeatherEmoji,
  sortRooms,
  getSignalInfo,
  type Device,
  type Room,
} from "./yandex";

const device = (over: Partial<Device>): Device => ({
  id: "d1",
  name: "Устройство",
  type: "devices.types.light",
  ...over,
});

describe("getDeviceCapability", () => {
  it("находит способность по типу без указания instance", () => {
    const d = device({
      capabilities: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: true } }],
    });
    expect(getDeviceCapability(d, "devices.capabilities.on_off")).toBeDefined();
  });

  it("различает range-способности по parameters.instance", () => {
    const d = device({
      capabilities: [
        { type: "devices.capabilities.range", parameters: { instance: "brightness" }, state: { instance: "brightness", value: 80 } },
        { type: "devices.capabilities.range", parameters: { instance: "volume" }, state: { instance: "volume", value: 20 } },
      ],
    });
    expect(getDeviceCapability(d, "devices.capabilities.range", "volume")?.state?.value).toBe(20);
    expect(getDeviceCapability(d, "devices.capabilities.range", "brightness")?.state?.value).toBe(80);
  });

  it.fails(
    "MEDIUM-баг: instance должен находиться и по state, если parameters отсутствуют (yandex.ts:305-309)",
    () => {
      const d = device({
        capabilities: [
          { type: "devices.capabilities.range", parameters: null, state: { instance: "volume", value: 20 } },
        ],
      });
      expect(getDeviceCapability(d, "devices.capabilities.range", "volume")).toBeDefined();
    }
  );
});

describe("isDeviceOn / getDeviceStatus", () => {
  it("isDeviceOn читает on_off.state.value", () => {
    expect(isDeviceOn(device({ capabilities: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: true } }] }))).toBe(true);
    expect(isDeviceOn(device({ capabilities: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: false } }] }))).toBe(false);
    expect(isDeviceOn(device({ capabilities: [] }))).toBe(false);
  });

  it("getDeviceStatus различает камеру, вкл/выкл, датчик и unknown", () => {
    expect(getDeviceStatus(device({ type: "devices.types.camera" })).type).toBe("camera");
    expect(
      getDeviceStatus(device({ capabilities: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: true } }] })).type
    ).toBe("on");
    expect(
      getDeviceStatus(
        device({
          capabilities: [],
          properties: [{ type: "devices.properties.float", state: { instance: "temperature", value: 22 } }],
        })
      ).type
    ).toBe("sensor");
    expect(getDeviceStatus(device({ capabilities: [] })).type).toBe("unknown");
  });
});

describe("getWeatherEmoji", () => {
  it("маппит коды погоды на эмодзи", () => {
    expect(getWeatherEmoji(0)).toBe("☀️");
    expect(getWeatherEmoji(3)).toBe("⛅");
    expect(getWeatherEmoji(61)).toBe("🌧️");
    expect(getWeatherEmoji(95)).toBe("⛈️");
    expect(getWeatherEmoji(1000)).toBe("🌡️");
  });
});

describe("sortRooms", () => {
  it("сортирует по приоритету, затем по имени", () => {
    const room = (id: string, name: string): Room => ({ id, name, household_id: "h1" });
    const sorted = sortRooms([room("1", "Кабинет"), room("2", "Кухня"), room("3", "Прихожая")]);
    expect(sorted.map((r) => r.name)).toEqual(["Прихожая", "Кухня", "Кабинет"]);
  });
});

describe("getSignalInfo", () => {
  const withRssi = (value: number) =>
    device({
      properties: [{ type: "devices.properties.float", parameters: { instance: "rssi" }, state: { instance: "rssi", value } }],
    });

  it("классифицирует уровень сигнала по dBm", () => {
    expect(getSignalInfo(withRssi(-40))?.label).toBe("Отлично");
    expect(getSignalInfo(withRssi(-60))?.label).toBe("Хорошо");
    expect(getSignalInfo(withRssi(-80))?.label).toBe("Плохо");
  });

  it("возвращает null без данных о сигнале", () => {
    expect(getSignalInfo(device({ properties: [] }))).toBeNull();
  });
});
