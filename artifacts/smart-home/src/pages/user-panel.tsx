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
import { usePanelConfig, type TileSize } from "@/hooks/use-panel-config";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
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
import { InfoPanel } from "./InfoPanel";
import { RoomTab } from "./RoomTab";

/* ─── Main User Panel ─── */
export default function UserPanel() {
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
  const { getRoomCells, setCell, clearCell, getGridSize, getRoomBackground } = useDashboardLayout();

  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });
  const queryClient = useQueryClient();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const gridSize = getGridSize(activeRoomId ?? undefined);

  // Высота ячейки сетки ЮП (по фактическому размеру контейнера)
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [rowHeight, setRowHeight] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const compute = () => {
      const innerH = el.clientHeight - 8;
      const rowH = (innerH - 12 * (gridSize.rows - 1)) / gridSize.rows;
      setRowHeight(rowH > 0 ? rowH : 0);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridSize.rows, activeRoomId]);
  const compact = rowHeight > 0 && rowHeight < 140;

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
  const gridContainerRef = useRef<HTMLDivElement>(null);

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
                    onClick={() => setActiveRoomId(room.id)}
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

          {/* Main content area */}
          <div
            ref={gridContainerRef}
            className="px-3 flex-1 flex flex-col overflow-hidden pb-14"
            onTouchStart={onWorkspaceTouchStart}
            onTouchEnd={onWorkspaceTouchEnd}
          >
            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-1">Быстрые действия</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 auto-rows-[120px]">
                  {quickActions.map((qa) => (
                    <QuickActionCard
                      key={qa.id}
                      quickAction={qa}
                      token={token ?? ""}
                      size="standard"
                      onDelete={() => deleteQuickAction(qa.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {userInfoQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {/* ── Grid from ИП "Сетка" layout ── */}
                {(() => {
                  // Группа: рендерим устройства группы сеткой-плиткой
                  if (activeGroupId) {
                    const cols = Math.max(2, gridSize.cols);
                    return (
                      <div className="relative flex-1 flex flex-col min-h-0">
                        <div className="flex-1 min-h-0 overflow-y-auto p-1">
                          <div
                            className="grid gap-3"
                            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                          >
                            {roomDevices.map((device: any) => (
                              <div
                                key={device.id}
                                className="h-44 min-h-0 min-w-0 rounded-lg overflow-hidden"
                              >
                                <DeviceGridCard
                                  device={device}
                                  token={token ?? ""}
                                  size="standard"
                                  timers={timers}
                                  onAddTimer={createTimer}
                                  onCancelTimer={cancelTimer}
                                  tileConfig={config[device.id]}
                                  onPin={() => updateTileConfig(device.id, { pinned: !config[device.id]?.pinned })}
                                  onDelete={activeGroupId ? () => toggleDeviceInGroup(activeGroupId, device.id) : undefined}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const cells = activeRoomId ? getRoomCells(activeRoomId) : {};
                  const hasLayout = Object.keys(cells).length > 0;

                  if (!hasLayout) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-sm">Сетка не настроена</p>
                        <p className="text-xs mt-1">Перейдите в ИП → Сетка, чтобы расставить карточки</p>
                      </div>
                    );
                  }

                  return (
                    <div className="relative flex-1 flex flex-col min-h-0">
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <div
                          ref={gridRef}
                          className="h-full p-1 overflow-hidden"
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${gridSize.rows}, minmax(0, 1fr))`,
                            gap: "12px",
                          }}
                        >
                          {Object.entries(cells).map(([key, cell]) => {
                            const [col, row] = key.split(",").map(Number);
                            const spanCols = cell.spanCols ?? 1;
                            const spanRows = cell.spanRows ?? 1;

                            // Вычисляем CSS grid позицию (1-based)
                            const gridColumn = `${col + 1} / span ${spanCols}`;
                            const gridRow = `${row + 1} / span ${spanRows}`;

                            // Device card
                            if (cell.deviceId) {
                              const device = allDevices.find((d: any) => d.id === cell.deviceId);
                              if (!device) return null;

                              const tileConf = config[device.id];
                              const handlePin = () => updateTileConfig(device.id, { pinned: !tileConf?.pinned });
                              const handleResize = (size: TileSize) => {
                                const span: { spanCols?: number; spanRows?: number } =
                                  size === "2x1" ? { spanCols: 2, spanRows: 1 } :
                                  size === "1x2" ? { spanCols: 1, spanRows: 2 } :
                                  size === "2x2" ? { spanCols: 2, spanRows: 2 } :
                                  {};
                                const next: Record<string, number> = {};
                                if (span.spanCols != null) next.spanCols = Math.max(1, Math.min(span.spanCols, gridSize.cols - col));
                                if (span.spanRows != null) next.spanRows = Math.max(1, Math.min(span.spanRows, gridSize.rows - row));
                                setCell(activeRoomId!, col, row, { ...cell, ...next });
                              };
                              const handleDelete = () => clearCell(activeRoomId!, col, row);

                              return (
                                <div
                                  key={key}
                                  className="relative min-h-0 min-w-0 h-full w-full rounded-lg overflow-hidden"
                                  style={{
                                    gridColumn,
                                    gridRow,
                                  }}
                                >
                                  <DeviceGridCard
                                    key={device.id}
                                    device={device}
                                    token={token ?? ""}
                                    size={compact && matchDeviceToTemplate(device) !== "ac" && spanCols === 1 && spanRows === 1 ? "compact" : spanCols > 1 || spanRows > 1 ? (spanCols >= 2 && spanRows >= 2 ? "full" : "expanded") : "standard"}
                                    timers={timers}
                                    onAddTimer={createTimer}
                                    onCancelTimer={cancelTimer}
                                    hiddenParts={(cell as any).hiddenParts as any}
                                    tileConfig={tileConf}
                                    onPin={handlePin}
                                    onResize={handleResize}
                                    onDelete={handleDelete}
                                  />
                                </div>
                              );
                            }

                            // Scenario card
                            if (cell.scenarioId) {
                              const scenario = scenarios.find((sc: any) => sc.id === cell.scenarioId);
                              if (!scenario) return null;
                              return (
                                <div
                                  key={key}
                                  className="min-h-0 h-full w-full rounded-lg"
                                  style={{
                                    gridColumn,
                                    gridRow,
                                  }}
                                >
                                  <SceneCard
                                    scenario={{
                                      id: (scenario as any).id,
                                      name: (scenario as any).name,
                                    }}
                                    token={token ?? ""}
                                    size="standard"
                                  />
                                </div>
                              );
                            }

                            // Widget
                            if (cell.widget) {
                              return (
                                <div
                                  key={key}
                                  className="min-h-0 h-full w-full rounded-lg"
                                  style={{
                                    gridColumn,
                                    gridRow,
                                  }}
                                >
                                  <WidgetRenderer
                                    config={cell.widget}
                                    onChange={(newConfig) => {
                                      setCell(activeRoomId!, col, row, { ...cell, widget: newConfig });
                                    }}
                                  />
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
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
                      <span>{getDeviceIcon(device.type)}</span>
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
