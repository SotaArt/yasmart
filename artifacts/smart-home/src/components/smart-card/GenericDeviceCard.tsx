import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { getDeviceIcon, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame, CardMetric } from "./premium";

interface GenericDeviceCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

function getCapabilitySummary(device: Device): { label: string; value: string; active?: boolean }[] {
  const caps: { label: string; value: string; active?: boolean }[] = [];
  for (const c of device.capabilities ?? []) {
    if (c.type === "devices.capabilities.on_off") {
      caps.push({ label: "Питание", value: c.state?.value ? "ВКЛ" : "ВЫКЛ", active: !!c.state?.value });
    } else if (c.type === "devices.capabilities.range") {
      const inst = c.state?.instance ?? "";
      const val = c.state?.value;
      if (val !== undefined) {
        caps.push({ label: inst, value: String(val) });
      }
    } else if (c.type === "devices.capabilities.mode") {
      caps.push({ label: "Режим", value: String(c.state?.value ?? "—") });
    }
  }
  return caps;
}

function getIsOn(device: Device): boolean {
  return getCapabilitySummary(device).find((c) => c.label === "Питание")?.value === "ВКЛ";
}

export function GenericDeviceCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: GenericDeviceCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const caps = getCapabilitySummary(device);
  const isOn = getIsOn(device);
  const canToggle = caps.some((c) => c.label === "Питание");
  const firstInfo = caps.find((c) => c.label !== "Питание");

  const handleToggle = (newValue: boolean) => {
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
      toast({ variant: "success", title: newValue ? "Устройство включено" : "Устройство выключено", description: device.name });
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
        firstInfo ? (
          <CardMetric value={firstInfo.value} label={firstInfo.label} />
        ) : undefined
      }
      power={canToggle ? { on: isOn, onChange: handleToggle, label: device.name } : false}
      timer={canToggle}
    />
  );
}
