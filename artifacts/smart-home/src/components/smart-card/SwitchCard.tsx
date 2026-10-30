import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { isDeviceOn, getDeviceIcon, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame, CardMetric } from "./premium";

interface SwitchCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

function getToggleChannels(
  device: Device
): { instance: string; value: boolean; label: string }[] {
  return (device.capabilities ?? [])
    .filter((c: any) => c.type === "devices.capabilities.on_off")
    .map((c: any, idx: number) => ({
      instance: c.state?.instance ?? `on_${idx}`,
      value: c.state?.value ?? false,
      label: c.state?.instance === "on" ? "Основной" : `Канал ${idx + 1}`,
    }));
}

export function SwitchCard({ device, token, size, tileConfig }: SwitchCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const channels = getToggleChannels(device);
  const isMultiChannel = channels.length > 1;
  const activeChannels = channels.filter((channel) => channel.value).length;

  const toggleAll = (newValue: boolean) => {
    if (channels.length === 0) return;
    const instances = channels.map((channel) => channel.instance);

    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) => {
              const instance = c.state?.instance ?? c.parameters?.instance;
              return c.type === "devices.capabilities.on_off" && instances.includes(instance)
                ? { ...c, state: { ...(c.state ?? {}), value: newValue } }
                : c;
            }),
          };
        }),
      };
    });

    deviceCommandQueue
      .add(() =>
        controlDevice.mutateAsync({
          deviceId: device.id,
          data: {
            actions: instances.map((instance) => ({
              type: "devices.capabilities.on_off",
              state: { instance, value: newValue },
            })),
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
          description: `Не удалось изменить ${device.name}`,
        });
      });
  };

  return (
    <CardFrame
      size={size}
      variant="toggle"
      active={isOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      labelOn={isMultiChannel ? `Включено ${activeChannels} из ${channels.length}` : undefined}
      metric={
        isMultiChannel ? (
          <CardMetric value={`${activeChannels}/${channels.length}`} label="каналы" />
        ) : undefined
      }
      power={
        channels.length > 0
          ? { on: isMultiChannel ? activeChannels > 0 : isOn, onChange: toggleAll, label: device.name }
          : false
      }
      timer
    />
  );
}
