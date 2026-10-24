import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { isDeviceOn, hasToggle, getDeviceCapability, getDeviceIcon, type Device } from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { Shield, ShieldAlert, ShieldCheck, Lock, Unlock, AlertTriangle } from "lucide-react";
import { CardFrame } from "./premium";


interface SecurityCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

type SecurityState = "armed" | "disarmed" | "alert" | "locked" | "unlocked" | "unknown";

function getSecurityState(device: Device): SecurityState {
  const isOn = isDeviceOn(device);
  const type = device.type;

  if (type.includes("alarm") || type.includes("security")) {
    return isOn ? "armed" : "disarmed";
  }
  if (type.includes("lock")) {
    const lockCap = getDeviceCapability(device, "devices.capabilities.toggle", "lock");
    const locked = lockCap ? lockCap.state?.value === true : isOn;
    return locked ? "locked" : "unlocked";
  }
  if (type.includes("sensor")) {
    const hasAlert = device.properties?.some(
      (p) => p.type === "devices.properties.event" && p.state?.value !== null
    );
    if (hasAlert) return "alert";
    return isOn ? "armed" : "disarmed";
  }
  return isOn ? "armed" : "disarmed";
}

const stateConfig: Record<SecurityState, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}> = {
  armed: {
    label: "ОХРАНА",
    color: "text-device-success",
    bgColor: "bg-device-success/10",
    borderColor: "border-device-success/40",
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  disarmed: {
    label: "СНЯТО",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border/40",
    icon: <Shield className="w-4 h-4" />,
  },
  alert: {
    label: "ТРЕВОГА",
    color: "text-device-error",
    bgColor: "bg-device-error/10",
    borderColor: "border-device-error/40",
    icon: <ShieldAlert className="w-4 h-4 animate-pulse" />,
  },
  locked: {
    label: "ЗАБЛОКИРОВАНО",
    color: "text-device-success",
    bgColor: "bg-device-success/10",
    borderColor: "border-device-success/40",
    icon: <Lock className="w-4 h-4" />,
  },
  unlocked: {
    label: "ОТКРЫТО",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/40",
    icon: <Unlock className="w-4 h-4" />,
  },
  unknown: {
    label: "НЕИЗВЕСТНО",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border/40",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

export function SecurityCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: SecurityCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const state = getSecurityState(device);
  const config = stateConfig[state];
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const lockCap = getDeviceCapability(device, "devices.capabilities.toggle", "lock");
  const canToggle = lockCap ? true : hasToggle(device);
  const useLock = !!lockCap;

  const handleToggle = () => {
    if (!canToggle) return;
    const newValue = lockCap ? lockCap.state?.value !== true : !isDeviceOn(device);
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              (c.type === "devices.capabilities.toggle" && c.state?.instance === "lock") ||
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
        data: {
          actions: useLock
            ? [{ type: "devices.capabilities.toggle", state: { instance: "lock", value: newValue } }]
            : [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }],
        },
      })
    ).then(() => {
      const action = useLock
        ? newValue ? "Замок заблокирован" : "Замок открыт"
        : newValue ? "Охрана включена" : "Охрана снята";
      toast({ variant: "success", title: action, description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!canToggle) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <CardFrame
      size={size}
      variant="security"
      active={state === "armed" || state === "locked" || state === "alert"}
      pinned={isPinned}
      onClick={canToggle ? handleToggle : undefined}
      onKeyDown={canToggle ? handleKeyDown : undefined}
      alertClassName={state === "alert" ? "border-device-error/60 shadow-[0_0_20px_hsl(var(--device-error)/0.3)]" : undefined}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      power={canToggle ? { on: state === "armed" || state === "locked", onChange: () => handleToggle(), label: device.name } : false}
      timer={canToggle}
      top={
        <div className="mt-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg ${config.color} ${config.bgColor} border ${config.borderColor}`}>
            {config.icon}
            {config.label}
          </span>
        </div>
      }
      bottom={
        (size === "expanded" || size === "full") ? (
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span className="text-[10px] text-slate-400">Тип</span>
              <span className="text-[10px] font-mono text-foreground">
                {device.type.includes("lock") ? "Замок" : device.type.includes("alarm") ? "Сигнализация" : "Датчик"}
              </span>
            </div>
            {device.room_id && (
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <span className="text-[10px] text-slate-400">Помещение</span>
                <span className="text-[10px] font-mono text-foreground">{device.room_id}</span>
              </div>
            )}
          </div>
        ) : undefined
      }
      overlay={
        state === "alert" ? (
          <div className="absolute inset-0 rounded-lg border-2 border-device-error/40 animate-pulse pointer-events-none" />
        ) : undefined
      }
    />
  );
}
