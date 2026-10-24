import { Badge } from "@/components/ui/badge";
import { StatCard } from "./components/stat-card";
import { DeviceStatusBadge } from "./components/device-status-badge";
import { getDeviceIcon, getDeviceTypeLabel, getDeviceStatus, isDeviceReporting, type Device } from "@/lib/yandex";
import { Wifi, Bluetooth, Cloud, Radio } from "lucide-react";

interface NetworkTabProps {
  protocolGroups: Map<string, Device[]>;
  totalDevices: number;
}

const PROTOCOL_ICONS: Record<string, typeof Wifi> = {
  Zigbee: Radio,
  WiFi: Wifi,
  Cloud: Cloud,
  Quasar: Bluetooth,
};

const PROTOCOL_COLORS: Record<string, string> = {
  Zigbee: "text-blue-400",
  WiFi: "text-[hsl(var(--gold))]",
  Cloud: "text-purple-400",
  Quasar: "text-amber-400",
};

export function NetworkTab({ protocolGroups, totalDevices }: NetworkTabProps) {
  const protocols = Array.from(protocolGroups.entries());

  return (
    <div className="space-y-6">
      {/* Protocol summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {protocols.map(([protocol, devices]) => {
          const Icon = PROTOCOL_ICONS[protocol] ?? Wifi;
          const active = devices.filter(isDeviceReporting).length;
          return (
            <StatCard
              key={protocol}
              icon={<Icon className={`w-5 h-5 ${PROTOCOL_COLORS[protocol] ?? ""}`} />}
              label={protocol}
              value={`${active}/${devices.length}`}
            />
          );
        })}
      </div>

      {/* Protocol groups */}
      {protocols.map(([protocol, devices]) => {
        const Icon = PROTOCOL_ICONS[protocol] ?? Wifi;
        const active = devices.filter(isDeviceReporting).length;
        const offline = devices.length - active;

        return (
          <div key={protocol}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${PROTOCOL_COLORS[protocol] ?? ""}`} />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {protocol}
              </h3>
              <Badge variant="secondary" className="text-xs font-mono">
                {devices.length}
              </Badge>
              {active > 0 && (
                <Badge className="text-[10px] bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30">
                  {active} активны
                </Badge>
              )}
              {offline > 0 && (
                <Badge className="text-[10px] bg-muted text-muted-foreground border-border/50">
                  {offline} не активны
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              {devices.map((device) => {
                const status = getDeviceStatus(device);
                return (
                  <div
                    key={device.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/30 hover:border-border/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{getDeviceIcon(device.type)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{device.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getDeviceTypeLabel(device.type)}</p>
                      </div>
                    </div>
                    <DeviceStatusBadge status={status.type} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {protocols.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Нет данных о сети</p>
      )}
    </div>
  );
}
