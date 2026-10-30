import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import {
  getDeviceIcon,
  getDeviceCapability,
  type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { CardFrame, CardMetric } from "./premium";

function getPropertyValue(device: Device, instance: string): unknown {
  const prop = (device.properties ?? []).find(
    (p) => p.parameters?.instance === instance && p.state?.value !== undefined
  );
  return prop?.state?.value;
}

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getPropBool(device: Device, instance: string): boolean | undefined {
  const v = getPropertyValue(device, instance);
  if (v === undefined || v === null) return undefined;
  return toBool(v);
}

function getError(device: Device): string | undefined {
  const v = getPropertyValue(device, "error");
  if (v === undefined || v === null || v === 0 || v === "0" || v === "0.0") return undefined;
  if (Array.isArray(v)) {
    const parts = v.map((x: any) => x?.value).filter((x: unknown) => x);
    return parts.length ? String(parts.join(", ")) : undefined;
  }
  return String(v);
}

type VacuumStatus =
  | { kind: "active"; label: string; className: string }
  | { kind: "paused"; label: string; className: string }
  | { kind: "error"; label: string; className: string }
  | { kind: "charging"; label: string; className: string }
  | { kind: "idle"; label: string; className: string };

/**
 * Статус пылесоса. Читает живые properties устройства:
 * cleaning / battery_charging / drying / docked / error.
 * Если событийных свойств нет — откатывается на on_off + pause.
 */
function resolveStatus(device: Device, isOn: boolean, isPaused: boolean): VacuumStatus {
  const gold = "text-[#f3e5ab]";
  const err = getError(device);
  if (err !== undefined) {
    return { kind: "error", label: "Ошибка", className: "text-destructive" };
  }

  const cleaning = getPropBool(device, "cleaning");
  if (cleaning === true && !isPaused) {
    return { kind: "active", label: "Убирается", className: gold };
  }
  if (isPaused && (isOn || cleaning === true)) {
    return { kind: "paused", label: "Пауза", className: "text-sky-300" };
  }

  const drying = ["mop_drying", "mop_dry", "drying", "dry_mode"]
    .some((i) => getPropBool(device, i) === true);
  if (drying) {
    return { kind: "charging", label: "Сушится", className: "text-sky-300" };
  }

  const charging = ["battery_charging", "charging"]
    .some((i) => getPropBool(device, i) === true);
  if (charging) {
    return { kind: "charging", label: "Заряжается", className: "text-device-success" };
  }

  if (cleaning === false && !isOn) {
    return { kind: "idle", label: "Уборка закончена", className: "text-muted-foreground" };
  }

  const docked = ["docked", "docking", "charger_connected"]
    .some((i) => getPropBool(device, i) === true);
  if (docked) {
    return { kind: "idle", label: "На базе", className: "text-muted-foreground" };
  }

  if (isOn) {
    return { kind: "active", label: "Уборка", className: gold };
  }
  if (cleaning === false) {
    return { kind: "idle", label: "Готов", className: "text-muted-foreground" };
  }
  return { kind: "idle", label: "На базе", className: "text-muted-foreground" };
}

interface VacuumCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function VacuumCard({
  device,
  token,
  size,
  tileConfig,
}: VacuumCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const onOffCap = getDeviceCapability(device, "devices.capabilities.on_off");
  const isOn = onOffCap?.state?.value === true;
  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;

  const pauseCap = getDeviceCapability(device, "devices.capabilities.toggle", "pause");
  const isPaused = pauseCap ? toBool(pauseCap.state?.value) : false;

  const battery = getPropertyValue(device, "battery_level");
  const batteryPct =
    typeof battery === "number"
      ? battery
      : typeof battery === "string"
        ? Number(battery)
        : undefined;
  const charging = toBool(getPropertyValue(device, "battery_charging"));
  const waterLevel = getPropertyValue(device, "water_level");
  const waterPct =
    typeof waterLevel === "number"
      ? waterLevel
      : typeof waterLevel === "string"
        ? Number(waterLevel)
        : undefined;

  const status = resolveStatus(device, isOn, isPaused);

  const handleToggle = (newValue: boolean) => {
    const instance = onOffCap?.state?.instance ?? "on";
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
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: {
          actions: [
            { type: "devices.capabilities.on_off", state: { instance, value: newValue } },
          ],
        },
      },
      {
        onSuccess: () => {
          toast({
            variant: "success",
            title: newValue ? "Уборка запущена" : "Уборка остановлена",
            description: device.name,
          });
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: `Не удалось изменить состояние ${device.name}`,
          });
        },
      }
    );
  };

  return (
    <CardFrame
      size={size}
      variant="vacuum"
      active={isOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      labelOn={status.label}
      metric={
        batteryPct !== undefined ? (
          <CardMetric
            value={`${Math.round(batteryPct)}%${charging ? " ⚡" : ""}`}
            label={waterPct !== undefined ? `💧 ${Math.round(waterPct)}%` : "заряд"}
            tone={batteryPct > 20 ? "gold" : "error"}
          />
        ) : undefined
      }
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
    />
  );
}
