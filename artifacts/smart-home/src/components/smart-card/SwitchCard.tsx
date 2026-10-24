import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { isDeviceOn, getDeviceIcon, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { PowerPill, CardFrame } from "./premium";

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

function getToggleChannels(device: Device): { instance: string; value: boolean; label: string }[] {
  return (device.capabilities ?? [])
    .filter((c: any) => c.type === "devices.capabilities.on_off")
    .map((c: any, idx: number) => ({
      instance: c.state?.instance ?? `on_${idx}`,
      value: c.state?.value ?? false,
      label: c.state?.instance === "on" ? "Основной" : `Канал ${idx + 1}`,
    }));
}

export function SwitchCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: SwitchCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const channels = getToggleChannels(device);
  const isMultiChannel = channels.length > 1;

  const toggleChannel = (instance: string, newValue: boolean) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.on_off" && c.state?.instance === instance
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
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance, value: newValue } }] },
      })
    ).then(() => {
      toast({ variant: "success", title: newValue ? "Канал включён" : "Канал выключен", description: `${device.name} (${instance})` });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить канал ${device.name}` });
    });
  };

  const primary = channels[0]?.value ?? isOn;

  return (
    <CardFrame
      size={size}
      variant="toggle"
      active={primary}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      power={isMultiChannel ? false : { on: primary, onChange: (v) => toggleChannel(channels[0]?.instance ?? "on", v), label: device.name }}
      timer
      bottom={
        isMultiChannel ? (
          <div className="w-full space-y-1.5">
            {channels.map((ch) => (
              <div key={ch.instance}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/40 transition-colors"
              >
                <span className="text-[10px] text-slate-400">{ch.label}</span>
                <div className="flex items-center gap-2">
                  <PowerPill
                    size="sm"
                    on={ch.value}
                    onChange={(v) => toggleChannel(ch.instance, v)}
                    label={`${device.name} · ${ch.label}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}
