/* ─── TypeScript types (from OpenAPI spec) ─── */

import { getSensorInversions } from "@/lib/sensor-inversions-store";

export interface DeviceCapability {
  type: string;
  retrievable?: boolean;
  reportable?: boolean;
  parameters?: Record<string, any> | null;
  state?: Record<string, any> | null;
}

export interface DeviceProperty {
  type: string;
  retrievable?: boolean;
  reportable?: boolean;
  parameters?: Record<string, any> | null;
  state?: Record<string, any> | null;
}

export interface Device {
  id: string;
  name: string;
  aliases?: string[];
  type: string;
  external_id?: string;
  skill_id?: string;
  room_id?: string | null;
  groups?: string[];
  capabilities?: DeviceCapability[];
  properties?: DeviceProperty[];
  household_id?: string | null;
  quasar_info?: Record<string, any>;
  device_info?: {
    manufacturer?: string;
    model?: string;
    device_id?: string;
    serial?: string;
    hw_version?: string;
    sw_version?: string;
  };
}

export interface Room {
  id: string;
  name: string;
  household_id: string;
  devices?: string[];
}

export interface Household {
  id: string;
  name: string;
}

export interface SensorReadings {
  temperature?: number;
  humidity?: number;
  pm25?: number;
  co2?: number;
  battery?: number;
  motion?: boolean;
  open?: boolean;
  presence?: boolean;
  vibration?: boolean;
  water_leak?: boolean;
  smoke?: boolean;
  gas?: boolean;
  illumination?: number;
}

export const DEVICE_ICONS: Record<string, string> = {
  // Light
  "devices.types.light": "💡",
  "devices.types.light.ceiling": "💡",
  "devices.types.light.dimmable": "🔆",
  "devices.types.light.garland": "🎄",
  "devices.types.light.lamp": "💡",
  "devices.types.light.sconce": "💡",
  "devices.types.light.strip": "🌈",
  "devices.types.light.torchere": "💡",
  // Switch / Socket
  "devices.types.switch": "💡",
  "devices.types.switch.relay": "🔌",
  "devices.types.socket": "🔌",
  // Thermostat
  "devices.types.thermostat": "🌡️",
  "devices.types.thermostat.ac": "❄️",
  // Sensors
  "devices.types.sensor": "📊",
  "devices.types.sensor.button": "🔔",
  "devices.types.sensor.climate": "📊",
  "devices.types.sensor.gas": "💨",
  "devices.types.sensor.illumination": "🌤️",
  "devices.types.sensor.motion": "🏃",
  "devices.types.sensor.open": "🚪",
  "devices.types.sensor.smoke": "🔥",
  "devices.types.sensor.vibration": "📳",
  "devices.types.sensor.water_leak": "🌊",
  // Openable
  "devices.types.openable": "🚪",
  "devices.types.openable.curtain": "🪟",
  "devices.types.openable.valve": "🔧",
  "devices.types.openable.door_lock": "🔐",
  // Climate
  "devices.types.thermostat.heater": "🔥",
  "devices.types.humidifier": "💧",
  "devices.types.purifier": "🌬️",
  "devices.types.ventilation": "🌀",
  "devices.types.ventilation.fan": "🌀",
  "devices.types.cooking.hood": "💨",
  // Media
  "devices.types.media_device": "🎵",
  "devices.types.media_device.receiver": "🎵",
  "devices.types.media_device.tv": "📺",
  "devices.types.media_device.tv_box": "📺",
  "devices.types.camera": "📷",
  // Cooking
  "devices.types.cooking": "🍳",
  "devices.types.cooking.coffee_maker": "☕",
  "devices.types.cooking.kettle": "☕",
  "devices.types.cooking.multicooker": "🍲",
  // Appliances
  "devices.types.dishwasher": "🍽️",
  "devices.types.iron": "👔",
  "devices.types.vacuum_cleaner": "🤖",
  "devices.types.washing_machine": "👕",
  // Pets
  "devices.types.pet_drinking_fountain": "🐾",
  "devices.types.pet_feeder": "🐾",
  // Smart meters
  "devices.types.smart_meter": "📊",
  "devices.types.smart_meter.cold_water": "💧",
  "devices.types.smart_meter.electricity": "⚡",
  "devices.types.smart_meter.gas": "💨",
  "devices.types.smart_meter.heat": "🔥",
  "devices.types.smart_meter.hot_water": "♨️",
  // Fallback
  "devices.types.other": "📱",
  "default": "📱",
};

/** Human-readable Russian label for a device type */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  // Light
  "devices.types.light": "Освещение",
  "devices.types.light.ceiling": "Люстра",
  "devices.types.light.dimmable": "Диммер",
  "devices.types.light.garland": "Гирлянда",
  "devices.types.light.lamp": "Настольная лампа",
  "devices.types.light.sconce": "Бра",
  "devices.types.light.strip": "Светодиодная лента",
  "devices.types.light.torchere": "Торшер",
  // Switch / Socket
  "devices.types.switch": "Выключатель",
  "devices.types.switch.relay": "Реле",
  "devices.types.socket": "Розетка",
  // Thermostat
  "devices.types.thermostat": "Термостат",
  "devices.types.thermostat.ac": "Кондиционер",
  "devices.types.thermostat.heater": "Обогреватель",
  // Sensors
  "devices.types.sensor": "Датчик",
  "devices.types.sensor.button": "Кнопка",
  "devices.types.sensor.climate": "Климат-сенсор",
  "devices.types.sensor.gas": "Датчик газа",
  "devices.types.sensor.illumination": "Датчик освещённости",
  "devices.types.sensor.motion": "Датчик движения",
  "devices.types.sensor.open": "Датчик открытия",
  "devices.types.sensor.smoke": "Датчик дыма",
  "devices.types.sensor.vibration": "Датчик вибрации",
  "devices.types.sensor.water_leak": "Датчик протечки",
  // Openable
  "devices.types.openable": "Открываемое",
  "devices.types.openable.curtain": "Штора",
  "devices.types.openable.valve": "Шаровой кран",
  "devices.types.openable.door_lock": "Замок",
  // Climate
  "devices.types.humidifier": "Увлажнитель",
  "devices.types.purifier": "Очиститель воздуха",
  "devices.types.ventilation": "Вентиляция",
  "devices.types.ventilation.fan": "Вентилятор",
  // Media
  "devices.types.media_device": "Медиаустройство",
  "devices.types.media_device.receiver": "Ресивер",
  "devices.types.media_device.tv": "Телевизор",
  "devices.types.media_device.tv_box": "ТВ-приставка",
  "devices.types.camera": "Камера",
  // Cooking
  "devices.types.cooking": "Кухонная техника",
  "devices.types.cooking.coffee_maker": "Кофеварка",
  "devices.types.cooking.hood": "Вытяжка",
  "devices.types.cooking.kettle": "Чайник",
  "devices.types.cooking.multicooker": "Мультиварка",
  // Appliances
  "devices.types.dishwasher": "Посудомоечная машина",
  "devices.types.iron": "Утюг",
  "devices.types.vacuum_cleaner": "Пылесос",
  "devices.types.washing_machine": "Стиральная машина",
  // Pets
  "devices.types.pet_drinking_fountain": "Поилка",
  "devices.types.pet_feeder": "Кормушка",
  // Smart meters
  "devices.types.smart_meter": "Счётчик",
  "devices.types.smart_meter.cold_water": "Счётчик холодной воды",
  "devices.types.smart_meter.electricity": "Счётчик электроэнергии",
  "devices.types.smart_meter.gas": "Счётчик газа",
  "devices.types.smart_meter.heat": "Счётчик тепла",
  "devices.types.smart_meter.hot_water": "Счётчик горячей воды",
  // Fallback
  "devices.types.other": "Устройство",
};

function lookupByPrefix(type: string, map: Record<string, string>, fallback: string): string {
  if (map[type]) return map[type];
  for (const key of Object.keys(map)) {
    if (type.startsWith(key)) return map[key];
  }
  return fallback;
}

export function getDeviceTypeLabel(type: string): string {
  return lookupByPrefix(type, DEVICE_TYPE_LABELS, type.split(".").pop() ?? type);
}

export function getDeviceIcon(type: string): string {
  return lookupByPrefix(type, DEVICE_ICONS, DEVICE_ICONS["default"]);
}

/** Динамические иконки в зависимости от состояния устройства */
const DEVICE_ICONS_ON: Record<string, string> = {
  "devices.types.light": "💡",
  "devices.types.light.ceiling": "💡",
  "devices.types.light.dimmable": "🔆",
  "devices.types.light.lamp": "💡",
  "devices.types.light.sconce": "💡",
  "devices.types.light.strip": "🌈",
  "devices.types.light.torchere": "💡",
  "devices.types.switch": "🟢",
  "devices.types.switch.relay": "🟢",
  "devices.types.socket": "🟢",
  "devices.types.thermostat.ac": "❄️",
  "devices.types.thermostat.heater": "🔥",
  "devices.types.humidifier": "💧",
  "devices.types.purifier": "🌬️",
  "devices.types.ventilation": "🌀",
  "devices.types.ventilation.fan": "🌀",
  "devices.types.cooking.hood": "💨",
  "devices.types.openable.door_lock": "🔓",
  "devices.types.vacuum_cleaner": "🤖",
  "devices.types.washing_machine": "🫧",
  "devices.types.cooking.kettle": "♨️",
  "devices.types.cooking.coffee_maker": "☕",
  "devices.types.media_device.tv": "📺",
};

const DEVICE_ICONS_OFF: Record<string, string> = {
  "devices.types.light": "🌑",
  "devices.types.light.ceiling": "🌑",
  "devices.types.light.dimmable": "🌑",
  "devices.types.light.lamp": "🌑",
  "devices.types.light.sconce": "🌑",
  "devices.types.light.strip": "🌑",
  "devices.types.light.torchere": "🌑",
  "devices.types.switch": "⚪",
  "devices.types.switch.relay": "⚪",
  "devices.types.socket": "⚪",
  "devices.types.thermostat.ac": "💤",
  "devices.types.thermostat.heater": "💨",
  "devices.types.humidifier": "💧",
  "devices.types.purifier": "🌬️",
  "devices.types.ventilation": "🌀",
  "devices.types.ventilation.fan": "💨",
  "devices.types.cooking.hood": "💨",
  "devices.types.openable.door_lock": "🔒",
  "devices.types.vacuum_cleaner": "💤",
  "devices.types.washing_machine": "👕",
  "devices.types.cooking.kettle": "☕",
  "devices.types.cooking.coffee_maker": "☕",
  "devices.types.media_device.tv": "📺",
};

export function getDeviceIconState(type: string, isOn: boolean): string {
  const icons = isOn ? DEVICE_ICONS_ON : DEVICE_ICONS_OFF;
  return lookupByPrefix(type, icons, getDeviceIcon(type));
}

const WEATHER_EMOJI_RANGES: Array<[number, number, string]> = [
  [0, 0, "☀️"],
  [1, 3, "⛅"],
  [45, 48, "🌫️"],
  [51, 67, "🌧️"],
  [71, 77, "❄️"],
  [80, 82, "🌦️"],
  [95, 99, "⛈️"],
];

export function getWeatherEmoji(code: number): string {
  for (const [min, max, emoji] of WEATHER_EMOJI_RANGES) {
    if (code >= min && code <= max) return emoji;
  }
  return "🌡️";
}

export function getDeviceCapability(device: Device, type: string, instance?: string): DeviceCapability | undefined {
  return device.capabilities?.find(
    (c) => c.type === type && (instance === undefined || c.parameters?.instance === instance)
  );
}

export function getDeviceProperty(device: Device, instance: string): DeviceProperty | undefined {
  return device.properties?.find((p) => p.parameters?.instance === instance);
}

export function isDeviceOn(device: Device): boolean {
  const cap = getDeviceCapability(device, "devices.capabilities.on_off");
  if (!cap) return false;
  return cap.state?.value === true;
}

export function hasToggle(device: Device): boolean {
  return !!getDeviceCapability(device, "devices.capabilities.on_off");
}

/** Unified device status — handles sensors, toggles, and unknown devices correctly */
export type DeviceStatusType = "on" | "off" | "sensor" | "camera" | "unknown";

export interface DeviceStatus {
  type: DeviceStatusType;
  label: string;
}

export function getDeviceStatus(device: Device): DeviceStatus {
  // Cameras are always-on streaming devices — not sensors
  if (device.type === "devices.types.camera") {
    return { type: "camera", label: "Камера" };
  }

  const cap = getDeviceCapability(device, "devices.capabilities.on_off");
  if (cap) {
    return cap.state?.value === true
      ? { type: "on", label: "Вкл" }
      : { type: "off", label: "Выкл" };
  }
  // No on_off capability — check if device has any property with state (sensor)
  const hasData = (device.properties ?? []).some(
    (p) => p.state?.value !== undefined && p.state?.value !== null
  );
  if (hasData) return { type: "sensor", label: "Датчик" };
  return { type: "unknown", label: "Нет данных" };
}

export function isDeviceReporting(device: Device): boolean {
  const status = getDeviceStatus(device);
  return status.type === "on" || status.type === "sensor" || status.type === "camera";
}

// Единый порядок комнат — совпадает с ЮП
export const ROOM_PRIORITY: Record<string, number> = {
  "прихожая": 1, "коридор": 2, "кухня": 3, "гостиная": 4, "гостинная": 4,
  "спальня": 5, "детская": 6, "ванная": 7, "ванна": 7,
  "кладовка": 8, "сервис": 9,
  "балкон": 10, "туалет": 11, "прачечная": 12, "кабинет": 13, "дом": 14,
};

export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const pa = ROOM_PRIORITY[a.name.toLowerCase()] ?? 99;
    const pb = ROOM_PRIORITY[b.name.toLowerCase()] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "ru");
  });
}

export interface DeviceSignal { value: string; label: string; color: string; }

export function getSignalInfo(device: Device): DeviceSignal | null {
  const signalProp = device.properties?.find(
    (p) => p.parameters?.instance === "signal_strength" || p.parameters?.instance === "rssi"
  );
  const rawValue = signalProp?.state?.value;
  if (rawValue === undefined || rawValue === null) return null;

  const numValue = Number(rawValue);
  const isDbm = numValue < 0;
  if (isDbm ? numValue > -50 : numValue >= 75) return { value: `${rawValue}`, label: "Отлично", color: "text-[hsl(var(--gold))]" };
  if (isDbm ? numValue > -70 : numValue >= 40) return { value: `${rawValue}`, label: "Хорошо", color: "text-yellow-400" };
  return { value: `${rawValue}`, label: "Плохо", color: "text-red-400" };
}

export function isAcDevice(device: Device): boolean {
  return device.type === "devices.types.thermostat.ac" || device.type === "devices.types.thermostat";
}

/** Returns all sensor-style property values present on a device, regardless of device type */
export function getSensorReadings(device: Device): SensorReadings {
  const props = device.properties ?? [];
  const get = (instance: string) =>
    props.find((p) => p.parameters?.instance === instance)?.state?.value;

  // Пользовательские инверсии событийных свойств (дверь/протечка и т.п.)
  const inverted = getSensorInversions(device.id);

  // Событийные свойства Яндекс приходят строками: "detected"/"not_detected",
  // "opened"/"closed", "dry"/"wet", "click"/"none"… Нужно декодировать, а не
  // Boolean(строка) — иначе "closed"/"dry"/"not_detected" превращаются в true.
  const toBool = (v: unknown): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      return !["", "0", "false", "off", "no", "none", "closed", "dry", "not_detected"].includes(v.toLowerCase());
    }
    return false;
  };

  const result: SensorReadings = {};
  const temp = get("temperature");
  if (temp !== undefined && temp !== null) result.temperature = Number(temp);
  const hum = get("humidity");
  if (hum !== undefined && hum !== null) result.humidity = Number(hum);
  const pm = get("pm2.5_density");
  if (pm !== undefined && pm !== null) result.pm25 = Number(pm);
  const co2 = get("co2_level");
  if (co2 !== undefined && co2 !== null) result.co2 = Number(co2);
  const bat = get("battery_level");
  if (bat !== undefined && bat !== null) result.battery = Number(bat);
  const motion = get("motion");
  if (motion !== undefined && motion !== null) result.motion = toBool(motion) !== inverted.has("motion");
  const open = get("open");
  if (open !== undefined && open !== null) result.open = toBool(open) !== inverted.has("open");
  // Датчики присутствия (devices.types.sensor.presence) отдают occupancy (0/1)
  const occupancy = get("occupancy");
  const presenceV = occupancy !== undefined && occupancy !== null ? occupancy : get("presence");
  if (presenceV !== undefined && presenceV !== null) result.presence = toBool(presenceV) !== inverted.has("presence");
  const vibration = get("vibration");
  if (vibration !== undefined && vibration !== null) result.vibration = toBool(vibration) !== inverted.has("vibration");
  const waterLeak = get("water_leak");
  if (waterLeak !== undefined && waterLeak !== null) result.water_leak = toBool(waterLeak) !== inverted.has("water_leak");
  const smoke = get("smoke");
  if (smoke !== undefined && smoke !== null) result.smoke = toBool(smoke) !== inverted.has("smoke");
  const gas = get("gas");
  if (gas !== undefined && gas !== null) result.gas = toBool(gas) !== inverted.has("gas");
  const illumination = get("illumination");
  if (illumination !== undefined && illumination !== null) result.illumination = Number(illumination);
  return result;
}

export function hasSensorReadings(device: Device): boolean {
  const r = getSensorReadings(device);
  return Object.keys(r).length > 0;
}

/* ─── Категории устройств (для группировки карточек) ─── */

export type DeviceCategoryKey =
  | "light"
  | "climate"
  | "control"
  | "openable"
  | "sensor"
  | "appliance"
  | "media"
  | "smart_meter"
  | "pet"
  | "other";

export const DEVICE_CATEGORIES: { key: DeviceCategoryKey; label: string }[] = [
  { key: "light", label: "Освещение" },
  { key: "climate", label: "Климат" },
  { key: "control", label: "Управление" },
  { key: "openable", label: "Открываемое" },
  { key: "sensor", label: "Датчики" },
  { key: "appliance", label: "Техника" },
  { key: "media", label: "Медиа" },
  { key: "smart_meter", label: "Счётчики" },
  { key: "pet", label: "Питомцы" },
  { key: "other", label: "Прочее" },
];

export function getDeviceCategory(device: Device): DeviceCategoryKey {
  const t = device.type;
  if (!t) return "other";
  if (t.startsWith("devices.types.light")) return "light";
  if (
    t.startsWith("devices.types.thermostat") ||
    t.startsWith("devices.types.humidifier") ||
    t.startsWith("devices.types.purifier") ||
    t.startsWith("devices.types.ventilation") ||
    t === "devices.types.cooking.hood"
  )
    return "climate";
  if (t.startsWith("devices.types.switch") || t.startsWith("devices.types.socket")) return "control";
  if (t.startsWith("devices.types.openable")) return "openable";
  if (t.startsWith("devices.types.sensor")) return "sensor";
  if (
    t.startsWith("devices.types.cooking") ||
    t.startsWith("devices.types.dishwasher") ||
    t.startsWith("devices.types.iron") ||
    t.startsWith("devices.types.vacuum_cleaner") ||
    t.startsWith("devices.types.washing_machine")
  )
    return "appliance";
  if (
    t.startsWith("devices.types.media_device") ||
    t.startsWith("devices.types.camera")
  )
    return "media";
  if (t.startsWith("devices.types.smart_meter")) return "smart_meter";
  if (t.startsWith("devices.types.pet_")) return "pet";
  // Устройства без on/off, но с данными свойств — датчики
  if (!hasToggle(device) && hasSensorReadings(device)) return "sensor";
  return "other";
}

export function getDeviceCategoryLabel(device: Device): string {
  const key = getDeviceCategory(device);
  return DEVICE_CATEGORIES.find((c) => c.key === key)?.label ?? "Прочее";
}

export type AcMode = "auto" | "cool" | "heat" | "dry" | "fan_only";

export const AC_MODE_LABELS: Record<AcMode, { emoji: string; label: string }> = {
  auto: { emoji: "🔄", label: "Авто" },
  cool: { emoji: "❄️", label: "Охлаждение" },
  heat: { emoji: "🔥", label: "Тепло" },
  dry: { emoji: "💧", label: "Осушение" },
  fan_only: { emoji: "🌬️", label: "Вентилятор" },
};

export function getAcMode(device: Device): AcMode | undefined {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "thermostat");
  return cap?.state?.value as AcMode | undefined;
}

export function getAcModeOptions(device: Device): AcMode[] {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "thermostat");
  return (cap?.parameters?.modes?.map((m: { value: string }) => m.value) ?? []) as AcMode[];
}

export function getAcTemperature(device: Device): { value?: number; min?: number; max?: number } {
  const cap = getDeviceCapability(device, "devices.capabilities.range", "temperature");
  if (!cap) return {};
  return {
    value: cap.state?.value as number | undefined,
    min: cap.parameters?.min_value as number | undefined,
    max: cap.parameters?.max_value as number | undefined,
  };
}

export function getAcFanSpeed(device: Device): { value?: number; min?: number; max?: number } {
  const cap = getDeviceCapability(device, "devices.capabilities.range", "fan_speed");
  if (!cap) return {};
  return {
    value: cap.state?.value as number | undefined,
    min: cap.parameters?.min_value as number | undefined,
    max: cap.parameters?.max_value as number | undefined,
  };
}

export function getAcSwing(device: Device): string | undefined {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "swing");
  return cap?.state?.value as string | undefined;
}

export function getAcSwingOptions(device: Device): string[] {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "swing");
  return (cap?.parameters?.modes?.map((m: { value: string }) => m.value) ?? []) as string[];
}

export function getAcNightMode(device: Device): boolean {
  const cap = getDeviceCapability(device, "devices.capabilities.toggle", "night_mode");
  return (cap?.state?.value as boolean) ?? false;
}
