import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useGetUserInfo } from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { getUserInfoKey } from "@/lib/query-keys";
import {
  sortRooms,
  type Device,
  type Room,
} from "@/lib/yandex";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useSensorDevices } from "@/hooks/use-sensor-devices";
import { matchDeviceToTemplate } from "@/lib/device-template-map";
import { TokenForm } from "@/components/token-form";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeader } from "./mobile/MobileHeader";
import { MobileDeviceCard } from "./mobile/MobileDeviceCard";
import { ChevronLeft, ChevronRight, Wifi } from "lucide-react";

const HIDDEN_ENG_KEY = "hidden_eng_devices_v1";

/* Категории карточек в ЮМП ─── */

type GroupId = "light" | "climate" | "comfort" | "security" | "other";

/** Типы capability, которые реально управляют устройством (не «датчиковые») */
const CONTROL_CAP_TYPES = new Set([
  "devices.capabilities.on_off",
  "devices.capabilities.mode",
  "devices.capabilities.range",
  "devices.capabilities.toggle",
  "devices.capabilities.color_setting",
]);

function hasControlCapability(device: Device): boolean {
  return (device.capabilities ?? []).some((c) => CONTROL_CAP_TYPES.has(c.type));
}

/** Датчик/пульт/кнопка — такие карточки в списке не показываем */
function isSensorLike(device: Device): boolean {
  if (device.type.startsWith("devices.types.sensor")) return true;
  if (matchDeviceToTemplate(device)?.startsWith("sensor-")) return true;
  // Устройство без управляющих capability, но с данными датчиков (датчик-пульт и т.п.)
  if (!hasControlCapability(device)) return true;
  return false;
}

const GROUP_META: { id: GroupId; label: string; icon: string }[] = [
  { id: "light", label: "Свет", icon: "💡" },
  { id: "climate", label: "Климат", icon: "🌡️" },
  { id: "comfort", label: "Комфорт", icon: "🛋️" },
  { id: "security", label: "Безопасность", icon: "🛡️" },
  { id: "other", label: "Прочее", icon: "📦" },
];

/** Категория + порядок внутри категории (от важного к менее важному) */
function deviceGroup(device: Device): { id: GroupId; order: number } {
  const t = device.type;
  const name = (device.name ?? "").toLowerCase();
  const isControl = t.startsWith("devices.types.switch") || t.startsWith("devices.types.socket");
  const isLightControlName = /свет|люстр|витрин|ночн|подсветк|лампа|лента|гирлянд/.test(name);

  if (t.startsWith("devices.types.light") || (isControl && isLightControlName)) {
    let order = 90;
    if (/свет/i.test(name)) order = 10;
    else if (/люстр/i.test(name) || t === "devices.types.light.ceiling") order = 20;
    else if (/витрин/i.test(name)) order = 30;
    else if (/лента/i.test(name) || t === "devices.types.light.strip") order = 35;
    else if (/ночн/i.test(name) || t === "devices.types.light.garland") order = 40;
    else if (/лампа|торшер|бра/.test(name) || t.includes(".lamp") || t.includes("torchere") || t.includes("sconce")) order = 50;
    return { id: "light", order };
  }

  if (
    t.startsWith("devices.types.thermostat") ||
    t.startsWith("devices.types.humidifier") ||
    t.startsWith("devices.types.purifier") ||
    t.startsWith("devices.types.ventilation") ||
    t === "devices.types.cooking.hood"
  ) {
    let order = 90;
    if (t.includes("ventilation")) order = 10;
    else if (t === "devices.types.cooking.hood") order = 20;
    else if (t === "devices.types.thermostat.ac") order = 30;
    else if (t === "devices.types.thermostat") order = 40;
    else if (t === "devices.types.thermostat.heater") order = 50;
    else if (t.includes("purifier")) order = 60;
    else if (t.includes("humidifier")) order = 70;
    return { id: "climate", order };
  }

  if (
    t === "devices.types.openable.curtain" ||
    t.startsWith("devices.types.media_device") ||
    t.includes("speaker") ||
    t.includes("station")
  ) {
    let order = 90;
    if (t === "devices.types.openable.curtain") order = 10;
    else if (t === "devices.types.media_device.tv") order = 20;
    else if (t.includes("speaker") || t.includes("station")) order = 30;
    else order = 40;
    return { id: "comfort", order };
  }

  if (t === "devices.types.openable.valve" || t === "devices.types.openable.door_lock") {
    return { id: "security", order: t.includes("valve") ? 10 : 20 };
  }

  return { id: "other", order: 0 };
}

function loadHiddenEng(): Set<string> {
  try {
    const saved = localStorage.getItem(HIDDEN_ENG_KEY);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export default function MobilePanel() {
  const params = useParams<{ householdId: string }>();
  const householdId = params.householdId;

  const { token, setToken, isLoaded } = useYandexToken();
  const { filterDevices } = useDeviceVisibility();
  const { isRoomVisible } = useRoomVisibility();
  const { isSensorOnly } = useSensorDevices();

  const [hiddenEng, setHiddenEng] = useState<Set<string>>(loadHiddenEng);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const roomChipRefs = useRef(new Map<string, HTMLButtonElement | null>());

  // Синхронизация скрытых в ИП устройств (cross-tab / та же вкладка)
  useEffect(() => {
    const sync = () => setHiddenEng(loadHiddenEng());
    window.addEventListener("storage", sync);
    window.addEventListener("engineering-devices-hidden", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("engineering-devices-hidden", sync);
    };
  }, []);

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
    return filterDevices(inRoom as Device[]).filter((d) => !hiddenEng.has(d.id));
  }, [currentRoom, allDevices, householdId, filterDevices, hiddenEng]);

  const listDevices = useMemo(
    () =>
      roomDevices.filter(
        (d) =>
          !isSensorOnly(d.id) &&
          !isSensorLike(d) &&
          (hasControlCapability(d) || d.type === "devices.types.camera")
      ),
    [roomDevices, isSensorOnly]
  );

  const groupedDevices = useMemo(() => {
    const groups: Record<GroupId, Device[]> = {
      light: [],
      climate: [],
      comfort: [],
      security: [],
      other: [],
    };
    for (const d of listDevices) {
      const g = deviceGroup(d);
      groups[g.id].push(d);
    }
    for (const key of Object.keys(groups) as GroupId[]) {
      groups[key].sort((a, b) => {
        const oa = deviceGroup(a).order;
        const ob = deviceGroup(b).order;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, "ru");
      });
    }
    return groups;
  }, [listDevices]);

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
    <div
      className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden"
      style={{
        /* ── Локальная СВЕТЛАЯ тема ЮМП (белая), независимо от глобальной тёмной ── */
        ["--background" as string]: "206 30% 98%",
        ["--foreground" as string]: "217 33% 14%",
        ["--card" as string]: "0 0% 100%",
        ["--card-foreground" as string]: "217 33% 14%",
        ["--card-border" as string]: "217 15% 88%",
        ["--border" as string]: "217 15% 88%",
        ["--input" as string]: "217 15% 86%",
        ["--muted" as string]: "214 20% 94%",
        ["--muted-foreground" as string]: "217 12% 44%",
        ["--accent" as string]: "214 25% 93%",
        ["--accent-foreground" as string]: "217 33% 14%",
        ["--gold" as string]: "38 92% 46%",
        ["--primary" as string]: "38 92% 46%",
        ["--primary-foreground" as string]: "0 0% 100%",
        ["--ring" as string]: "38 92% 46%",
      }}
    >
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
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : listDevices.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {visibleRooms.length === 0 ? "Нет видимых комнат" : "Нет устройств для управления"}
              </div>
            ) : (
              <div className="space-y-4">
                {GROUP_META.map((g) => {
                  const devices = groupedDevices[g.id];
                  if (devices.length === 0) return null;
                  return (
                    <section key={g.id}>
                      <div className="flex items-center gap-1.5 px-1 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        <span className="text-xs">{g.icon}</span>
                        <span>{g.label}</span>
                        <span className="text-[10px] text-muted-foreground/60">· {devices.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {devices.map((device) => (
                          <MobileDeviceCard key={device.id} device={device} token={token} />
                        ))}
                      </div>
                    </section>
                  );
                })}
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