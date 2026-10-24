import { describe, it, expect, vi, afterEach } from "vitest";
import { evaluateConditions, describeCondition, type ConditionCtx } from "./conditions";
import { indexDevices } from "./device-state";

function makeCtx(): ConditionCtx {
  const devices = indexDevices({
    devices: [
      {
        id: "ac-1",
        type: "devices.types.thermostat.ac",
        capabilities: [
          { type: "devices.capabilities.on_off", state: { instance: "on", value: true } },
          { type: "devices.capabilities.mode", state: { instance: "thermostat", value: "cool" } },
        ],
      },
      {
        id: "sensor-1",
        type: "devices.types.sensor.climate",
        properties: [
          { type: "devices.properties.float", state: { instance: "temperature", value: 26 } },
        ],
      },
    ],
  });
  return { presence: "home", devices, roomTemp: 18 };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("evaluateConditions — базовые узлы", () => {
  it("true всегда истинно", () => {
    expect(evaluateConditions({ type: "true" }, makeCtx())).toBe(true);
  });

  it("and / or / not", () => {
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "and", children: [{ type: "true" }, { type: "true" }] }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "and", children: [{ type: "true" }, { type: "home_mode", value: "away" }] }, ctx)).toBe(false);
    expect(evaluateConditions({ type: "or", children: [{ type: "true" }, { type: "true" }] }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "or", children: [{ type: "home_mode", value: "away" }, { type: "home_mode", value: "home" }] }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "not", child: { type: "true" } }, ctx)).toBe(false);
  });

  it("home_mode сравнивает presence", () => {
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "home_mode", value: "home" }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "home_mode", value: "away" }, ctx)).toBe(false);
  });
});

describe("evaluateConditions — compare и гистерезис", () => {
  it("сравнение constant без гистерезиса", () => {
    const ctx = makeCtx();
    const mk = (v: number) =>
      ({ type: "compare", source: { kind: "constant", value: v }, op: "gt", value: 3 } as const);
    expect(evaluateConditions(mk(4), ctx)).toBe(true);
    expect(evaluateConditions(mk(3), ctx)).toBe(false);
  });

  it("гистерезис lt удерживает состояние включённым до threshold + h", () => {
    const ctx = makeCtx();
    const states = new Map<string, { active: boolean }>();
    const mk = (v: number) =>
      ({ type: "compare", source: { kind: "constant", value: v }, op: "lt", value: 20, hysteresis: 2 } as const);

    expect(evaluateConditions(mk(17), ctx, states)).toBe(true);
    // предыдущее состояние active — порог сдвинут на +h
    expect(evaluateConditions(mk(21), ctx, states)).toBe(true);
    expect(evaluateConditions(mk(22.5), ctx, states)).toBe(false);
  });

  it("гистерезис gt", () => {
    const ctx = makeCtx();
    const states = new Map<string, { active: boolean }>();
    const mk = (v: number) =>
      ({ type: "compare", source: { kind: "constant", value: v }, op: "gt", value: 24, hysteresis: 2 } as const);
    expect(evaluateConditions(mk(25), ctx, states)).toBe(true);
    expect(evaluateConditions(mk(23), ctx, states)).toBe(true);
    expect(evaluateConditions(mk(21.9), ctx, states)).toBe(false);
  });

  it("сравнивает property устройства через resolveValue", () => {
    const ctx = makeCtx();
    const cond = {
      type: "compare",
      source: { kind: "property", device: "sensor-1", instance: "temperature" },
      op: "gt",
      value: 25,
    } as const;
    expect(evaluateConditions(cond, ctx)).toBe(true);
  });

  it("недостающее значение трактуется как false", () => {
    const ctx = makeCtx();
    const cond = {
      type: "compare",
      source: { kind: "property", device: "sensor-1", instance: "humidity" },
      op: "gt",
      value: 1,
    } as const;
    expect(evaluateConditions(cond, ctx)).toBe(false);
  });
});

describe("evaluateConditions — время и дни", () => {
  it("time_between с переходом через полночь", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T23:30:00"));
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "time_between", from: "22:00", to: "06:00" }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "time_between", from: "09:00", to: "17:00" }, ctx)).toBe(false);
    expect(evaluateConditions({ type: "time_between", from: "10:00", to: "10:00" }, ctx)).toBe(false);
  });

  it("time_between внутри интервала", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00"));
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "time_between", from: "09:00", to: "17:00" }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "time_between", from: "13:00", to: "17:00" }, ctx)).toBe(false);
  });

  it("weekday_in сверяет день недели (17.09.2026 — четверг, 4)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00"));
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "weekday_in", days: [4] }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "weekday_in", days: [0, 6] }, ctx)).toBe(false);
  });
});

describe("evaluateConditions — состояние устройств", () => {
  it("device_on / device_off", () => {
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "device_on", device: "ac-1" }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "device_off", device: "ac-1" }, ctx)).toBe(false);
    expect(evaluateConditions({ type: "device_on", device: "missing" }, ctx)).toBe(false);
  });

  it("mode сверяет значение режима", () => {
    const ctx = makeCtx();
    expect(evaluateConditions({ type: "mode", device: "ac-1", value: "cool" }, ctx)).toBe(true);
    expect(evaluateConditions({ type: "mode", device: "ac-1", value: "heat" }, ctx)).toBe(false);
  });

  it("sensor_available для capability и property", () => {
    const ctx = makeCtx();
    expect(
      evaluateConditions(
        { type: "sensor_available", source: "capability", device: "ac-1", capType: "devices.capabilities.on_off", instance: "on" },
        ctx
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        { type: "sensor_available", source: "capability", device: "ac-1", capType: "devices.capabilities.on_off", instance: "off" },
        ctx
      )
    ).toBe(false);
    expect(
      evaluateConditions(
        { type: "sensor_available", source: "property", device: "sensor-1", capType: "devices.properties.float", instance: "temperature" },
        ctx
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        { type: "sensor_available", source: "property", device: "sensor-1", capType: "devices.properties.float", instance: "co2" },
        ctx
      )
    ).toBe(false);
  });
});

describe("describeCondition", () => {
  it("формирует человекочитаемое описание", () => {
    expect(describeCondition({ type: "true" })).toBe("всегда");
    expect(describeCondition({ type: "and", children: [{ type: "true" }, { type: "true" }] })).toBe("всегда и всегда");
    expect(describeCondition({ type: "not", child: { type: "true" } })).toBe("не (всегда)");
    expect(describeCondition({ type: "weekday_in", days: [1, 2] })).toBe("дни 1,2");
  });
});
