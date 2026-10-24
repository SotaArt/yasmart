import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  getDeviceIcon, isDeviceOn, getAcMode, getAcTemperature, getAcFanSpeed, getSensorReadings, AC_MODE_LABELS, type AcMode, type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { LuxTempControl, LuxButton, LuxBadge, CardFrame } from "./premium";


interface ThermostatCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

function getFanSpeedLabel(value: number | string | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "number") return `${value}`;
  const labels: Record<string, string> = { auto: "Авто", low: "Тихо", medium: "Средне", high: "Максимум" };
  return labels[value] ?? String(value);
}

export function ThermostatCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: ThermostatCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const isAc = device.type === "devices.types.thermostat.ac";
  const isHeater = device.type === "devices.types.thermostat.heater";
  const subtitle = isHeater ? "Обогреватель" : isAc ? "Кондиционер" : "Термостат";
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const acMode = getAcMode(device);
  const tempInfo = getAcTemperature(device);
  const targetTemp = tempInfo.value;
  const minTemp = tempInfo.min ?? 16;
  const maxTemp = tempInfo.max ?? 30;
  const fanInfo = getAcFanSpeed(device);
  const fanSpeed = fanInfo.value;
  const readings = getSensorReadings(device);
  const currentTemp = readings.temperature;

  const contextMenuItems = [
    {
      id: "pin",
      label: isPinned ? "Открепить" : "Закрепить",
      icon: isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: () => onPin?.(),
    },
    {
      id: "resize-expand",
      label: "Увеличить",
      icon: <Maximize2 className="w-4 h-4" />,
      onClick: () => onResize?.("2x1"),
    },
    {
      id: "resize-shrink",
      label: "Уменьшить",
      icon: <Minimize2 className="w-4 h-4" />,
      onClick: () => onResize?.("1x1"),
    },
    {
      id: "delete",
      label: "Скрыть",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete?.(),
      danger: true,
    },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    handleLongPressStart(e, contextMenuItems);
  }, [contextMenuItems, handleLongPressStart]);

  const handleToggle = () => {
    const newValue = !isOn;
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }] },
      })
    ).then(() => {
      toast({ variant: "success", title: newValue ? "Термостат включён" : "Термостат выключен", description: device.name });
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    }).catch(() => {
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
    });
  };

  const handleTempChange = (newTemp: number) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.range" && c.state?.instance === "temperature"
                ? { ...c, state: { ...c.state, value: newTemp } }
                : c
            ),
          };
        }),
      };
    });
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "temperature", value: newTemp } }] },
    });
  };

  const setMode = (mode: AcMode) => {
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.mode", state: { instance: "thermostat", value: mode } }] },
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }),
    });
  };

  const MODES: AcMode[] = ["auto", "cool", "heat", "dry", "fan_only"];

  return (
    <CardFrame
      size={size}
      variant="thermostat"
      active={isOn}
      pinned={isPinned}
      onContextMenu={handleContextMenu}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      subtitle={subtitle}
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
      top={
        <div className="flex flex-col items-center">
          {currentTemp !== undefined && (
            <span className={`font-mono leading-none text-slate-400 ${size === "compact" ? "text-[9px]" : "text-[11px]"}`}>
              сейчас {currentTemp.toFixed(1)}°
            </span>
          )}
          {size === "compact" && acMode && (
            <LuxBadge variant={acMode === "cool" ? "info" : acMode === "heat" ? "error" : "gold"} active>
              {AC_MODE_LABELS[acMode]?.emoji ?? "⚙️"} {AC_MODE_LABELS[acMode]?.label ?? acMode}
            </LuxBadge>
          )}
        </div>
      }
      bottom={
        <div className={`w-full space-y-1.5 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {targetTemp !== undefined && (
            <LuxTempControl
              value={targetTemp}
              min={minTemp}
              max={maxTemp}
              step={0.5}
              label="Целевая"
              displayValue
              displayClassName={size === "compact" ? "text-xl" : "text-2xl"}
              onChange={handleTempChange}
            />
          )}

          {(size === "expanded" || size === "full") && isAc && (
            <div className="w-full space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider text-center">Режим</p>
              <div className="flex flex-wrap justify-center gap-1">
                {MODES.map((m) => (
                  <LuxButton
                    key={m}
                    variant={acMode === m ? "gold" : "quiet"}
                    glow={acMode === m}
                    onClick={() => setMode(m)}
                    className="px-2 py-1 text-[9px]"
                  >
                    {AC_MODE_LABELS[m]?.emoji} {AC_MODE_LABELS[m]?.label}
                  </LuxButton>
                ))}
              </div>
              {fanSpeed !== undefined && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400">Вентилятор</span>
                  <span className="text-[10px] font-mono text-slate-300">{getFanSpeedLabel(fanSpeed)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      }
      overlay={
        <ContextMenu
          open={menuState.open}
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onClose={closeMenu}
        />
      }
    />
  );
}
