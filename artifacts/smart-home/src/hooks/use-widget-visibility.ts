import { useState, useCallback, useEffect, useRef } from "react";
import { loadServerSetting, saveServerSetting } from "@/lib/server-settings";
import {
  WIDGET_DEFAULTS,
  WIDGET_META,
  type WidgetConfig,
  type WidgetType,
} from "./use-dashboard-layout";

const STORAGE_KEY = "widget_visibility_config_v1";

export interface WidgetEntry {
  visible: boolean;
  roomId: string | null;
  config: WidgetConfig;
}

export interface WidgetVisibilityConfig {
  widgets: Partial<Record<WidgetType, WidgetEntry>>;
}

const DEFAULT_CONFIG: WidgetVisibilityConfig = { widgets: {} };

function cloneDefaultConfig(type: WidgetType): WidgetConfig {
  return JSON.parse(JSON.stringify(WIDGET_DEFAULTS[type])) as WidgetConfig;
}

function defaultEntry(type: WidgetType): WidgetEntry {
  return { visible: false, roomId: null, config: cloneDefaultConfig(type) };
}

function normalizeConfig(raw: WidgetVisibilityConfig | null): WidgetVisibilityConfig {
  const widgets: Partial<Record<WidgetType, WidgetEntry>> = {};
  for (const type of Object.keys(WIDGET_META) as WidgetType[]) {
    const saved = raw?.widgets?.[type];
    if (!saved) continue;
    widgets[type] = {
      visible: saved.visible === true,
      roomId: saved.roomId ?? null,
      config: saved.config ?? cloneDefaultConfig(type),
    };
  }
  return { widgets };
}

function loadConfig(): WidgetVisibilityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: WidgetVisibilityConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("widget-visibility-changed"));
}

export function useWidgetVisibility() {
  const [config, setConfig] = useState<WidgetVisibilityConfig>(loadConfig);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadServerSetting<WidgetVisibilityConfig>(STORAGE_KEY).then((serverData) => {
      if (cancelled) return;
      if (serverData && Object.keys(serverData.widgets ?? {}).length > 0) {
        const merged = normalizeConfig(serverData);
        skipSaveRef.current = true;
        setConfig(merged);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {}
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          skipSaveRef.current = true;
          setConfig(normalizeConfig(JSON.parse(e.newValue)));
        } catch {}
      }
    };
    const handleCustom = () => {
      skipSaveRef.current = true;
      setConfig(loadConfig());
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("widget-visibility-changed", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("widget-visibility-changed", handleCustom);
    };
  }, []);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    if (!hydrated) return;
    const timeoutId = setTimeout(() => {
      saveServerSetting(STORAGE_KEY, config);
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [config, hydrated]);

  const getWidget = useCallback(
    (type: WidgetType): WidgetEntry => config.widgets[type] ?? defaultEntry(type),
    [config.widgets]
  );

  const isWidgetVisible = useCallback(
    (type: WidgetType): boolean => {
      const entry = config.widgets[type];
      return entry?.visible === true && !!entry.roomId;
    },
    [config.widgets]
  );

  const getWidgetsForRoom = useCallback(
    (roomId: string): { type: WidgetType; config: WidgetConfig }[] => {
      return (Object.keys(WIDGET_META) as WidgetType[])
        .map((type) => ({ type, entry: config.widgets[type] }))
        .filter(
          (item): item is { type: WidgetType; entry: WidgetEntry } =>
            item.entry?.visible === true && item.entry.roomId === roomId
        )
        .map(({ type, entry }) => ({ type, config: entry.config }));
    },
    [config.widgets]
  );

  const updateWidget = useCallback(
    (type: WidgetType, patch: Partial<WidgetEntry>) => {
      setConfig((prev) => {
        const current = prev.widgets[type] ?? defaultEntry(type);
        return {
          widgets: {
            ...prev.widgets,
            [type]: { ...current, ...patch },
          },
        };
      });
    },
    []
  );

  const setWidgetVisible = useCallback(
    (type: WidgetType, visible: boolean) => updateWidget(type, { visible }),
    [updateWidget]
  );

  const setWidgetRoom = useCallback(
    (type: WidgetType, roomId: string | null) => updateWidget(type, { roomId }),
    [updateWidget]
  );

  const setWidgetConfig = useCallback(
    (type: WidgetType, config: WidgetConfig) => updateWidget(type, { config }),
    [updateWidget]
  );

  return {
    getWidget,
    isWidgetVisible,
    getWidgetsForRoom,
    setWidgetVisible,
    setWidgetRoom,
    setWidgetConfig,
  };
}
