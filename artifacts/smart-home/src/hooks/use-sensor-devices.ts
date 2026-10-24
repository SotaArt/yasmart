import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "sensor_only_devices_v1";

export interface SensorDeviceConfig {
  /** deviceId -> true (только датчик, не показывать в сетке) */
  devices: Record<string, boolean>;
}

const DEFAULT_CONFIG: SensorDeviceConfig = { devices: {} };

function loadConfig(): SensorDeviceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: SensorDeviceConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("sensor-devices-changed"));
}

export function useSensorDevices() {
  const [config, setConfig] = useState<SensorDeviceConfig>(loadConfig);
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
    window.addEventListener("sensor-devices-changed", handleCustom);
    return () => window.removeEventListener("sensor-devices-changed", handleCustom);
  }, []);

  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    saveConfig(config);
  }, [config]);

  const isSensorOnly = useCallback(
    (deviceId: string): boolean => config.devices[deviceId] ?? false,
    [config.devices]
  );

  const setSensorOnly = useCallback((deviceId: string, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      devices: { ...prev.devices, [deviceId]: value },
    }));
  }, []);

  return { isSensorOnly, setSensorOnly };
}
