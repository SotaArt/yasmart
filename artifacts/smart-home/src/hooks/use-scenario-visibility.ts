import { useState, useCallback, useEffect, useRef } from "react";
import { loadServerSetting, saveServerSetting } from "@/lib/server-settings";

const STORAGE_KEY = "scenario_visibility_config_v1";

export interface ScenarioVisibilityConfig {
  /** scenarioId -> visible (по умолчанию false — скрыты) */
  scenarios: Record<string, boolean>;
  /** scenarioId -> массив roomId,[] = все комнаты */
  rooms: Record<string, string[]>;
}

const DEFAULT_CONFIG: ScenarioVisibilityConfig = {
  scenarios: {},
  rooms: {},
};

function loadConfig(): ScenarioVisibilityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    // Миграция: если rooms содержит строки — конвертируем в массивы
    if (parsed.rooms) {
      for (const key of Object.keys(parsed.rooms)) {
        if (typeof parsed.rooms[key] === "string") {
          parsed.rooms[key] = parsed.rooms[key] === "all" ? [] : [parsed.rooms[key]];
        }
      }
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: ScenarioVisibilityConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("scenario-visibility-changed"));
}

export function useScenarioVisibility() {
  const [config, setConfig] = useState<ScenarioVisibilityConfig>(loadConfig);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(false);

  // Загрузка с сервера при монтировании (приоритет над localStorage)
  useEffect(() => {
    let cancelled = false;
    loadServerSetting<ScenarioVisibilityConfig>(STORAGE_KEY).then((serverData) => {
      if (cancelled) return;
      if (serverData && (
        Object.keys(serverData.scenarios ?? {}).length > 0 ||
        Object.keys(serverData.rooms ?? {}).length > 0
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

  useEffect(() => {
    const handleCustom = () => {
      const fresh = loadConfig();
      skipSaveRef.current = true;
      setConfig(fresh);
    };
    window.addEventListener("scenario-visibility-changed", handleCustom);
    return () => window.removeEventListener("scenario-visibility-changed", handleCustom);
  }, []);

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

  const isScenarioVisible = useCallback(
    (scenarioId: string): boolean => config.scenarios[scenarioId] ?? false,
    [config.scenarios]
  );

  /** Получить список комнат сценария ([] = все комнаты) */
  const getScenarioRooms = useCallback(
    (scenarioId: string): string[] => config.rooms[scenarioId] ?? [],
    [config.rooms]
  );

  /** Проверить, виден ли сценарий в данной комнате */
  const isScenarioInRoom = useCallback(
    (scenarioId: string, roomId: string): boolean => {
      const rooms = config.rooms[scenarioId];
      // Пустой массив = все комнаты
      if (!rooms || rooms.length === 0) return true;
      return rooms.includes(roomId);
    },
    [config.rooms]
  );

  const setScenarioVisible = useCallback((scenarioId: string, visible: boolean) => {
    setConfig((prev) => ({
      ...prev,
      scenarios: { ...prev.scenarios, [scenarioId]: visible },
    }));
  }, []);

  /** Переключить комнату для сценария (toggle) */
  const toggleScenarioRoom = useCallback((scenarioId: string, roomId: string) => {
    setConfig((prev) => {
      const current = prev.rooms[scenarioId] ?? [];
      const next = current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId];
      return {
        ...prev,
        rooms: { ...prev.rooms, [scenarioId]: next },
      };
    });
  }, []);

  /** Установить "все комнаты" (пустой массив) */
  const setScenarioAllRooms = useCallback((scenarioId: string) => {
    setConfig((prev) => ({
      ...prev,
      rooms: { ...prev.rooms, [scenarioId]: [] },
    }));
  }, []);

  return {
    config,
    isScenarioVisible,
    getScenarioRooms,
    isScenarioInRoom,
    setScenarioVisible,
    toggleScenarioRoom,
    setScenarioAllRooms,
  };
}
