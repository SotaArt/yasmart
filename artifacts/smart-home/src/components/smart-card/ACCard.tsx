import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import { isDeviceOn, getDeviceIcon } from "@/lib/yandex";
import type { Device } from "@/lib/yandex";
import { CardFrame, CardMetric } from "./premium";
import type { CardSize } from "./SmartCard";
import type { TileSize } from "@/hooks/use-panel-config";

interface ACCardProps {
  device: Device;
  token: string;
  size?: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function ACCard({ device, token, size = "expanded", tileConfig }: ACCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });
  const icon = getDeviceIcon(device.type, device.id);
  const isOn = isDeviceOn(device);
  const isPinned = tileConfig?.pinned ?? false;

  const onOffCap = device.capabilities?.find(
    (c) => c.type === "devices.capabilities.on_off"
  );
  const onOffInstance =
    (onOffCap?.state?.instance ?? onOffCap?.parameters?.instance ?? "on") as string;
  const tempCap = device.capabilities?.find(
    (c) =>
      c.type === "devices.capabilities.range" &&
      (c.state?.instance ?? c.parameters?.instance) === "temperature"
  );
  const targetTemp = tempCap?.state?.value as number | undefined;

  const sendAction = (actionType: string, instance: string, value: unknown) => {
    deviceCommandQueue
      .add(() =>
        controlDevice.mutateAsync({
          deviceId: device.id,
          data: { actions: [{ type: actionType, state: { instance, value } }] },
        })
      )
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: `Не удалось изменить ${device.name}`,
        });
      });
  };

  const patchCapability = (capType: string, instance: string, value: unknown) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) => {
              const currentInstance = c.state?.instance ?? c.parameters?.instance;
              return c.type === capType && currentInstance === instance
                ? { ...c, state: { ...(c.state ?? {}), instance, value } }
                : c;
            }),
          };
        }),
      };
    });
  };

  const toggleDevice = (newValue: boolean) => {
    patchCapability("devices.capabilities.on_off", onOffInstance, newValue);
    sendAction("devices.capabilities.on_off", onOffInstance, newValue);
  };

  return (
    <CardFrame
      size={size}
      variant="thermostat"
      active={isOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      metric={
        tempCap ? (
          <CardMetric
            value={targetTemp !== undefined ? `${Math.round(targetTemp * 2) / 2}°` : "—"}
            label="цель"
          />
        ) : undefined
      }
      power={
        onOffCap
          ? { on: isOn, onChange: toggleDevice, label: device.name }
          : false
      }
      timer
    />
  );
}
