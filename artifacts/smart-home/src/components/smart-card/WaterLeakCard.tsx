import { SmartCard, type CardSize } from "./SmartCard";
import { SmartCardDivider } from "./premium";
import { getDeviceIcon, type Device } from "@/lib/yandex";
import type { TileSize } from "@/hooks/use-panel-config";
import { Droplets, AlertTriangle } from "lucide-react";

interface WaterLeakCardProps {
  device: Device;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function WaterLeakCard({
  device,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: WaterLeakCardProps) {
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;

  // Read leak state from properties
  const leakProp = device.properties?.find(
    (p) => p.type === "devices.properties.event" && p.parameters?.instance === "water_leak"
  );
  const isLeaking = leakProp?.state?.value === true;

  const lastUpdate = leakProp?.state?.updated_at
    ? new Date(leakProp.state.updated_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <SmartCard
      size={size}
      variant="sensor"
      active={isLeaking}
      pinned={isPinned}
      data-testid={`tile-device-${device.id}`}
    >
      <SmartCard.Header icon={icon} name={device.name} />
      <SmartCardDivider className="mt-2 mb-2" />

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
        <SmartCard.Primary>
          <div className="flex items-center gap-2">
            {isLeaking ? (
              <AlertTriangle className="w-5 h-5 text-device-error" />
            ) : (
              <Droplets className="w-5 h-5 text-device-cooling" />
            )}
            <span className={isLeaking ? "text-device-error" : "text-device-success"}>
              {isLeaking ? "Протечка!" : "Норма"}
            </span>
          </div>
        </SmartCard.Primary>

        <SmartCard.Status>
          {lastUpdate && `Обновлено: ${lastUpdate}`}
        </SmartCard.Status>
      </div>
    </SmartCard>
  );
}
