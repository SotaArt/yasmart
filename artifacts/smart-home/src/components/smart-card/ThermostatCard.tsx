import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  getDeviceIcon,
  isDeviceOn,
  getAcTemperature,
  getSensorReadings,
  type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { CardFrame, CardMetric } from "./premium";

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

export function ThermostatCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
}: ThermostatCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const tempInfo = getAcTemperature(device);
  const targetTemp = tempInfo.value;
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
          title: newValue ? "Термостат включён" : "Термостат выключен",
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
      metric={
        <CardMetric
          value={
            currentTemp !== undefined
              ? `${currentTemp.toFixed(1)}°`
              : targetTemp !== undefined
                ? `${Math.round(targetTemp * 2) / 2}°`
                : "—"
          }
          label={currentTemp !== undefined ? "сейчас" : "цель"}
        />
      }
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
