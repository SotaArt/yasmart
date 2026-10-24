/**
 * Хранилище инверсий показаний датчиков (по устройству и свойству).
 *
 * Событийные свойства Yandex (open/water_leak/motion/...) несут "последнее
 * событие", и у части датчиков полярность инвертирована относительно физики
 * (дверь закрыта, а API отдаёт open:true). Тут пользователь может вручную
 * инвертировать нужное свойство конкретного устройства.
 *
 * Хранилище модульное: и чистая функция getSensorReadings (lib/yandex.ts),
 * и React-хук читают одни и те же данные синхронно.
 */

const STORAGE_KEY = "sensor_inversions_v1";

export const INVERTIBLE_INSTANCES = ["open", "water_leak", "motion", "presence", "vibration", "smoke", "gas"] as const;
export type InvertibleInstance = (typeof INVERTIBLE_INSTANCES)[number];

/** deviceId -> instance -> invert */
type InversionConfig = Record<string, Partial<Record<InvertibleInstance, boolean>>>;

const EMPTY_SET = new Set<string>();

let config: InversionConfig = load();

function load(): InversionConfig {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
  window.dispatchEvent(new Event("sensor-inversions-changed"));
}

/** Набор инвертируемых экземпляров для устройства (пустой Set — если нет) */
export function getSensorInversions(deviceId: string): Set<string> {
  const rec = config[deviceId];
  if (!rec) return EMPTY_SET;
  const set = new Set<string>();
  for (const inst of INVERTIBLE_INSTANCES) {
    if (rec[inst]) set.add(inst);
  }
  return set.size > 0 ? set : EMPTY_SET;
}

export function isSensorInverted(deviceId: string, instance: InvertibleInstance): boolean {
  return config[deviceId]?.[instance] === true;
}

export function setSensorInversion(deviceId: string, instance: InvertibleInstance, invert: boolean) {
  const rec = { ...(config[deviceId] ?? {}) };
  if (invert) rec[instance] = true;
  else delete rec[instance];
  config = { ...config, [deviceId]: rec };
  persist();
}

/** Подписка на изменения (внутри вкладки + между вкладками) */
export function subscribeToInversions(cb: () => void): () => void {
  const handleCustom = () => cb();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      config = load();
      cb();
    }
  };
  window.addEventListener("sensor-inversions-changed", handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("sensor-inversions-changed", handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}