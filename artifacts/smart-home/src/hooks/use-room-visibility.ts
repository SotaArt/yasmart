import { useState, useCallback, useEffect, useRef } from "react";
import { loadServerSetting, saveServerSetting } from "@/lib/server-settings";

const STORAGE_KEY = "room_visibility_v1";

export interface RoomVisibilityConfig {
  /** roomId -> visible (по умолчанию true — все видны) */
  rooms: Record<string, boolean>;
}

const DEFAULT_CONFIG: RoomVisibilityConfig = { rooms: {} };

function loadConfig(): RoomVisibilityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: RoomVisibilityConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("room-visibility-changed"));
}

export function useRoomVisibility() {
  const [config, setConfig] = useState<RoomVisibilityConfig>(loadConfig);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(false);

  // Загрузка с сервера при монтировании (приоритет над localStorage)
  useEffect(() => {
    let cancelled = false;
    loadServerSetting<RoomVisibilityConfig>(STORAGE_KEY).then((serverData) => {
      if (cancelled) return;
      if (serverData && Object.keys(serverData.rooms ?? {}).length > 0) {
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
    window.addEventListener("room-visibility-changed", handleCustom);
    return () => window.removeEventListener("room-visibility-changed", handleCustom);
  }, []);

  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
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

  /** По умолчанию все комнаты видны */
  const isRoomVisible = useCallback(
    (roomId: string): boolean => config.rooms[roomId] ?? true,
    [config.rooms]
  );

  const setRoomVisible = useCallback((roomId: string, visible: boolean) => {
    setConfig((prev) => ({
      ...prev,
      rooms: { ...prev.rooms, [roomId]: visible },
    }));
  }, []);

  return { isRoomVisible, setRoomVisible };
}
