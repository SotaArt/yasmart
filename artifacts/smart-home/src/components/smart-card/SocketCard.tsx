import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { isDeviceOn, getDeviceIcon, getDeviceProperty, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame, CardMetric } from "./premium";


interface SocketCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

function getPower(device: Device): number | undefined {
  const prop = getDeviceProperty(device, "power");
  return prop?.state?.value as number | undefined;
}

export function SocketCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: SocketCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const power = getPower(device);

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
      toast({ variant: "success", title: newValue ? "Розетка включена" : "Розетка выключена", description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
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
      metric={
        power !== undefined ? (
          <CardMetric value={`${Math.round(power)} Вт`} label="мощность" />
        ) : undefined
      }
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
    />
  );
}
