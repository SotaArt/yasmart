import { useState, useEffect, useCallback, useRef } from "react";
import { loadServerSetting, saveServerSetting } from "@/lib/server-settings";

export type TileSize = "1x1" | "2x1" | "1x2" | "2x2";

export interface TileConfig {
  id: string;
  size: TileSize;
  compact?: boolean;
  pinned: boolean;
  order: number;
  hidden: boolean;
}

export interface UserGroup {
  id: string;
  name: string;
  deviceIds: string[];
  icon?: string;
}

export interface Layout {
  id: string;
  name: string;
  icon: string;
  config: PanelConfig;
  roomOrder: RoomOrder;
  favorites: string[];
  groups: UserGroup[];
}

export interface QuickAction {
  id: string;
  name: string;
  icon: string;
  /** Scene ID to run (Yandex scenario) */
  sceneId?: string;
  /** Device actions to execute sequentially */
  actions?: { deviceId: string; instance: string; value: boolean | number }[];
}

export interface DeviceTimer {
  id: string;
  deviceId: string;
  deviceName: string;
  /** Action to perform: "on", "off", or custom action */
  action: "on" | "off";
  /** When to execute: timestamp */
  executeAt: number;
  /** Created timestamp */
  createdAt: number;
  /** Is timer active */
  active: boolean;
}

export type PanelConfig = Record<string, TileConfig>;
export type RoomOrder = Record<string, number>;

/** Снапшот всех состояний панели для серверного бэкапа */
export interface PanelConfigServerSnapshot {
  config?: PanelConfig;
  roomOrder?: RoomOrder;
  hiddenRooms?: Record<string, boolean>;
  groups?: UserGroup[];
  favorites?: string[];
  layouts?: Layout[];
  activeLayoutId?: string | null;
  quickActions?: QuickAction[];
  timers?: DeviceTimer[];
}

export function usePanelConfig(householdId?: string) {
  const tileKey      = householdId ? `panel_config_v3_${householdId}`  : "panel_config_v3";
  const roomKey      = householdId ? `room_order_v1_${householdId}`    : "room_order_v1";
  const roomHiddenKey = householdId ? `room_hidden_v1_${householdId}`  : "room_hidden_v1";
  const groupsKey    = householdId ? `user_groups_v1_${householdId}`   : "user_groups_v1";
  const favoritesKey = householdId ? `favorites_v1_${householdId}`     : "favorites_v1";
  const layoutsKey   = householdId ? `layouts_v1_${householdId}`       : "layouts_v1";
  const activeLayoutKey = householdId ? `active_layout_v1_${householdId}` : "active_layout_v1";
  const quickActionsKey = householdId ? `quick_actions_v1_${householdId}` : "quick_actions_v1";
  const timersKey = householdId ? `device_timers_v1_${householdId}` : "device_timers_v1";
  const serverKey = "panel_config_v3" + (householdId ? `_${householdId}` : "_default");

  const [config, setConfigState] = useState<PanelConfig>({});
  const [roomOrder, setRoomOrderState] = useState<RoomOrder>({});
  const [hiddenRooms, setHiddenRoomsState] = useState<Record<string, boolean>>({});
  const [groups, setGroupsState] = useState<UserGroup[]>([]);
  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [layouts, setLayoutsState] = useState<Layout[]>([]);
  const [activeLayoutId, setActiveLayoutIdState] = useState<string | null>(null);
  const [quickActions, setQuickActionsState] = useState<QuickAction[]>([]);
  const [timers, setTimersState] = useState<DeviceTimer[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const skipSaveRef = useRef(false);
  const touchedRef = useRef<Record<string, boolean>>({});
  const markTouched = useCallback((section: string) => {
    touchedRef.current[section] = true;
  }, []);

  // Загрузка: приоритет сервер → localStorage
  useEffect(() => {
    let cancelled = false;
    loadServerSetting<PanelConfigServerSnapshot>(serverKey).then((serverData) => {
      if (cancelled) return;
      const snap = serverData ?? null;
      const touched = touchedRef.current;
      if (snap && (Object.keys(snap).length > 0)) {
        if (snap.config && !touched.config) { setConfigState(snap.config); try { localStorage.setItem(tileKey, JSON.stringify(snap.config)); } catch {} }
        if (snap.roomOrder && !touched.roomOrder) { setRoomOrderState(snap.roomOrder); try { localStorage.setItem(roomKey, JSON.stringify(snap.roomOrder)); } catch {} }
        if (snap.hiddenRooms && !touched.hiddenRooms) { setHiddenRoomsState(snap.hiddenRooms); try { localStorage.setItem(roomHiddenKey, JSON.stringify(snap.hiddenRooms)); } catch {} }
        if (snap.groups && !touched.groups) { setGroupsState(snap.groups); try { localStorage.setItem(groupsKey, JSON.stringify(snap.groups)); } catch {} }
        if (snap.favorites && !touched.favorites) { setFavoritesState(snap.favorites); try { localStorage.setItem(favoritesKey, JSON.stringify(snap.favorites)); } catch {} }
        if (snap.layouts && !touched.layouts) { setLayoutsState(snap.layouts); try { localStorage.setItem(layoutsKey, JSON.stringify(snap.layouts)); } catch {} }
        if (snap.activeLayoutId !== undefined && !touched.activeLayoutId) { setActiveLayoutIdState(snap.activeLayoutId); try { localStorage.setItem(activeLayoutKey, JSON.stringify(snap.activeLayoutId)); } catch {} }
        if (snap.quickActions && !touched.quickActions) { setQuickActionsState(snap.quickActions); try { localStorage.setItem(quickActionsKey, JSON.stringify(snap.quickActions)); } catch {} }
        if (snap.timers && !touched.timers) { setTimersState(snap.timers); try { localStorage.setItem(timersKey, JSON.stringify(snap.timers)); } catch {} }
        if (Object.keys(touched).length === 0) skipSaveRef.current = true;
        setIsLoaded(true);
        return;
      }
      try {
        const saved = localStorage.getItem(tileKey);
        if (saved) setConfigState(JSON.parse(saved));
        const savedRooms = localStorage.getItem(roomKey);
        if (savedRooms) setRoomOrderState(JSON.parse(savedRooms));
        const savedHidden = localStorage.getItem(roomHiddenKey);
        if (savedHidden) setHiddenRoomsState(JSON.parse(savedHidden));
        const savedGroups = localStorage.getItem(groupsKey);
        if (savedGroups) setGroupsState(JSON.parse(savedGroups));
        const savedFavorites = localStorage.getItem(favoritesKey);
        if (savedFavorites) setFavoritesState(JSON.parse(savedFavorites));
        const savedLayouts = localStorage.getItem(layoutsKey);
        if (savedLayouts) setLayoutsState(JSON.parse(savedLayouts));
        const savedActiveLayout = localStorage.getItem(activeLayoutKey);
        if (savedActiveLayout) setActiveLayoutIdState(JSON.parse(savedActiveLayout));
        const savedQuickActions = localStorage.getItem(quickActionsKey);
        if (savedQuickActions) setQuickActionsState(JSON.parse(savedQuickActions));
        const savedTimers = localStorage.getItem(timersKey);
        if (savedTimers) setTimersState(JSON.parse(savedTimers));
      } catch {
        // ignore parse errors
      }
      setIsLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  // Сохранение на сервер при изменении (дебаунс, не трогая localStorage-сеттеры)
  useEffect(() => {
    if (!isLoaded || skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const snapshot: PanelConfigServerSnapshot = {
      config, roomOrder, hiddenRooms, groups, favorites,
      layouts, activeLayoutId, quickActions, timers,
    };
    const timeoutId = setTimeout(() => {
      saveServerSetting(serverKey, snapshot);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [isLoaded, config, roomOrder, hiddenRooms, groups, favorites, layouts, activeLayoutId, quickActions, timers, serverKey]);

  const setConfig = useCallback(
    (newConfig: PanelConfig | ((prev: PanelConfig) => PanelConfig)) => {
      markTouched("config");
      setConfigState((prev) => {
        const updated = typeof newConfig === "function" ? newConfig(prev) : newConfig;
        localStorage.setItem(tileKey, JSON.stringify(updated));
        return updated;
      });
    },
    [tileKey]
  );

  const initDeviceConfig = useCallback(
    (deviceId: string) => {
      setConfig((prev) => {
        if (prev[deviceId]) return prev;
        return {
          ...prev,
          [deviceId]: {
            id: deviceId,
            size: "1x1",
            pinned: false,
            order: Object.keys(prev).length,
            hidden: false,
          },
        };
      });
    },
    [setConfig]
  );

  const updateTileConfig = useCallback(
    (deviceId: string, updates: Partial<TileConfig>) => {
      setConfig((prev) => ({
        ...prev,
        [deviceId]: {
          ...(prev[deviceId] ?? {
            id: deviceId,
            size: "1x1",
            pinned: false,
            order: 0,
            hidden: false,
          }),
          ...updates,
        },
      }));
    },
    [setConfig]
  );

  const swapRoomOrder = useCallback(
    (roomIdA: string, roomIdB: string, allRoomIds: string[]) => {
      markTouched("roomOrder");
      setRoomOrderState((prev) => {
        const getOrder = (id: string) =>
          prev[id] !== undefined ? prev[id] : allRoomIds.indexOf(id);
        const newOrder: RoomOrder = {
          ...prev,
          [roomIdA]: getOrder(roomIdB),
          [roomIdB]: getOrder(roomIdA),
        };
        localStorage.setItem(roomKey, JSON.stringify(newOrder));
        return newOrder;
      });
    },
    [roomKey]
  );

  const toggleRoomHidden = useCallback(
    (roomId: string) => {
      markTouched("hiddenRooms");
      setHiddenRoomsState((prev) => {
        const next = { ...prev, [roomId]: !prev[roomId] };
        localStorage.setItem(roomHiddenKey, JSON.stringify(next));
        return next;
      });
    },
    [roomHiddenKey]
  );

  const setGroups = useCallback(
    (newGroups: UserGroup[] | ((prev: UserGroup[]) => UserGroup[])) => {
      markTouched("groups");
      setGroupsState((prev) => {
        const updated = typeof newGroups === "function" ? newGroups(prev) : newGroups;
        localStorage.setItem(groupsKey, JSON.stringify(updated));
        return updated;
      });
    },
    [groupsKey]
  );

  const createGroup = useCallback(
    (name: string, icon?: string) => {
      const id = `group_${Date.now()}`;
      setGroups((prev) => [
        ...prev,
        { id, name, deviceIds: [], icon: icon || "📁" },
      ]);
      return id;
    },
    [setGroups]
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name } : g))
      );
    },
    [setGroups]
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    },
    [setGroups]
  );

  const addDeviceToGroup = useCallback(
    (groupId: string, deviceId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId && !g.deviceIds.includes(deviceId)
            ? { ...g, deviceIds: [...g.deviceIds, deviceId] }
            : g
        )
      );
    },
    [setGroups]
  );

  const removeDeviceFromGroup = useCallback(
    (groupId: string, deviceId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, deviceIds: g.deviceIds.filter((id) => id !== deviceId) }
            : g
        )
      );
    },
    [setGroups]
  );

  const toggleDeviceInGroup = useCallback(
    (groupId: string, deviceId: string) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const hasDevice = g.deviceIds.includes(deviceId);
          return {
            ...g,
            deviceIds: hasDevice
              ? g.deviceIds.filter((id) => id !== deviceId)
              : [...g.deviceIds, deviceId],
          };
        })
      );
    },
    [setGroups]
  );

  const setFavorites = useCallback(
    (newFavorites: string[] | ((prev: string[]) => string[])) => {
      markTouched("favorites");
      setFavoritesState((prev) => {
        const updated = typeof newFavorites === "function" ? newFavorites(prev) : newFavorites;
        localStorage.setItem(favoritesKey, JSON.stringify(updated));
        return updated;
      });
    },
    [favoritesKey]
  );

  const toggleFavorite = useCallback(
    (deviceId: string) => {
      setFavorites((prev) =>
        prev.includes(deviceId)
          ? prev.filter((id) => id !== deviceId)
          : [...prev, deviceId]
      );
    },
    [setFavorites]
  );

  const isFavorite = useCallback(
    (deviceId: string) => favorites.includes(deviceId),
    [favorites]
  );

  const setLayouts = useCallback(
    (newLayouts: Layout[] | ((prev: Layout[]) => Layout[])) => {
      markTouched("layouts");
      setLayoutsState((prev) => {
        const updated = typeof newLayouts === "function" ? newLayouts(prev) : newLayouts;
        localStorage.setItem(layoutsKey, JSON.stringify(updated));
        return updated;
      });
    },
    [layoutsKey]
  );

  const setActiveLayoutId = useCallback(
    (layoutId: string | null) => {
      markTouched("activeLayoutId");
      setActiveLayoutIdState(layoutId);
      localStorage.setItem(activeLayoutKey, JSON.stringify(layoutId));
    },
    [activeLayoutKey]
  );

  const saveCurrentAsLayout = useCallback(
    (name: string, icon: string) => {
      const id = `layout_${Date.now()}`;
      const newLayout: Layout = {
        id,
        name,
        icon,
        config: { ...config },
        roomOrder: { ...roomOrder },
        favorites: [...favorites],
        groups: [...groups],
      };
      setLayouts((prev) => [...prev, newLayout]);
      return id;
    },
    [config, roomOrder, favorites, groups, setLayouts]
  );

  const loadLayout = useCallback(
    (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      if (!layout) return;
      markTouched("roomOrder");
      markTouched("favorites");
      markTouched("groups");
      setConfig(layout.config);
      setRoomOrderState(layout.roomOrder);
      setFavoritesState(layout.favorites);
      setGroupsState(layout.groups);
      setActiveLayoutId(layoutId);
    },
    [layouts, setConfig, setRoomOrderState, setFavoritesState, setGroupsState, setActiveLayoutId]
  );

  const setQuickActions = useCallback(
    (newActions: QuickAction[] | ((prev: QuickAction[]) => QuickAction[])) => {
      markTouched("quickActions");
      setQuickActionsState((prev) => {
        const updated = typeof newActions === "function" ? newActions(prev) : newActions;
        localStorage.setItem(quickActionsKey, JSON.stringify(updated));
        return updated;
      });
    },
    [quickActionsKey]
  );

  const createQuickAction = useCallback(
    (name: string, icon: string, opts?: { sceneId?: string; actions?: QuickAction["actions"] }) => {
      const id = `qa_${Date.now()}`;
      const qa: QuickAction = { id, name, icon, ...opts };
      setQuickActions((prev) => [...prev, qa]);
      return id;
    },
    [setQuickActions]
  );

  const deleteQuickAction = useCallback(
    (qaId: string) => {
      setQuickActions((prev) => prev.filter((q) => q.id !== qaId));
    },
    [setQuickActions]
  );

  const updateQuickAction = useCallback(
    (qaId: string, updates: Partial<Omit<QuickAction, "id">>) => {
      setQuickActions((prev) =>
        prev.map((q) => (q.id === qaId ? { ...q, ...updates } : q))
      );
    },
    [setQuickActions]
  );

  // Timer CRUD operations
  const setTimers = useCallback(
    (newTimers: DeviceTimer[] | ((prev: DeviceTimer[]) => DeviceTimer[])) => {
      markTouched("timers");
      setTimersState((prev) => {
        const updated = typeof newTimers === "function" ? newTimers(prev) : newTimers;
        localStorage.setItem(timersKey, JSON.stringify(updated));
        return updated;
      });
    },
    [timersKey]
  );

  const createTimer = useCallback(
    (deviceId: string, deviceName: string, action: "on" | "off", delayMs: number) => {
      const id = `timer_${Date.now()}`;
      const timer: DeviceTimer = {
        id,
        deviceId,
        deviceName,
        action,
        executeAt: Date.now() + delayMs,
        createdAt: Date.now(),
        active: true,
      };
      setTimers((prev) => [...prev.filter((t) => t.deviceId !== deviceId), timer]);
      return id;
    },
    [setTimers]
  );

  const cancelTimer = useCallback(
    (timerId: string) => {
      setTimers((prev) => prev.filter((t) => t.id !== timerId));
    },
    [setTimers]
  );

  const clearExpiredTimers = useCallback(() => {
    setTimers((prev) => prev.filter((t) => t.active && t.executeAt > Date.now()));
  }, [setTimers]);

  const getActiveTimers = useCallback(
    (deviceId?: string) => {
      const now = Date.now();
      return timers.filter(
        (t) => t.active && t.executeAt > now && (!deviceId || t.deviceId === deviceId)
      );
    },
    [timers]
  );

  const deleteLayout = useCallback(
    (layoutId: string) => {
      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));
      if (activeLayoutId === layoutId) {
        setActiveLayoutId(null);
      }
    },
    [setLayouts, activeLayoutId, setActiveLayoutId]
  );

  const updateLayout = useCallback(
    (layoutId: string) => {
      setLayouts((prev) =>
        prev.map((l) =>
          l.id === layoutId
            ? {
                ...l,
                config: { ...config },
                roomOrder: { ...roomOrder },
                favorites: [...favorites],
                groups: [...groups],
              }
            : l
        )
      );
    },
    [config, roomOrder, favorites, groups, setLayouts]
  );

  return {
    config,
    setConfig,
    initDeviceConfig,
    updateTileConfig,
    roomOrder,
    swapRoomOrder,
    hiddenRooms,
    toggleRoomHidden,
    groups,
    setGroups,
    createGroup,
    renameGroup,
    deleteGroup,
    addDeviceToGroup,
    removeDeviceFromGroup,
    toggleDeviceInGroup,
    favorites,
    toggleFavorite,
    isFavorite,
    layouts,
    activeLayoutId,
    saveCurrentAsLayout,
    loadLayout,
    deleteLayout,
    updateLayout,
    quickActions,
    setQuickActions,
    createQuickAction,
    deleteQuickAction,
    updateQuickAction,
    timers,
    setTimers,
    createTimer,
    cancelTimer,
    clearExpiredTimers,
    getActiveTimers,
    isLoaded,
  };
}
