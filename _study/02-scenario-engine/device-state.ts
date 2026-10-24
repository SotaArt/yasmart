/**
 * Нормализация ответа Yandex /v1.0/user/info в удобные структуры.
 * Ничего не шлём в сеть — только локальные трансформации.
 */

import type { DesiredEntry, ValueSource } from "./types";

export interface CapState {
  type: string;
  instance?: string;
  value: unknown;
}

export interface DeviceView {
  id: string;
  name: string;
  type: string;
  room_id?: string | null;
  capabilities: CapState[];
  properties: CapState[];
  online?: boolean;
}

export interface DeviceMap {
  devices: Map<string, DeviceView>;
  byName: Map<string, DeviceView>;
}

export function indexDevices(userInfo: any): DeviceMap {
  const map = new Map<string, DeviceView>();
  for (const d of userInfo.devices ?? []) {
    if (!d?.id) continue;
    const caps: CapState[] = (d.capabilities ?? [])
      .filter((c: any) => c?.state)
      .map((c: any) => ({
        type: c.type,
        instance: c.state?.instance,
        value: c.state?.value,
      }));
    const props: CapState[] = (d.properties ?? [])
      .filter((p: any) => p?.state)
      .map((p: any) => ({
        type: p.type,
        instance: p.state?.instance,
        value: p.state?.value,
      }));
    map.set(d.id, {
      id: d.id,
      name: d.name,
      type: d.type,
      room_id: d.room_id ?? d.room ?? null,
      capabilities: caps,
      properties: props,
      online: !!d.online,
    });
  }
  return { devices: map, byName: map };
}

function capValue(device: DeviceView | undefined, type: string, instance?: string): unknown | undefined {
  if (!device) return undefined;
  const found = device.capabilities.find(
    (c) => c.type === type && (instance === undefined || c.instance === instance)
  );
  return found?.type === type ? found.value : undefined;
}

export function getOnOff(device: DeviceView | undefined): boolean | undefined {
  const v = capValue(device, "devices.capabilities.on_off", "on");
  return typeof v === "boolean" ? v : undefined;
}

export function getTemp(device: DeviceView | undefined): number | undefined {
  const v = capValue(device, "devices.capabilities.range", "temperature");
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function getMode(device: DeviceView | undefined, instance = "thermostat"): string | undefined {
  const v = capValue(device, "devices.capabilities.mode", instance);
  return typeof v === "string" ? v : undefined;
}

export function getToggle(device: DeviceView | undefined, instance: string): unknown | undefined {
  return capValue(device, "devices.capabilities.toggle", instance);
}

export function getReading(device: DeviceView | undefined, instance: string): number | undefined {
  if (!device) return undefined;
  for (const p of device.properties) {
    if (p.instance === instance && typeof p.value === "number" && Number.isFinite(p.value)) {
      return p.value;
    }
  }
  return undefined;
}

export function isOnline(device: DeviceView | undefined): boolean {
  return !!device && device.online !== false;
}

/** Резолв значения источника */
export function resolveValue(
  source: ValueSource,
  devices: DeviceMap,
  ctx: {
    roomTemp?: number;
    outdoorTemp?: number;
    supplyTemp?: number;
  }
): number | undefined {
  switch (source.kind) {
    case "room_temp":
      return ctx.roomTemp;
    case "outdoor_temp":
      return ctx.outdoorTemp;
    case "supply_temp":
      return ctx.supplyTemp;
    case "property":
      return getReading(devices.devices.get(source.device), source.instance);
    case "capability": {
      const dev = devices.devices.get(source.device);
      const v = capValue(dev, source.type, source.instance);
      return typeof v === "number" ? v : undefined;
    }
    case "mode_temp": {
      const dev = devices.devices.get(source.device);
      return getTemp(dev);
    }
    case "constant":
      return source.value;
    default:
      return undefined;
  }
}

export function conditionDeviceOn(c: { device: string }, devices: DeviceMap): boolean {
  return getOnOff(devices.devices.get(c.device)) === true;
}

export function isAvailable(
  deviceId: string,
  devices: DeviceMap,
  mode: "capability" | "property",
  type: string,
  instance?: string
): boolean {
  const dev = devices.devices.get(deviceId);
  if (!dev) return false;
  if (mode === "capability") {
    return !!dev.capabilities.find(
      (c) => c.type === type && (instance === undefined || c.instance === instance)
    );
  }
  return !!dev.properties.find(
    (p) => (p.type === "devices.properties.float" && p.instance === instance) ||
      (p.type === "devices.properties." + (instance ?? "") && p.instance === "value")
  );
}

/** Собрать Yandex action из DesiredEntry */
export function toYandexAction(entry: DesiredEntry): {
  type: string;
  state: Record<string, unknown>;
} {
  switch (entry.type) {
    case "devices.capabilities.on_off":
      return { type: entry.type, state: { instance: entry.instance ?? "on", value: entry.value } };
    case "devices.capabilities.range":
      return { type: entry.type, state: { instance: entry.instance ?? "temperature", value: entry.value } };
    case "devices.capabilities.mode":
      return { type: entry.type, state: { instance: entry.instance ?? "thermostat", value: entry.value } };
    case "devices.capabilities.toggle":
      return { type: entry.type, state: { instance: entry.instance ?? "", value: entry.value } };
    default:
      return { type: entry.type, state: { instance: entry.instance ?? "", value: entry.value } };
  }
}

/** Ключ для дедупликации: устройство+тип+инстанс */
export function entryKey(entry: DesiredEntry): string {
  return `${entry.deviceId}::${entry.type}::${entry.instance ?? ""}`;
}