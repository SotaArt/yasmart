import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  getDeviceIcon,
  isDeviceOn,
  getDeviceCapability,
  type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { CardFrame, CardMetric } from "./premium";

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
  auto: "Авто",
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  maximum: "Максимум",
  max: "Макс",
  min: "Мин",
  turbo: "Турбо",
  quiet: "Тихий",
  night: "Ночь",
  normal: "Обычный",
  min_1: "Низкая1",
};

function getSpeedLabel(value: string | undefined): string {
  if (!value) return "";
  return SPEED_LABELS[value] ?? value;
}

export function ClimateCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
}: ClimateCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const speedModeCap =
    getDeviceCapability(device, "devices.capabilities.mode", "work_speed") ??
    getDeviceCapability(device, "devices.capabilities.mode", "fan_speed");
  const speedValue = speedModeCap?.state?.value as string | undefined;

  const fanCap =
    getDeviceCapability(device, "devices.capabilities.range", "fan_speed") ??
    getDeviceCapability(device, "devices.capabilities.range", "work_speed");
  const fanValue = fanCap?.state?.value as number | undefined;

  const humidity = device.properties?.find((p) => p.parameters?.instance === "humidity")
    ?.state?.value as number | undefined;
  const pm25 = device.properties?.find((p) => p.parameters?.instance === "pm2.5_density")
    ?.state?.value as number | undefined;
  const temp = device.properties?.find((p) => p.parameters?.instance === "temperature")
    ?.state?.value as number | undefined;

  const mainValue =
    humidity !== undefined
      ? `${Math.round(humidity)}%`
      : pm25 !== undefined
        ? `${Math.round(pm25)}`
        : fanValue !== undefined
          ? getSpeedLabel(speedValue) || `${fanValue}`
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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      handleLongPressStart(e, contextMenuItems);
    },
    [contextMenuItems, handleLongPressStart]
  );

  const handleToggle = () => {
    const newValue = !isOn;
    const instance =
      device.capabilities?.find((c) => c.type === "devices.capabilities.on_off")
        ?.state?.instance ?? "on";

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
                ? { ...c, state: { ...(c.state ?? {}), instance, value: newValue } }
                : c
            ),
          };
        }),
      };
    });

    deviceCommandQueue
      .add(() =>
        controlDevice.mutateAsync({
          deviceId: device.id,
          data: {
            actions: [
              { type: "devices.capabilities.on_off", state: { instance, value: newValue } },
            ],
          },
        })
      )
      .then(() => {
        toast({
          variant: "success",
          title: newValue ? "Включено" : "Выключено",
          description: device.name,
        });
      })
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: `Не удалось изменить состояние ${device.name}`,
        });
      });
  };

  const metric = temp !== undefined
    ? { value: `${temp.toFixed(1)}°`, label: humidity !== undefined ? `💧 ${Math.round(humidity)}%` : "температура" }
    : humidity !== undefined
      ? { value: `${Math.round(humidity)}%`, label: "влажность" }
      : pm25 !== undefined
        ? { value: `${Math.round(pm25)}`, label: "PM2.5" }
        : { value: mainValue, label: "режим" };

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
      metric={<CardMetric value={metric.value} label={metric.label} />}
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
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
