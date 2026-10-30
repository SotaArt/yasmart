import { SmartCard, type CardSize } from "./SmartCard";
import { SmartCardDivider } from "./premium";
import { Sparkline } from "./Sparkline";
import { getDeviceIcon, getSensorReadings, type Device } from "@/lib/yandex";
import type { TileSize } from "@/hooks/use-panel-config";

interface SensorCardProps {
  device: Device;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  sensorHistory?: { temperature: number[]; humidity: number[] };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function SensorCard({
  device,
  size,
  tileConfig,
  sensorHistory,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: SensorCardProps) {
  const icon = getDeviceIcon(device.type, device.id);
  const readings = getSensorReadings(device);
  const isPinned = tileConfig?.pinned ?? false;

  const tempHistory = sensorHistory?.temperature ?? [];
  const humHistory = sensorHistory?.humidity ?? [];

  const primaryValue = readings.temperature !== undefined
    ? `${readings.temperature.toFixed(1)}°`
    : readings.humidity !== undefined
    ? `${Math.round(readings.humidity)}%`
    : readings.co2 !== undefined
    ? `${Math.round(readings.co2)} ppm`
    : readings.illumination !== undefined
    ? `${readings.illumination.toFixed(0)} лк`
    : readings.pm25 !== undefined
    ? `${Math.round(readings.pm25)} µg/м³`
    : readings.smoke !== undefined
    ? readings.smoke ? "Дым!" : "Чисто"
    : readings.gas !== undefined
    ? readings.gas ? "Газ!" : "Норма"
    : readings.motion !== undefined
    ? readings.motion ? "Движение" : "Нет движения"
    : readings.open !== undefined
    ? readings.open ? "Открыто" : "Закрыто"
    : readings.presence !== undefined
    ? readings.presence ? "Присутствие" : "Нет людей"
    : readings.vibration !== undefined
    ? readings.vibration ? "Вибрация" : "Спокойно"
    : readings.water_leak !== undefined
    ? readings.water_leak ? "Протечка!" : "Сухо"
    : "—";

  const primaryLabel = readings.temperature !== undefined
    ? "Температура"
    : readings.humidity !== undefined
    ? "Влажность"
    : readings.co2 !== undefined
    ? "CO₂"
    : readings.illumination !== undefined
    ? "Освещённость"
    : readings.pm25 !== undefined
    ? "PM2.5"
    : readings.smoke !== undefined
    ? "Дым"
    : readings.gas !== undefined
    ? "Газ"
    : readings.motion !== undefined
    ? "Движение"
    : readings.open !== undefined
    ? "Дверь"
    : readings.presence !== undefined
    ? "Присутствие"
    : readings.vibration !== undefined
    ? "Вибрация"
    : readings.water_leak !== undefined
    ? "Протечка"
    : "";

  return (
    <SmartCard
      size={size}
      variant="sensor"
      active={false}
      pinned={isPinned}
      data-testid={`tile-device-${device.id}`}
    >
      <SmartCard.Header icon={icon} name={device.name} />
      <SmartCardDivider className="mt-2 mb-2" />

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
        <SmartCard.Primary>
          {primaryValue}
        </SmartCard.Primary>

        <div className="flex gap-2 flex-wrap justify-center">
          {readings.temperature !== undefined && primaryLabel !== "Температура" && (
            <span className="text-[10px] font-mono text-muted-foreground">
              🌡 {readings.temperature.toFixed(1)}°
            </span>
          )}
          {readings.humidity !== undefined && primaryLabel !== "Влажность" && (
            <span className="text-[10px] font-mono text-muted-foreground">
              💧 {Math.round(readings.humidity)}%
            </span>
          )}
          {readings.co2 !== undefined && primaryLabel !== "CO₂" && (
            <span className="text-[10px] font-mono text-muted-foreground">
              CO₂ {Math.round(readings.co2)} ppm
            </span>
          )}
          {readings.battery !== undefined && (
            <span className={`text-[10px] font-mono ${
              readings.battery > 60 ? "text-device-success"
              : readings.battery > 20 ? "text-yellow-400"
              : "text-destructive"
            }`}>
              🔋 {Math.round(readings.battery)}%
            </span>
          )}
        </div>

        <SmartCard.Meta>
          <div className="flex items-center justify-center gap-3">
            {tempHistory.length > 1 && (
              <div className="flex items-center gap-1">
                <Sparkline values={tempHistory} color="hsl(var(--device-heating))" width={48} height={16} />
                <span className="text-[9px] text-muted-foreground">Темп.</span>
              </div>
            )}
            {humHistory.length > 1 && (
              <div className="flex items-center gap-1">
                <Sparkline values={humHistory} color="hsl(217 91% 60%)" width={48} height={16} />
                <span className="text-[9px] text-muted-foreground">Влажн.</span>
              </div>
            )}
          </div>
        </SmartCard.Meta>
      </div>
    </SmartCard>
  );
}
