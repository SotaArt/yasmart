import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserInfo,
  useControlDevice,
} from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { getUserInfoKey } from "@/lib/query-keys";
import { toast } from "@/hooks/use-toast";
import { usePanelConfig } from "@/hooks/use-panel-config";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { useSensorDevices } from "@/hooks/use-sensor-devices";
import { useScenarioVisibility } from "@/hooks/use-scenario-visibility";
import { useWidgetVisibility } from "@/hooks/use-widget-visibility";
import { usePanelPwa } from "@/hooks/use-panel-pwa";
import { getDeviceIcon } from "@/lib/yandex";
import { TokenForm } from "@/components/token-form";
import { WidgetRenderer } from "@/components/widgets";
import { Skeleton } from "@/components/ui/skeleton";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TimerManager } from "@/components/TimerManager";
import { QuickActionCard, SceneCard } from "@/components/smart-card";
import { DeviceGridCard } from "@/components/smart-card/DeviceGridCard";
import { matchDeviceToTemplate } from "@/lib/device-template-map";
import { Plus, X, ChevronLeft, ChevronRight, Wifi } from "lucide-react";

const DEVICE_ORDER_KEY = "eng_device_order_v1";

function loadDeviceOrder(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_ORDER_KEY) || "{}");
  } catch {
    return {};
  }
}
import { InfoPanel } from "./InfoPanel";
import { RoomTab } from "./RoomTab";

const FEATURED_DEVICE_KEY = "user_panel_featured_device_v1";

function getFeaturedDeviceId(roomId: string | null): string | null {
  if (!roomId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(FEATURED_DEVICE_KEY) || "{}");
    return typeof saved[roomId] === "string" ? saved[roomId] : null;
  } catch {
    return null;
  }
}

/* ─── Main User Panel ─── */
export default function UserPanel() {
  usePanelPwa("user");

  const params = useParams<{ householdId: string }>();
  const householdId = params.householdId;

  const { token, setToken, isLoaded } = useYandexToken();
  const {
    config, initDeviceConfig, updateTileConfig,
    groups, createGroup, deleteGroup, toggleDeviceInGroup,
    quickActions, deleteQuickAction,
    timers, createTimer, cancelTimer,
  } = usePanelConfig(householdId);
  const { filterDevices } = useDeviceVisibility();
  const { isRoomVisible } = useRoomVisibility();
  const { getRoomBackground } = useDashboardLayout();
  const { isSensorOnly } = useSensorDevices();
  const { isScenarioVisible, isScenarioInRoom } = useScenarioVisibility();
  const { getWidgetsForRoom, setWidgetConfig } = useWidgetVisibility();

  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });
  const queryClient = useQueryClient();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // ── Timer execution ──
  // Самодостаточный планировщик: пробуждается в момент ближайшего таймера
  // (не чаще 1/мин), исполняет просроченные и перепланирует следующие.
  const [timerTick, setTimerTick] = useState(0);
  const executingTimersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const due = timers.filter(
      (t) => t.active && t.executeAt <= Date.now() && !executingTimersRef.current.has(t.id)
    );
    if (due.length > 0) {
      due.forEach((timer) => {
        executingTimersRef.current.add(timer.id);
        controlDevice.mutate({
          deviceId: timer.deviceId,
          data: {
            actions: [
              {
                type: "devices.capabilities.on_off",
                state: { instance: "on", value: timer.action === "on" },
              },
            ],
          },
        }, {
          onSuccess: () => {
            executingTimersRef.current.delete(timer.id);
            cancelTimer(timer.id);
          },
          onError: () => {
            executingTimersRef.current.delete(timer.id);
            queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
            toast({ variant: "destructive", title: "Ошибка", description: `Не удалось выполнить таймер для устройства` });
          },
        });
      });
      return;
    }
    const upcoming = timers.filter((t) => t.active && t.executeAt > Date.now());
    if (upcoming.length === 0) return;
    const nextAt = Math.min(...upcoming.map((t) => t.executeAt));
    const id = setTimeout(
      () => setTimerTick((t) => t + 1),
      Math.min(60_000, Math.max(0, nextAt - Date.now()) + 100)
    );
    return () => clearTimeout(id);
  }, [timers, controlDevice, cancelTimer, timerTick]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const deviceOrder = useMemo(() => loadDeviceOrder(), []);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const roomBackground = activeRoomId ? getRoomBackground(activeRoomId) : null;

  const userInfoQuery = useGetUserInfo({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: {
      enabled: !!token,
      queryKey: getUserInfoKey(token),
      staleTime: 30_000,
      refetchInterval: 15_000,
    },
  });

  const userInfo = userInfoQuery.data;
  const scenarios = userInfo?.scenarios ?? [];

  const allRooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);
  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);

  const householdRooms = useMemo(
    () => allRooms.filter((r: any) => r.household_id === householdId),
    [allRooms, householdId]
  );

  // Fixed room order — priority by name
  const ROOM_PRIORITY: Record<string, number> = {
    "прихожая": 1, "коридор": 2, "кухня": 3, "гостиная": 4, "гостинная": 4,
    "спальня": 5, "детская": 6, "ванная": 7, "ванна": 7,
    "кладовка": 8, "сервис": 9,
    "балкон": 10, "туалет": 11, "прачечная": 12, "кабинет": 13, "дом": 14,
  };

  const sortedRooms = useMemo(() => {
    return [...householdRooms].sort((a, b) => {
      const pa = ROOM_PRIORITY[a.name.toLowerCase()] ?? 99;
      const pb = ROOM_PRIORITY[b.name.toLowerCase()] ?? 99;
      return pa - pb;
    });
  }, [householdRooms]);

  const visibleRooms = useMemo(
    () => sortedRooms.filter((r: any) => isRoomVisible(r.id)),
    [sortedRooms, isRoomVisible]
  );

  // Единый размер кнопок — по самому длинному названию
  const roomMinWidth = useMemo(() => {
    if (visibleRooms.length === 0) return undefined;
    const maxLen = Math.max(...visibleRooms.map((r: any) => r.name.length));
    return Math.ceil(maxLen * 9.5) + 40;
  }, [visibleRooms]);

  useEffect(() => {
    if (visibleRooms.length === 0) return;
    if (!activeRoomId || !visibleRooms.some((r: any) => r.id === activeRoomId)) {
      setActiveRoomId(visibleRooms[0].id);
    }
  }, [activeRoomId, visibleRooms]);

  const safeRoomIndex = useMemo(() => {
    if (!activeRoomId) return -1;
    const idx = visibleRooms.findIndex((r: any) => r.id === activeRoomId);
    return idx >= 0 ? idx : 0;
  }, [activeRoomId, visibleRooms]);
  const currentRoom = safeRoomIndex >= 0 ? visibleRooms[safeRoomIndex] ?? null : null;

  const roomDevices = useMemo(() => {
    let devices: any[];
    if (activeGroupId) {
      const group = groups.find((g) => g.id === activeGroupId);
      if (!group) return [];
      devices = allDevices.filter(
        (d: any) =>
          d.household_id === householdId &&
          group.deviceIds.includes(d.id)
      );
    } else if (!currentRoom) {
      return [];
    } else {
      devices = allDevices.filter(
        (d: any) =>
          d.household_id === householdId &&
          (currentRoom.devices?.includes(d.id) || d.room_id === currentRoom.id)
      );
    }
    return filterDevices(devices);
  }, [currentRoom, allDevices, householdId, activeGroupId, groups, filterDevices]);

  const roomDeviceIds = roomDevices.map((d: any) => d.id).join(",");
  useEffect(() => {
    roomDevices.forEach((d: any) => { if (!config[d.id]) initDeviceConfig(d.id); });
  }, [roomDeviceIds]);

  const goToPrevRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = visibleRooms.findIndex((r: any) => r.id === id) || 0;
      return visibleRooms[Math.max(0, idx - 1)]?.id ?? id;
    });
  }, [visibleRooms]);

  const goToNextRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = id ? visibleRooms.findIndex((r: any) => r.id === id) : 0;
      return visibleRooms[Math.min(visibleRooms.length - 1, idx + 1)]?.id ?? id;
    });
  }, [visibleRooms]);

  // Swipe detection
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const onWorkspaceTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }, []);

  const onWorkspaceTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = (swipeStartY.current === null ? 0 : e.changedTouches[0].clientY - swipeStartY.current);
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (dx < 0) {
      setActiveRoomId((id) => {
        const idx = id ? visibleRooms.findIndex((r: any) => r.id === id) : -1;
        if (idx < 0 || idx >= visibleRooms.length - 1) return id ?? visibleRooms[0]?.id;
        return visibleRooms[idx + 1].id;
      });
    } else {
      setActiveRoomId((id) => {
        if (!id) return id;
        const idx = visibleRooms.findIndex((r: any) => r.id === id);
        if (idx <= 0) return visibleRooms[0]?.id ?? id;
        return visibleRooms[idx - 1].id;
      });
    }
  }, [visibleRooms]);

  if (!isLoaded) return null;

  const totalDevices = allDevices.filter((d: any) => d.household_id === householdId).length;
  const onlineDevices = allDevices.filter(
    (d: any) => d.household_id === householdId && d.status === "online"
  ).length;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* Background image */}
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-gradient-to-b from-[#0a0c12] to-[#141821]"
        style={{
          backgroundImage: roomBackground
            ? `url(${roomBackground})`
            : `url(/background.jpg)`,
        }}
      />
      {/* Darken for readable content */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-background/90" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-6">
      {!token ? (
        <div className="p-4 flex-1">
          <TokenForm onSave={setToken} />
        </div>
      ) : (
        <>
          {/* Header: time, weather, sensors */}
          <div className="sticky top-0 z-30 border-b border-border/30">
            <InfoPanel roomDevices={roomDevices} allDevices={allDevices} />
          </div>

          {/* Room navigation — centered */}
          <div className="flex items-center gap-1 px-2 mb-3 justify-center">
            <button
              onClick={goToPrevRoom}
              disabled={safeRoomIndex <= 0}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex gap-2 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
              {visibleRooms.map((room: any) => (
                  <RoomTab
                    key={room.id}
                    room={room}
                    isActive={activeRoomId === room.id}
                    onClick={() => {
                      setActiveGroupId(null);
                      setActiveRoomId(room.id);
                    }}
                    minWidth={roomMinWidth}
                  />
              ))}
            </div>

            <button
              onClick={goToNextRoom}
              disabled={safeRoomIndex >= visibleRooms.length - 1}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Divider after room tabs */}
          <div className="mx-4 mt-2 mb-3 border-t border-border/30" />

          {/* User groups */}
          {groups.length > 0 && (
            <div className="flex items-center gap-2 px-3 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    if (activeGroupId === group.id) {
                      setActiveGroupId(null);
                    } else {
                      setActiveGroupId(group.id);
                      setActiveRoomId(null);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
                    activeGroupId === group.id
                      ? "border border-[hsl(var(--gold))] text-[hsl(var(--gold))] shadow-[0_0_12px_hsl(var(--gold-glow))]"
                      : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.name}</span>
                  <span className="text-[10px] text-muted-foreground">({group.deviceIds.length})</span>
                </button>
              ))}
              <button
                onClick={() => setShowGroupManager(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Группа</span>
              </button>
            </div>
          )}

          {/* Timer Manager */}
          {timers.length > 0 && (
            <div className="px-3 mb-3">
              <TimerManager
                timers={timers}
                onAddTimer={(deviceId, deviceName, action, delayMs) => {
                  createTimer(deviceId, deviceName, action, delayMs);
                }}
                onCancelTimer={cancelTimer}
              />
            </div>
          )}

          {/* Main content area — 3 adaptive rows */}
          <div
            className="px-3 flex-1 min-h-0 flex flex-col overflow-hidden"
            onTouchStart={onWorkspaceTouchStart}
            onTouchEnd={onWorkspaceTouchEnd}
          >
            {userInfoQuery.isLoading ? (
              <div className="flex-1 min-h-0 grid grid-rows-3 gap-2">
                <Skeleton className="row-span-2 rounded-lg" />
                <Skeleton className="rounded-lg" />
              </div>
            ) : (
              (() => {
                const featuredDeviceId = getFeaturedDeviceId(activeRoomId);
                const orderList = activeRoomId ? deviceOrder[activeRoomId] || [] : [];
                const orderMap = new Map(orderList.map((id, idx) => [id, idx]));
                const cardDevices = roomDevices
                  .filter(
                    (d: any) =>
                      !isSensorOnly(d.id) &&
                      !matchDeviceToTemplate(d)?.startsWith("sensor-")
                  )
                  .sort((a: any, b: any) => {
                    const af = Number(b.id === featuredDeviceId) - Number(a.id === featuredDeviceId);
                    if (af !== 0) return af;
                    const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
                    const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
                    if (ai !== bi) return ai - bi;
                    return 0;
                  });

                const visibleScenarios = !activeGroupId && currentRoom
                  ? scenarios.filter(
                      (sc: any) =>
                        isScenarioVisible(sc.id) &&
                        isScenarioInRoom(sc.id, currentRoom.id)
                    )
                  : [];

                const visibleWidgets = !activeGroupId && currentRoom
                  ? getWidgetsForRoom(currentRoom.id)
                  : [];

                const bottomItemsCount =
                  quickActions.length + visibleScenarios.length + visibleWidgets.length;

                if (cardDevices.length === 0 && bottomItemsCount === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                      <p className="text-sm">Нет видимых элементов</p>
                      <p className="text-xs mt-1">
                        Включите устройства, сценарии или виджеты в инженерной панели
                      </p>
                    </div>
                  );
                }

                const deviceRows = [
                  cardDevices.slice(0, 6),
                  cardDevices.slice(6),
                ];

                return (
                  <div className="flex-1 min-h-0 grid grid-rows-3 gap-2">
                    {/* Первые две строки — оборудование */}
                    <section className="row-span-2 min-h-0 flex flex-col gap-2">
                      {deviceRows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 auto-rows-fr gap-2 overflow-y-auto"
                        >
                          {row.map((device: any) => (
                            <div
                              key={device.id}
                              className="min-w-0 h-full rounded-lg overflow-hidden"
                            >
                              <DeviceGridCard
                                device={device}
                                token={token ?? ""}
                                size="standard"
                                timers={timers}
                                onAddTimer={createTimer}
                                onCancelTimer={cancelTimer}
                                tileConfig={config[device.id]}
                                onPin={() =>
                                  updateTileConfig(device.id, {
                                    pinned: !config[device.id]?.pinned,
                                  })
                                }
                                onDelete={
                                  activeGroupId
                                    ? () => toggleDeviceInGroup(activeGroupId, device.id)
                                    : undefined
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                      {cardDevices.length === 0 && (
                        <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground">
                          Нет устройств в этой комнате
                        </div>
                      )}
                    </section>

                    {/* Третья строка — быстрые действия, сценарии и виджеты */}
                    <section className="row-span-1 min-h-0 flex gap-2">
                      {quickActions.map((qa) => (
                        <div
                          key={`quick-${qa.id}`}
                          className="min-w-0 h-full flex-1 rounded-lg overflow-hidden"
                        >
                          <QuickActionCard
                            quickAction={qa}
                            token={token ?? ""}
                            size="standard"
                            onDelete={() => deleteQuickAction(qa.id)}
                          />
                        </div>
                      ))}
                      {visibleScenarios.map((scenario: any) => (
                        <div
                          key={`scenario-${scenario.id}`}
                          className="min-w-0 h-full flex-1 rounded-lg overflow-hidden"
                        >
                          <SceneCard
                            scenario={{ id: scenario.id, name: scenario.name }}
                            token={token ?? ""}
                            size="standard"
                          />
                        </div>
                      ))}
                      {visibleWidgets.map(({ type, config: widgetConfig }) => (
                        <div
                          key={`widget-${type}`}
                          className="min-w-0 h-full flex-1 rounded-lg overflow-hidden"
                        >
                          <WidgetRenderer
                            config={widgetConfig}
                            onChange={(nextConfig) => setWidgetConfig(type, nextConfig)}
                          />
                        </div>
                      ))}
                      {bottomItemsCount === 0 && (
                        <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground">
                          Включите сценарии или виджеты в инженерной панели
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()
            )}
          </div>

          {/* ── Bottom Status Tray ── */}
          <div className="sticky bottom-0 z-20 px-4 py-2 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground">
            {/* Devices + room */}
            <span className="flex items-center gap-1 shrink-0">
              <Wifi className="w-3 h-3" />
              {onlineDevices}/{totalDevices}
            </span>
            {activeRoomId && currentRoom && (
              <span className="text-foreground font-medium shrink-0">{currentRoom.name}</span>
            )}

            <span className="w-px h-3 bg-border/50 shrink-0" />

            {/* System messages */}
            {userInfoQuery.isError && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(0,72%,51%)] animate-pulse" />
                <span className="text-[hsl(0,72%,51%)]">Нет соединения</span>
              </span>
            )}
            {!userInfoQuery.isError && userInfoQuery.isLoading && token && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(38,95%,64%)] animate-pulse" />
                <span className="text-[hsl(38,95%,64%)]">Синхронизация…</span>
              </span>
            )}
            {!userInfoQuery.isError && !userInfoQuery.isLoading && userInfo && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142,70%,45%)]" />
                <span className="text-[hsl(142,70%,45%)]">Онлайн</span>
              </span>
            )}
          </div>
        </>
      )}
      </div>

      {/* Group Manager */}
      <Sheet open={showGroupManager} onOpenChange={setShowGroupManager}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Группы</SheetTitle>
            <SheetDescription>Создайте и настройте группы устройств</SheetDescription>
          </SheetHeader>
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              id="new-group-name"
              placeholder="Название группы"
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => {
                const input = document.getElementById("new-group-name") as HTMLInputElement;
                if (input?.value.trim()) {
                  createGroup(input.value.trim());
                  input.value = "";
                }
              }}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Создать
            </button>
          </div>
          <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет групп. Создайте группу для организации устройств.
              </p>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-background border border-border"
                >
                  <div className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-[10px] text-muted-foreground">({group.deviceIds.length})</span>
                  </div>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          {groups.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Добавить устройство в группу:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {allDevices
                  .filter((d: any) => d.household_id === householdId)
                  .map((device: any) => (
                    <div key={device.id} className="flex items-center gap-2 text-sm">
                      <span className="flex items-center justify-center w-5 h-5">
                        {(() => {
                          const icon = getDeviceIcon(device.type, device.id);
                          return icon.startsWith("data:") ? <img src={icon} alt="" className="w-4 h-4 object-contain" /> : <span className="text-base leading-none">{icon}</span>;
                        })()}
                      </span>
                      <span className="flex-1 truncate">{device.name}</span>
                      <select
                        className="text-xs px-2 py-1 rounded bg-background border border-border"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleDeviceInGroup(e.target.value, device.id);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">+</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.deviceIds.includes(device.id) ? "− " : ""}{g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
