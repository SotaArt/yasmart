import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "pinned_sensor_devices_v1";

export interface PinnedSensorConfig {
  /** deviceId -> { icon?: string } (переопределение иконки; пусто — стандартная по типу) */
  devices: Record<string, { icon?: string }>;
}

const DEFAULT_CONFIG: PinnedSensorConfig = { devices: {} };

function loadConfig(): PinnedSensorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: PinnedSensorConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("pinned-sensors-changed"));
}

/** Сериализованный config — для панелей-не-компонентов (например, чтобы прокинуть в другой таб без хука) */
export function loadPinnedSensorsConfig(): PinnedSensorConfig {
  return loadConfig();
}

/** Список id закреплённых датчиков — без реактивности, для вычислений вне компонента */
export function getPinnedSensorIds(): string[] {
  return Object.keys(loadConfig().devices);
}

/** Иконка-переопределение закреплённого датчика (emoji) или undefined */
export function getPinnedSensorIcon(deviceId: string): string | undefined {
  return loadConfig().devices[deviceId]?.icon;
}

export function isPinnedSensor(deviceId: string): boolean {
  const cfg = loadConfig();
  return Object.prototype.hasOwnProperty.call(cfg.devices, deviceId);
}

export function usePinnedSensors() {
  const [, setConfig] = useState<PinnedSensorConfig>(loadConfig);
  const skipSaveRef = useRef(false);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          skipSaveRef.current = true;
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(e.newValue) });
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleCustom = () => {
      skipSaveRef.current = true;
      setConfig(loadConfig());
    };
    window.addEventListener("pinned-sensors-changed", handleCustom);
    return () => window.removeEventListener("pinned-sensors-changed", handleCustom);
  }, []);

  const save = useCallback((cfg: PinnedSensorConfig) => {
    saveConfig(cfg);
  }, []);

  const setPinned = useCallback((deviceId: string, pinned: boolean, icon?: string) => {
    setConfig((prev) => {
      const devices = { ...prev.devices };
      if (pinned) devices[deviceId] = { icon: icon ?? devices[deviceId]?.icon };
      else delete devices[deviceId];
      save({ devices });
      return { devices };
    });
  }, [save]);

  const setPinnedIcon = useCallback((deviceId: string, icon: string) => {
    setConfig((prev) => {
      const prevDev = prev.devices[deviceId] ?? {};
      const devices = { ...prev.devices, [deviceId]: { ...prevDev, icon } };
      save({ devices });
      return { devices };
    });
  }, [save]);

  return { isPinnedSensor, setPinned, setPinnedIcon, getPinnedSensorIcon, getPinnedSensorIds };
}
