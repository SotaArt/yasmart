import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  getDeviceIcon, getDeviceTypeLabel, isDeviceOn, getDeviceCapability, type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { LuxBar, LuxButton, LuxBadge, CardFrame } from "./premium";


interface ClimateCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

const SPEED_LABELS: Record<string, string> = {
  auto: "Авто", low: "Низкая", medium: "Средняя", high: "Высокая",
  maximum: "Максимум", max: "Макс", min: "Мин", turbo: "Турбо",
  quiet: "Тихий", night: "Ночь", normal: "Обычный", min_1: "Низкая1",
};

function getSpeedLabel(value: string | undefined): string {
  if (!value) return "";
  return SPEED_LABELS[value] ?? value;
}

function getClimateSubtitle(device: Device): string {
  const t = device.type ?? "";
  if (t === "devices.types.humidifier") return "Увлажнитель";
  if (t === "devices.types.purifier") return "Очиститель";
  if (t === "devices.types.ventilation" || t === "devices.types.ventilation.fan") return "Вентиляция";
  if (t === "devices.types.cooking.hood") return "Вытяжка";
  return getDeviceTypeLabel(t);
}

export function ClimateCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: ClimateCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const speedModeCap = getDeviceCapability(device, "devices.capabilities.mode", "work_speed")
    ?? getDeviceCapability(device, "devices.capabilities.mode", "fan_speed");
  const speedModes = (speedModeCap?.parameters?.modes ?? []).map((m: { value: string }) => m.value);
  const speedValue = speedModeCap?.state?.value as string | undefined;

  const fanCap = getDeviceCapability(device, "devices.capabilities.range", "fan_speed")
    ?? getDeviceCapability(device, "devices.capabilities.range", "work_speed");
  const fanValue = fanCap?.state?.value as number | undefined;
  const fanMin = fanCap?.parameters?.min_value as number | undefined ?? 1;
  const fanMax = fanCap?.parameters?.max_value as number | undefined ?? 5;

  const humidity = device.properties?.find(p => p.parameters?.instance === "humidity")?.state?.value as number | undefined;
  const pm25 = device.properties?.find(p => p.parameters?.instance === "pm2.5_density")?.state?.value as number | undefined;
  const temp = device.properties?.find(p => p.parameters?.instance === "temperature")?.state?.value as number | undefined;

  const mainValue = humidity !== undefined
    ? `${Math.round(humidity)}%`
    : pm25 !== undefined
      ? `${Math.round(pm25)}`
      : fanValue !== undefined
        ? getSpeedLabel(speedValue) ?? `${fanValue}`
        : speedValue !== undefined
          ? getSpeedLabel(speedValue)
          : "—";

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
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.on_off"
                ? { ...c, state: { ...(c.state ?? {}), value: newValue } }
                : c
            ),
          };
        }),
      };
    });
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }] },
      })
    ).then(() => {
      toast({ variant: "success", title: newValue ? "Включено" : "Выключено", description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
    });
  };

  const setSpeed = (value: string) => {
    if (speedValue === value || !speedModeCap) return;
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.mode" && c === speedModeCap
                ? { ...c, state: { ...(c.state ?? {}), value } }
                : c
            ),
          };
        }),
      };
    });
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: {
          actions: [{
            type: "devices.capabilities.mode",
            state: { instance: speedModeCap.state?.instance ?? "work_speed", value },
          }],
        },
      })
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить режим ${device.name}` });
    });
  };

  const setFanLevel = (value: number) => {
    if (fanValue === value || !fanCap) return;
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.range" && c === fanCap
                ? { ...c, state: { ...(c.state ?? {}), value } }
                : c
            ),
          };
        }),
      };
    });
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: {
          actions: [{
            type: "devices.capabilities.range",
            state: { instance: fanCap.state?.instance ?? "fan_speed", value },
          }],
        },
      })
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить скорость ${device.name}` });
    });
  };

  const hasReadings = humidity !== undefined || pm25 !== undefined || temp !== undefined;

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
      subtitle={getClimateSubtitle(device)}
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
      top={
        <div className="flex items-baseline gap-1">
          <span className={`font-bold leading-none transition-all duration-200 ${size === "compact" ? "text-base" : "text-xl"} ${isOn ? "text-[#f3e5ab]" : "text-muted-foreground"}`}>
            {mainValue}
          </span>
          {humidity !== undefined && <span className="text-[9px] text-slate-400">влажность</span>}
          {humidity === undefined && pm25 !== undefined && <span className="text-[9px] text-slate-400">PM2.5</span>}
        </div>
      }
      bottom={
        <div className={`w-full space-y-1.5 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {hasReadings && (
            <div className="flex flex-wrap justify-center gap-1">
              {temp !== undefined && (
                <LuxBadge variant="info">🌡️ {temp.toFixed(1)}°</LuxBadge>
              )}
              {humidity !== undefined && (
                <LuxBadge variant="info">💧 {Math.round(humidity)}%</LuxBadge>
              )}
              {pm25 !== undefined && (
                <LuxBadge variant={pm25 > 35 ? "error" : "gold"}>🌫️ {Math.round(pm25)}</LuxBadge>
              )}
            </div>
          )}

          {fanCap && fanValue !== undefined && speedModes.length === 0 && (
            <div className="w-full">
              <LuxBar
                value={fanValue}
                min={fanMin}
                max={fanMax}
                step={1}
                label="Скорость"
                display={(v) => `${v}`}
                onChange={setFanLevel}
              />
            </div>
          )}

          {speedModes.length > 0 && (
            <div className="w-full">
              <span className="text-[10px] text-slate-400 block mb-1 text-center">Скорость</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {speedModes.map((m: string) => (
                  <LuxButton
                    key={m}
                    type="button"
                    variant={speedValue === m ? "gold" : "quiet"}
                    glow={speedValue === m}
                    onClick={() => setSpeed(m)}
                    className="px-2 py-1 text-[9px]"
                  >
                    {getSpeedLabel(m)}
                  </LuxButton>
                ))}
              </div>
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
