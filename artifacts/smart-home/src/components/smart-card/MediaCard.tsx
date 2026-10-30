import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { getDeviceIcon, isDeviceOn, getDeviceCapability, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame, CardMetric } from "./premium";


interface MediaCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function MediaCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: MediaCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;

  const playbackCap = getDeviceCapability(device, "devices.capabilities.mode", "playback");
  const hasPlayback = !!playbackCap;
  const isPlaying = playbackCap?.state?.value === "playing";

  const volumeCap = getDeviceCapability(device, "devices.capabilities.range", "volume");
  const hasVolume = !!volumeCap;
  const volume = (volumeCap?.state?.value as number) ?? 50;

  const handlePowerToggle = () => {
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
      toast({ variant: "success", title: newValue ? "Медиа включён" : "Медиа выключен", description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    });
  };

  return (
    <CardFrame
      size={size}
      variant="media"
      active={isOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      metric={
        hasVolume ? (
          <CardMetric value={`${Math.round(volume)}%`} label="громкость" />
        ) : hasPlayback ? (
          <CardMetric value={isPlaying ? "Играет" : "Пауза"} label="воспроизведение" />
        ) : undefined
      }
      power={{ on: isOn, onChange: handlePowerToggle, label: device.name }}
      timer
    />
  );
}
