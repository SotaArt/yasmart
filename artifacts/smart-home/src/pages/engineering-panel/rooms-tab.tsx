import { useState, useCallback, useMemo } from "react";
import { DeviceCard } from "./device-card";
import { useDeviceOverrides } from "./device-card";
import { loadFeaturedDevices, saveFeaturedDevices } from "./device-card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Image as ImageIcon, X } from "lucide-react";
import type { Device, Room } from "@/lib/yandex";
import { getDeviceStatus, getDeviceCategory, DEVICE_CATEGORIES, sortRooms, type DeviceCategoryKey } from "@/lib/yandex";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { Eye, EyeOff } from "lucide-react";

const DEVICE_ORDER_KEY = "eng_device_order_v1";

export function loadDeviceOrder(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_ORDER_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveDeviceOrder(order: Record<string, string[]>) {
  localStorage.setItem(DEVICE_ORDER_KEY, JSON.stringify(order));
}

// Группировка устройств комнаты по категориям (порядок = DEVICE_CATEGORIES)
// Внутри группы: сначала видимые устройства, потом скрытые
function groupByCategory(
  devices: Device[],
  isVisible?: (d: Device) => boolean
): { key: DeviceCategoryKey; label: string; devices: Device[] }[] {
  const groups = new Map<DeviceCategoryKey, Device[]>();
  for (const cat of DEVICE_CATEGORIES) groups.set(cat.key, []);
  for (const device of devices) {
    const key = getDeviceCategory(device);
    groups.get(key)!.push(device);
  }
  const sortDevices = (list: Device[]): Device[] => {
    if (!isVisible) return list;
    return [...list].sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));
  };
  return DEVICE_CATEGORIES
    .map(({ key, label }) => ({ key, label, devices: sortDevices(groups.get(key) ?? []) }))
    .filter((g) => g.devices.length > 0);
}

interface RoomsTabProps {
  rooms: Room[];
  devices: Device[];
  token: string;
  hideOffline: boolean;
}

export function RoomsTab({
  rooms,
  devices,
  token,
  hideOffline,
}: RoomsTabProps) {
  const overrides = useDeviceOverrides();
  const { isDeviceVisible } = useDeviceVisibility();
  const sortedRooms = useMemo(() => sortRooms(rooms), [rooms]);

  // Избранные устройства (roomId -> deviceId)
  const [featuredDevices, setFeaturedDevices] = useState<Record<string, string>>(loadFeaturedDevices);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [deviceOrder, setDeviceOrder] = useState<Record<string, string[]>>(loadDeviceOrder);

  const toggleFeatured = useCallback((roomId: string, deviceId: string) => {
    setFeaturedDevices((prev) => {
      const next = { ...prev };
      if (next[roomId] === deviceId) {
        // Убираем звёздочку
        delete next[roomId];
      } else {
        // Ставим звёздочку (только одна на комнату)
        next[roomId] = deviceId;
      }
      saveFeaturedDevices(next);
      return next;
    });
  }, []);

  const toggleRoom = useCallback((roomId: string) => {
    setExpandedRoomId((prev) => (prev === roomId ? null : roomId));
  }, []);

  // Build a set of device IDs that belong to any room (via room.devices array)
  const roomDeviceIds = new Set<string>();
  for (const room of rooms) {
    for (const deviceId of room.devices ?? []) {
      roomDeviceIds.add(deviceId);
    }
  }

  return (
    <div>
      {sortedRooms.map((room) => (
        <RoomSection
          key={room.id}
          room={room}
          devices={devices}
          rooms={rooms}
          token={token}
          hideOffline={hideOffline}
          overrides={overrides}
          featuredDeviceId={featuredDevices[room.id]}
          onToggleFeatured={(deviceId) => toggleFeatured(room.id, deviceId)}
          collapsed={expandedRoomId !== room.id}
          onToggleCollapse={() => toggleRoom(room.id)}
          deviceOrder={deviceOrder[room.id] || []}
          onReorder={(orderedIds) => {
            const next = { ...deviceOrder, [room.id]: orderedIds };
            setDeviceOrder(next);
            saveDeviceOrder(next);
          }}
        />
      ))}

      {/* Unroomed devices — those not assigned to any room via room_id or room.devices */}
      {(() => {
        const unroomed = devices.filter(
          (d) =>
            (!d.room_id || !rooms.find((r) => r.id === d.room_id)) &&
            !roomDeviceIds.has(d.id)
        );
        const visible = hideOffline
          ? unroomed.filter((d) => getDeviceStatus(d).type !== "off")
          : unroomed;

        if (visible.length === 0) return null;

        return (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Без комнаты
            </h3>
            {groupByCategory(visible, (d) => isDeviceVisible(d.id)).map((group) => (
              <div key={group.key} className="mb-4">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.label}
                  <span className="ml-1.5 text-[9px] font-mono opacity-60">{group.devices.length}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.devices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      token={token}
                      rooms={rooms}
                      hideOffline={hideOffline}
                      displayName={overrides.getDisplayName(device)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

    </div>
  );
}

function RoomSection({
  room,
  devices,
  rooms,
  token,
  hideOffline,
  overrides,
  featuredDeviceId,
  onToggleFeatured,
  collapsed,
  onToggleCollapse,
  deviceOrder,
  onReorder,
}: {
  room: Room;
  devices: Device[];
  rooms: Room[];
  token: string;
  hideOffline: boolean;
  overrides: ReturnType<typeof useDeviceOverrides>;
  featuredDeviceId?: string;
  onToggleFeatured?: (deviceId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  deviceOrder: string[];
  onReorder: (orderedIds: string[]) => void;
}) {
  const { isRoomVisible, setRoomVisible } = useRoomVisibility();
  const { isDeviceVisible } = useDeviceVisibility();
  const { getRoomBackground, setRoomBackground } = useDashboardLayout();
  const roomVisible = isRoomVisible(room.id);
  const roomBackground = getRoomBackground(room.id);

  // Filter devices that belong to this room — match via device.room_id OR room.devices array
  const roomDeviceIdSet = new Set(room.devices ?? []);
  const roomDevices = devices.filter(
    (d) => d.room_id === room.id || roomDeviceIdSet.has(d.id)
  );

  // Apply hide-offline filter
  const visibleDevices = hideOffline
    ? roomDevices.filter((d) => getDeviceStatus(d).type !== "off")
    : roomDevices;

  const sortedRoomDevices = useMemo(() => {
    if (!deviceOrder || deviceOrder.length === 0) return visibleDevices;
    const map = new Map(visibleDevices.map((d) => [d.id, d]));
    const ordered: Device[] = [];
    for (const id of deviceOrder) {
      const d = map.get(id);
      if (d) {
        ordered.push(d);
        map.delete(id);
      }
    }
    for (const d of map.values()) {
      ordered.push(d);
    }
    return ordered;
  }, [visibleDevices, deviceOrder]);

  const grouped = useMemo(
    () => groupByCategory(sortedRoomDevices, (d) => isDeviceVisible(d.id)),
    [sortedRoomDevices, isDeviceVisible]
  );
  const groupedCount = visibleDevices.length;

  const orderedIds = sortedRoomDevices.map((d) => d.id);
  const positionById = new Map(orderedIds.map((id, idx) => [id, idx + 1]));

  const setDevicePosition = (deviceId: string, position: number) => {
    const list = [...orderedIds];
    const from = list.indexOf(deviceId);
    if (from < 0 || !Number.isFinite(position)) return;
    list.splice(from, 1);
    const target = Math.max(0, Math.min(list.length, Math.round(position) - 1));
    list.splice(target, 0, deviceId);
    onReorder(list);
  };

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-2 w-full">
        <button
          onClick={() => setRoomVisible(room.id, !roomVisible)}
          className={`p-1 rounded-md transition-colors shrink-0 ${
            roomVisible
              ? "text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))]/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={roomVisible ? "Показывать комнату в ЮП и МП" : "Скрыть комнату в ЮП и МП"}
        >
          {roomVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-lg px-3 py-1.5 bg-gradient-to-r from-muted/60 to-muted/30 border border-border/60 hover:from-muted hover:to-muted/40 transition-colors"
          onClick={onToggleCollapse}
        >
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{room.name}</h3>
          <Badge variant="outline" className="text-xs font-mono border-border/60">
            {groupedCount}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {roomBackground && (
              <img src={roomBackground} alt="" className="w-6 h-6 rounded object-cover border border-border/60" />
            )}
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const max = 1600;
                      const scale = Math.min(max / img.width, max / img.height, 1);
                      canvas.width = Math.round(img.width * scale);
                      canvas.height = Math.round(img.height * scale);
                      const ctx = canvas.getContext("2d");
                      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      setRoomBackground(room.id, canvas.toDataURL("image/jpeg", 0.8));
                    };
                    img.src = result;
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Загрузить фото фона комнаты"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            {roomBackground && (
              <button
                onClick={() => setRoomBackground(room.id, null)}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Удалить фон комнаты"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-muted-foreground">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </span>
          </div>
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-4 mt-3 mb-6">
          {grouped.map((group) => (
            <div key={group.key}>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
                <span className="ml-1.5 text-[9px] font-mono opacity-60">{group.devices.length}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.devices.map((device) => (
                  <div key={device.id}>
                    <DeviceCard
                      device={device}
                      token={token}
                      rooms={rooms}
                      hideOffline={hideOffline}
                      displayName={overrides.getDisplayName(device)}
                      isFeatured={featuredDeviceId === device.id}
                      onToggleFeatured={onToggleFeatured ? () => onToggleFeatured(device.id) : undefined}
                      reorder={
                        <label
                          className="flex items-center gap-1 text-[10px] text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                          title="Порядок карточки в ЮП"
                        >
                          <span>Место</span>
                          <select
                            value={positionById.get(device.id) ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setDevicePosition(device.id, Number(e.target.value))
                            }
                            aria-label={`Порядок карточки ${device.name} в ЮП`}
                            className="h-6 rounded-md border border-border/60 bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {Array.from(
                              { length: sortedRoomDevices.length },
                              (_, index) => (
                                <option key={index + 1} value={index + 1}>
                                  {index + 1}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
