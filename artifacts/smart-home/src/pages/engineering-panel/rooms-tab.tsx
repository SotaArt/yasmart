import { useState, useCallback, useMemo } from "react";
import { DeviceCard } from "./device-card";
import { useDeviceOverrides } from "./device-card";
import { loadFeaturedDevices, saveFeaturedDevices } from "./device-card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Device, Room } from "@/lib/yandex";
import { getDeviceStatus, getDeviceCategory, DEVICE_CATEGORIES, sortRooms, type DeviceCategoryKey } from "@/lib/yandex";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { Eye, EyeOff } from "lucide-react";

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
  hiddenIds: Set<string>;
  onHide: (id: string) => void;
}

export function RoomsTab({ rooms, devices, token, hideOffline, hiddenIds, onHide }: RoomsTabProps) {
  const overrides = useDeviceOverrides();
  const { isDeviceVisible } = useDeviceVisibility();
  const sortedRooms = useMemo(() => sortRooms(rooms), [rooms]);

  // Избранные устройства (roomId -> deviceId)
  const [featuredDevices, setFeaturedDevices] = useState<Record<string, string>>(loadFeaturedDevices);

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
          hiddenIds={hiddenIds}
          onHide={onHide}
          overrides={overrides}
          featuredDeviceId={featuredDevices[room.id]}
          onToggleFeatured={(deviceId) => toggleFeatured(room.id, deviceId)}
        />
      ))}

      {/* Unroomed devices — those not assigned to any room via room_id or room.devices */}
      {(() => {
        const unroomed = devices.filter(
          (d) =>
            !hiddenIds.has(d.id) &&
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
                      onHide={onHide}
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
  hiddenIds,
  onHide,
  overrides,
  featuredDeviceId,
  onToggleFeatured,
}: {
  room: Room;
  devices: Device[];
  rooms: Room[];
  token: string;
  hideOffline: boolean;
  hiddenIds: Set<string>;
  onHide: (id: string) => void;
  overrides: ReturnType<typeof useDeviceOverrides>;
  featuredDeviceId?: string;
  onToggleFeatured?: (deviceId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { isRoomVisible, setRoomVisible } = useRoomVisibility();
  const { isDeviceVisible } = useDeviceVisibility();
  const roomVisible = isRoomVisible(room.id);

  // Filter devices that belong to this room — match via device.room_id OR room.devices array
  const roomDeviceIdSet = new Set(room.devices ?? []);
  const roomDevices = devices.filter(
    (d) =>
      !hiddenIds.has(d.id) &&
      (d.room_id === room.id || roomDeviceIdSet.has(d.id))
  );

  // Apply hide-offline filter
  const visibleDevices = hideOffline
    ? roomDevices.filter((d) => getDeviceStatus(d).type !== "off")
    : roomDevices;

  const grouped = useMemo(
    () => groupByCategory(visibleDevices, (d) => isDeviceVisible(d.id)),
    [visibleDevices, isDeviceVisible]
  );
  const groupedCount = visibleDevices.length;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 w-full">
      <button
        onClick={() => setRoomVisible(room.id, !roomVisible)}
        className={`p-1 rounded-md transition-colors shrink-0 ${
          roomVisible
            ? "text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))]/80"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title={roomVisible ? "Видна в юзер-панели" : "Скрыта в юзер-панели"}
      >
        {roomVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <button
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{room.name}</h3>
        <Badge variant="secondary" className="text-xs font-mono">
          {groupedCount}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>
    </div>
      {!collapsed && (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.key}>
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
                    onHide={onHide}
                    isFeatured={featuredDeviceId === device.id}
                    onToggleFeatured={onToggleFeatured ? () => onToggleFeatured(device.id) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
