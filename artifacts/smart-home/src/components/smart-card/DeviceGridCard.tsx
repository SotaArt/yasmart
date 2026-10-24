import type { Device } from "@/lib/yandex";
import { matchDeviceToTemplate } from "@/lib/device-template-map";
import type { CardSize } from "./types";
import type { TileSize } from "@/hooks/use-panel-config";
import type { DeviceTimer } from "@/hooks/use-panel-config";
import { CardTimerProvider } from "./CardTimer";
import { CardPartsProvider, type CardPartId } from "./card-parts";
import { LightCard } from "./LightCard";
import { SwitchCard } from "./SwitchCard";
import { SocketCard } from "./SocketCard";
import { SensorCard } from "./SensorCard";
import { ThermostatCard } from "./ThermostatCard";
import { ClimateCard } from "./ClimateCard";
import { CurtainCard } from "./CurtainCard";
import { VacuumCard } from "./VacuumCard";
import { MediaCard } from "./MediaCard";
import { CameraCard } from "./CameraCard";
import { SecurityCard } from "./SecurityCard";
import { WaterLeakCard } from "./WaterLeakCard";
import { GenericDeviceCard } from "./GenericDeviceCard";
import { ACCard } from "./ACCard";

interface DeviceGridCardProps {
  device: Device;
  token: string;
  size: CardSize;
  timers?: DeviceTimer[];
  onAddTimer?: (deviceId: string, deviceName: string, action: "on" | "off", delayMs: number) => void;
  onCancelTimer?: (timerId: string) => void;
  hiddenParts?: CardPartId[];
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onResize?: (size: TileSize) => void;
  onDelete?: () => void;
  onToggleCompact?: () => void;
}

/**
 * Диспетчер карточек ЮП-сетки: по типу устройства (единый маппинг с каталогом
 * «Карточки» в ИП) выбирает готовую функциональную карточку из smart-card.
 */
export function DeviceGridCard({ device, token, size, timers = [], onAddTimer, onCancelTimer, hiddenParts, tileConfig, onPin, onResize, onDelete, onToggleCompact }: DeviceGridCardProps) {
  const template = matchDeviceToTemplate(device);

  const menu = { tileConfig, onPin, onResize, onDelete, onToggleCompact };

  let card: React.ReactNode;
  switch (template) {
    case "switch":
    case "switch-relay":
      card = <SwitchCard device={device} token={token} size={size} {...menu} />;
      break;

    case "socket":
      card = <SocketCard device={device} token={token} size={size} {...menu} />;
      break;

    case "light-onoff":
    case "light-dimmer":
    case "light-color":
    case "light-temp":
    case "light-full":
    case "light-strip":
      card = <LightCard device={device} token={token} size={size} {...menu} />;
      break;

    case "thermostat":
    case "heater":
      card = <ThermostatCard device={device} token={token} size={size} {...menu} />;
      break;

    case "ac":
      card = <ACCard device={device} token={token} size={size} {...menu} />;
      break;

    case "humidifier":
    case "purifier":
    case "fan":
    case "hood":
      card = <ClimateCard device={device} token={token} size={size} {...menu} />;
      break;

    case "curtain":
    case "blind":
    case "valve":
      card = <CurtainCard device={device} token={token} size={size} {...menu} />;
      break;

    case "lock":
      card = <SecurityCard device={device} token={token} size={size} {...menu} />;
      break;

    case "tv":
    case "speaker":
    case "media":
      card = <MediaCard device={device} token={token} size={size} {...menu} />;
      break;

    case "camera":
      card = <CameraCard device={device} token={token} size={size} {...menu} />;
      break;

    case "vacuum":
      card = <VacuumCard device={device} token={token} size={size} {...menu} />;
      break;

    case "sensor-leak":
      card = <WaterLeakCard device={device} size={size} {...menu} />;
      break;

    case "sensor-temp":
    case "sensor-climate":
    case "sensor-illumination":
    case "sensor-motion":
    case "sensor-presence":
    case "sensor-door":
    case "sensor-vibration":
    case "sensor-smoke":
    case "sensor-gas":
    case "sensor-button":
      card = <SensorCard device={device} size={size} {...menu} />;
      break;

    default:
      card = <GenericDeviceCard device={device} token={token} size={size} {...menu} />;
      break;
  }

  return (
    <div className="relative h-full w-full min-h-0">
      <CardPartsProvider hiddenParts={hiddenParts}>
        <CardTimerProvider
          value={{
            deviceId: device.id,
            deviceName: device.name,
            timers,
            size,
            onAddTimer: (action, delayMs) => onAddTimer?.(device.id, device.name, action, delayMs),
            onCancelTimer: (id) => onCancelTimer?.(id),
          }}
        >
          {card}
        </CardTimerProvider>
      </CardPartsProvider>
    </div>
  );
}