import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { isDeviceOn, getDeviceIcon, getDeviceProperty, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame } from "./premium";


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

function getVoltage(device: Device): number | undefined {
  const prop = getDeviceProperty(device, "voltage");
  return prop?.state?.value as number | undefined;
}

function getCurrent(device: Device): number | undefined {
  const prop = getDeviceProperty(device, "electric_current");
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
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const power = getPower(device);
  const voltage = getVoltage(device);
  const current = getCurrent(device);

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
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
      top={
        <div className="flex items-baseline gap-1">
          <span className={`font-bold text-foreground leading-none ${size === "compact" ? "text-base" : "text-xl"} ${isOn && "text-[#f3e5ab]"}`}>
            {power !== undefined ? `${Math.round(power)} Вт` : "—"}
          </span>
        </div>
      }
      bottom={
        <div className={`w-full space-y-1 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {(size === "expanded" || size === "full") && (
            <div className="w-full space-y-1">
              {power !== undefined && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400">Мощность</span>
                  <span className="text-[11px] font-mono font-semibold text-[#f3e5ab]">{Math.round(power)} Вт</span>
                </div>
              )}
              {voltage !== undefined && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400">Напряжение</span>
                  <span className="text-[11px] font-mono text-slate-300">{Math.round(voltage)} В</span>
                </div>
              )}
              {current !== undefined && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
                  <span className="text-[10px] text-slate-400">Ток</span>
                  <span className="text-[11px] font-mono text-slate-300">{current.toFixed(1)} А</span>
                </div>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}
