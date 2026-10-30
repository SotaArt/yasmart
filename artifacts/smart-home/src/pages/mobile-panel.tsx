import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice, useGetUserInfo } from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { getUserInfoKey } from "@/lib/query-keys";
import { toast } from "@/hooks/use-toast";
import { usePanelConfig } from "@/hooks/use-panel-config";
import {
  sortRooms,
  type Device,
  type Room,
} from "@/lib/yandex";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useSensorDevices } from "@/hooks/use-sensor-devices";
import { usePanelPwa } from "@/hooks/use-panel-pwa";
import { matchDeviceToTemplate } from "@/lib/device-template-map";
import { TokenForm } from "@/components/token-form";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeader } from "./mobile/MobileHeader";
import { DeviceGridCard } from "@/components/smart-card/DeviceGridCard";
import { ChevronLeft, ChevronRight, Wifi } from "lucide-react";

const DEVICE_ORDER_KEY = "eng_device_order_v1";

function loadDeviceOrder(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_ORDER_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function MobilePanel() {
  usePanelPwa("mobile");

  const params = useParams<{ householdId: string }>();
  const householdId = params.householdId;

  const { token, setToken, isLoaded } = useYandexToken();
  const { filterDevices } = useDeviceVisibility();
  const { isRoomVisible } = useRoomVisibility();
  const { isSensorOnly } = useSensorDevices();
  const {
    config, initDeviceConfig, updateTileConfig,
    timers, createTimer, cancelTimer,
  } = usePanelConfig(householdId);

  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });
  const queryClient = useQueryClient();

  // ── Timer execution (same behaviour as ЮП) ──
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
  }, [timers, controlDevice, cancelTimer, timerTick, queryClient, token]);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const roomChipRefs = useRef(new Map<string, HTMLButtonElement | null>());

  // Активный чип комнаты всегда в зоне видимости строки
  useEffect(() => {
    const el = roomChipRefs.current.get(activeRoomId ?? "");
    if (el) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeRoomId]);

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
  const allRooms = useMemo(() => (userInfo?.rooms as any[]) ?? [], [userInfo]);
  const allDevices = useMemo(() => (userInfo?.devices as any[]) ?? [], [userInfo]);
  const deviceOrder = useMemo(() => loadDeviceOrder(), []);

  const householdRooms = useMemo(
    () => allRooms.filter((r: any) => r.household_id === householdId),
    [allRooms, householdId]
  );

  const sortedRooms = useMemo(() => sortRooms(householdRooms as Room[]), [householdRooms]);
  const visibleRooms = useMemo(
    () => sortedRooms.filter((r: any) => isRoomVisible(r.id)),
    [sortedRooms, isRoomVisible]
  );

  useEffect(() => {
    if (visibleRooms.length === 0) return;
    if (!activeRoomId || !visibleRooms.some((r: any) => r.id === activeRoomId)) {
      setActiveRoomId(visibleRooms[0].id);
    }
  }, [activeRoomId, visibleRooms]);

  const currentRoom = useMemo(
    () => visibleRooms.find((r: any) => r.id === activeRoomId) ?? null,
    [visibleRooms, activeRoomId]
  );

  const roomDevices = useMemo(() => {
    if (!currentRoom) return [];
    const inRoom = allDevices.filter(
      (d: any) =>
        d.household_id === householdId &&
        (currentRoom.devices?.includes(d.id) || d.room_id === currentRoom.id)
    );
    return filterDevices(inRoom as Device[]);
  }, [currentRoom, allDevices, householdId, filterDevices]);

  // Те же карточки, что и в ЮП: без датчиков, в порядке из инженерной панели.
  const cardDevices = useMemo(() => {
    const orderList = currentRoom?.id ? deviceOrder[currentRoom.id] || [] : [];
    const orderMap = new Map(orderList.map((id, idx) => [id, idx]));
    return roomDevices
      .filter(
        (d) =>
          !isSensorOnly(d.id) &&
          !matchDeviceToTemplate(d)?.startsWith("sensor-")
      )
      .sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
  }, [roomDevices, currentRoom?.id, deviceOrder, isSensorOnly]);

  const roomDeviceIds = cardDevices.map((d) => d.id).join(",");
  useEffect(() => {
    cardDevices.forEach((d) => { if (!config[d.id]) initDeviceConfig(d.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomDeviceIds]);

  const goToPrevRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = visibleRooms.findIndex((r: any) => r.id === id);
      const next = idx > 0 ? visibleRooms[idx - 1] : visibleRooms[0];
      return next?.id ?? id;
    });
  }, [visibleRooms]);

  const goToNextRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = visibleRooms.findIndex((r: any) => r.id === id);
      const next =
        idx >= 0 && idx < visibleRooms.length - 1
          ? visibleRooms[idx + 1]
          : visibleRooms[visibleRooms.length - 1];
      return next?.id ?? id;
    });
  }, [visibleRooms]);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = swipeStart.current;
      swipeStart.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < 2 * Math.abs(dy)) return;
      if (dx < 0) goToNextRoom();
      else goToPrevRoom();
    },
    [goToNextRoom, goToPrevRoom]
  );

  if (!isLoaded) return null;

  const currentIdx = visibleRooms.findIndex((r: any) => r.id === activeRoomId);
  const totalDevices = allDevices.filter((d: any) => d.household_id === householdId).length;
  const onlineDevices = allDevices.filter(
    (d: any) => d.household_id === householdId && d.status === "online"
  ).length;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden">
      {!token ? (
        <div className="p-4 flex-1">
          <TokenForm onSave={setToken} />
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border/30">
            <MobileHeader roomDevices={roomDevices} allDevices={allDevices} />

            <div className="flex items-center gap-1 px-2 pb-2">
              <button
                onClick={goToPrevRoom}
                disabled={currentIdx <= 0}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                title="Предыдущая комната"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div
                className="flex gap-1.5 overflow-x-auto py-1 flex-1 min-w-0"
                style={{ scrollbarWidth: "none" }}
              >
                {visibleRooms.map((room: any) => (
                  <button
                    key={room.id}
                    ref={(el) => {
                      roomChipRefs.current.set(room.id, el);
                    }}
                    onClick={() => setActiveRoomId(room.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors border ${
                      activeRoomId === room.id
                        ? "bg-[hsl(var(--gold))] text-background border-[hsl(var(--gold))]"
                        : "border-border/50 text-muted-foreground bg-card"
                    }`}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
              <button
                onClick={goToNextRoom}
                disabled={currentIdx >= visibleRooms.length - 1}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                title="Следующая комната"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="h-px bg-border/25 mx-2" />
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto px-3 py-2"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {userInfoQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : cardDevices.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {visibleRooms.length === 0 ? "Нет видимых комнат" : "Нет устройств для управления"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {cardDevices.map((device) => (
                  <div
                    key={device.id}
                    className="min-w-0 aspect-square rounded-xl overflow-hidden"
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
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-20 px-4 py-2 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground bg-background/80 backdrop-blur">
            <span className="flex items-center gap-1 shrink-0">
              <Wifi className="w-3 h-3" />
              {onlineDevices}/{totalDevices}
            </span>
            {currentRoom && (
              <span className="text-foreground font-medium shrink-0">{currentRoom.name}</span>
            )}
            <span className="w-px h-3 bg-border/50 shrink-0" />
            {userInfoQuery.isError ? (
              <span className="text-[hsl(0,72%,51%)] shrink-0">Нет соединения</span>
            ) : userInfoQuery.isLoading ? (
              <span className="text-[hsl(38,95%,64%)] shrink-0">Синхронизация…</span>
            ) : (
              <span className="text-[hsl(142,70%,45%)] shrink-0">Онлайн</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
