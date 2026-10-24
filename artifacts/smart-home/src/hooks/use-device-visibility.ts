import { useState, useCallback, useEffect, useRef } from "react";
import { loadServerSetting, saveServerSetting } from "@/lib/server-settings";
import type { Device } from "@/lib/yandex";

const STORAGE_KEY = "device_visibility_config_v1";

export interface DeviceVisibilityConfig {
  // Видимость устройств в юзер-панели (true = видно)
  devices: Record<string, boolean>;
  // Видимость конкретных функций устройства (deviceId -> capType -> visible)
  deviceCapabilities: Record<string, Record<string, boolean>>;
  // Видимость категорий (categoryId -> visible)
  categories: Record<string, boolean>;
}

const DEFAULT_CONFIG: DeviceVisibilityConfig = {
  devices: {},
  deviceCapabilities: {},
  categories: {},
};

function loadConfig(): DeviceVisibilityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: DeviceVisibilityConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Уведомить другие компоненты в той же вкладке
  window.dispatchEvent(new Event("device-visibility-changed"));
}

export function useDeviceVisibility() {
  const [config, setConfig] = useState<DeviceVisibilityConfig>(loadConfig);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(false);

  // Загрузка с сервера при монтировании (приоритет над localStorage)
  useEffect(() => {
    let cancelled = false;
    loadServerSetting<DeviceVisibilityConfig>(STORAGE_KEY).then((serverData) => {
      if (cancelled) return;
      if (serverData && (
        Object.keys(serverData.devices ?? {}).length > 0 ||
        Object.keys(serverData.deviceCapabilities ?? {}).length > 0 ||
        Object.keys(serverData.categories ?? {}).length > 0
      )) {
        const merged = { ...DEFAULT_CONFIG, ...serverData };
        skipSaveRef.current = true;
        setConfig(merged);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Синхронизация между вкладками через storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(e.newValue) };
          skipSaveRef.current = true;
          setConfig(parsed);
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Синхронизация в той же вкладке через кастомный event
  useEffect(() => {
    const handleCustom = () => {
      const fresh = loadConfig();
      skipSaveRef.current = true;
      setConfig(fresh);
    };
    window.addEventListener("device-visibility-changed", handleCustom);
    return () => window.removeEventListener("device-visibility-changed", handleCustom);
  }, []);

  // Сохранять в localStorage только при реальных изменениях
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveConfig(config);
  }, [config]);

  // Сохранение на сервер при изменении (дебаунс, после гидрации)
  useEffect(() => {
    if (!hydrated) return;
    const timeoutId = setTimeout(() => {
      saveServerSetting(STORAGE_KEY, config);
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [config, hydrated]);

  // Проверить видимость устройства
  const isDeviceVisible = useCallback((deviceId: string): boolean => {
    // По умолчанию все устройства видны
    return config.devices[deviceId] ?? true;
  }, [config.devices]);

  // Проверить видимость категории
  const isCategoryVisible = useCallback((categoryId: string): boolean => {
    // По умолчанию все категории видны
    return config.categories[categoryId] ?? true;
  }, [config.categories]);

  // Проверить видимость конкретной функции устройства
  const isCapabilityVisible = useCallback((deviceId: string, capType: string): boolean => {
    // По умолчанию все функции видны
    return config.deviceCapabilities[deviceId]?.[capType] ?? true;
  }, [config.deviceCapabilities]);

  // Установить видимость устройства
  const setDeviceVisible = useCallback((deviceId: string, visible: boolean) => {
    setConfig((prev) => ({
      ...prev,
      devices: { ...prev.devices, [deviceId]: visible },
    }));
  }, []);

  // Установить видимость категории
  const setCategoryVisible = useCallback((categoryId: string, visible: boolean) => {
    setConfig((prev) => ({
      ...prev,
      categories: { ...prev.categories, [categoryId]: visible },
    }));
  }, []);

  // Установить видимость функции устройства
  const setCapabilityVisible = useCallback((deviceId: string, capType: string, visible: boolean) => {
    setConfig((prev) => ({
      ...prev,
      deviceCapabilities: {
        ...prev.deviceCapabilities,
        [deviceId]: {
          ...(prev.deviceCapabilities[deviceId] ?? {}),
          [capType]: visible,
        },
      },
    }));
  }, []);

  // Сбросить конфигурацию
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  // Фильтровать устройства согласно конфигу
  const filterDevices = useCallback((devices: Device[]): Device[] => {
    return devices.filter((d) => isDeviceVisible(d.id));
  }, [isDeviceVisible]);

  // Получить видимые функции устройства
  const getVisibleCapabilities = useCallback((device: Device): string[] => {
    const caps = device.capabilities ?? [];
    return caps
      .filter((c) => {
        const capType = c.type.split(".").pop() ?? "";
        return isCapabilityVisible(device.id, capType);
      })
      .map((c) => c.type);
  }, [isCapabilityVisible]);

  return {
    config,
    isDeviceVisible,
    isCategoryVisible,
    isCapabilityVisible,
    setDeviceVisible,
    setCategoryVisible,
    setCapabilityVisible,
    resetConfig,
    filterDevices,
    getVisibleCapabilities,
  };
}
