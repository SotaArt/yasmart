import { useState, useMemo } from "react";
import { StatCard } from "./components/stat-card";
import { DeviceInventoryDialog } from "./components/device-inventory-dialog";
import { Badge } from "@/components/ui/badge";
import { getDeviceStatus, isDeviceReporting, type Device, type Room } from "@/lib/yandex";
import type { EngineeringStats } from "./hooks/use-engineering-data";
import type { Household } from "@/lib/yandex";
import { Wifi, WifiOff, Activity, AlertTriangle, Clock, MonitorSmartphone, X } from "lucide-react";

interface OverviewTabProps {
  stats: EngineeringStats;
  households: Household[];
  rooms: Room[];
  devices: Device[];
  selectedHouseholdId: string | null;
}

type FilterType = "total" | "active" | "offline" | "withCaps" | "withoutCaps";

const FILTER_TITLES: Record<FilterType, string> = {
  total: "Все устройства",
  active: "Активные устройства",
  offline: "Не активные устройства",
  withCaps: "С возможностями",
  withoutCaps: "Без возможностей",
};

export function OverviewTab({ stats, households, rooms, devices, selectedHouseholdId }: OverviewTabProps) {
  const [filter, setFilter] = useState<FilterType | null>(null);

  const filteredDevices = useMemo(() => {
    if (!filter) return [];
    switch (filter) {
      case "total":
        return devices;
      case "active":
        return devices.filter(isDeviceReporting);
      case "offline":
        return devices.filter((d) => !isDeviceReporting(d));
      case "withCaps":
        return devices.filter((d) => (d.capabilities?.length ?? 0) > 0);
      case "withoutCaps":
        return devices.filter((d) => (d.capabilities?.length ?? 0) === 0);
      default:
        return [];
    }
  }, [filter, devices]);

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<MonitorSmartphone className="w-5 h-5" />}
          label="Всего устройств"
          value={stats.total}
          onClick={() => setFilter(filter === "total" ? null : "total")}
        />
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label="Активны"
          value={stats.active}
          color="text-[hsl(var(--gold))]"
          onClick={() => setFilter(filter === "active" ? null : "active")}
        />
        <StatCard
          icon={<WifiOff className="w-5 h-5" />}
          label="Не активны"
          value={stats.offline}
          color="text-muted-foreground"
          onClick={() => setFilter(filter === "offline" ? null : "offline")}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="С возможностями"
          value={stats.withCapabilities}
          color="text-blue-400"
          onClick={() => setFilter(filter === "withCaps" ? null : "withCaps")}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Без возможностей"
          value={stats.withoutCapabilities}
          color={stats.withoutCapabilities > 0 ? "text-amber-400" : "text-muted-foreground"}
          onClick={() => setFilter(filter === "withoutCaps" ? null : "withoutCaps")}
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3">
        {stats.lastSync && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Последняя синхронизация: {stats.lastSync.toLocaleTimeString("ru-RU")}
          </div>
        )}
        <DeviceInventoryDialog
          households={households}
          rooms={rooms}
          devices={devices}
          selectedHouseholdId={selectedHouseholdId}
        />
      </div>

      {/* Inline device list */}
      {filter && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{FILTER_TITLES[filter]}</span>
              <Badge variant="secondary" className="text-[10px] font-mono">{filteredDevices.length}</Badge>
            </div>
            <button
              onClick={() => setFilter(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {filteredDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет устройств</p>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredDevices.map((device) => {
                const status = getDeviceStatus(device);
                const room = rooms.find((r) => r.id === device.room_id);
                const brand = device.device_info?.manufacturer;
                const model = device.device_info?.model;
                const caps = device.capabilities?.length ?? 0;

                const parts: string[] = [device.name];
                if (status.type === "on") parts.push("Вкл");
                else if (status.type === "off") parts.push("Выкл");
                else if (brand) parts.push(model ? `${brand} ${model}` : brand);
                if (caps > 0) parts.push(`${caps} функц.`);

                return (
                  <div
                    key={device.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-[11px] text-foreground truncate flex-1 min-w-0">
                      {parts.join("  |  ")}
                    </span>
                    {room && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {room.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
