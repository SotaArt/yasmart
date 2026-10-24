import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import {
  getDeviceIcon, getDeviceCapability,
  type Device, type DeviceCapability,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { LuxButton, LuxBadge, CardFrame } from "./premium";


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

function getModeValue(cap: DeviceCapability | undefined): string | undefined {
  return cap?.state?.value as string | undefined;
}

const SPEED_LABELS: Record<string, string> = {
  auto: "Авто", eco: "Эко", quiet: "Тихая", silent: "Тихая",
  low: "Низкая", slow: "Низкая", medium: "Средняя",
  high: "Высокая", strong: "Высокая", efficient: "Эффективная", balanced: "Сбалансированная",
  turbo: "Турбо", power: "Максимум", max: "Максимум", max_1: "Максимум",
  normal: "Обычная", standard: "Обычная", gentle: "Бережная",
};

const CLEAN_LABELS: Record<string, string> = {
  auto: "Авто", eco: "Эко", express: "Экспресс", normal: "Обычная", quiet: "Тихая",
  dry_cleaning: "Сухая", dry: "Сухая", dry_clean: "Сухая", sweep: "Сухая", vacuum: "Сухая",
  wet_cleaning: "Влажная", wet: "Влажная", wet_clean: "Влажная", mop: "Влажная",
  mixed_cleaning: "Сухая + влажная", dry_wet: "Сухая + влажная",
  dry_wet_clean: "Сухая + влажная", both: "Сухая + влажная",
};

/** Возвращает русский лейбл; ничего неизвестного не печатаем (никакого английского) */
function getLabel(map: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase();
  return map[key] ?? undefined;
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
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: VacuumCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const onOffCap = getDeviceCapability(device, "devices.capabilities.on_off");
  const isOn = onOffCap?.state?.value === true;
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;

  // Скорость всасывания (work_speed) — допускается и legacy-имя fan_speed
  const fanCap = getDeviceCapability(device, "devices.capabilities.mode", "work_speed")
    ?? getDeviceCapability(device, "devices.capabilities.mode", "fan_speed");
  const rawFanModes = (fanCap?.parameters?.modes ?? []).map((m: { value: string }) => m.value);
  const fanValue = getModeValue(fanCap);

  // Тип уборки (cleanup_mode): сухая / влажная / сухая+влажная
  const cleanCap = getDeviceCapability(device, "devices.capabilities.mode", "cleanup_mode")
    ?? getDeviceCapability(device, "devices.capabilities.mode", "cleaning");
  const rawCleanModes = (cleanCap?.parameters?.modes ?? []).map((m: { value: string }) => m.value);
  const cleanValue = getModeValue(cleanCap);

  // Пауза (toggle pause)
  const pauseCap = getDeviceCapability(device, "devices.capabilities.toggle", "pause");
  const isPaused = pauseCap ? toBool(pauseCap.state?.value) : false;

  // Датчики
  const battery = getPropertyValue(device, "battery_level");
  const batteryPct = typeof battery === "number" ? battery
    : typeof battery === "string" ? Number(battery) : undefined;
  const charging = toBool(getPropertyValue(device, "battery_charging"));
  const waterLevel = getPropertyValue(device, "water_level");
  const waterPct = typeof waterLevel === "number" ? waterLevel
    : typeof waterLevel === "string" ? Number(waterLevel) : undefined;

  const status = resolveStatus(device, isOn, isPaused);
  const showControls = size !== "compact";
  const big = size === "full";

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
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }] },
      },
      {
        onSuccess: () => {
          toast({ variant: "success", title: newValue ? "Уборка запущена" : "Уборка остановлена", description: device.name });
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
          toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
        },
      }
    );
  };

  const handleReturnHome = () => {
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: false } }] },
    }, {
      onSuccess: () => {
        toast({ variant: "success", title: "Возвращается на базу", description: device.name });
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      },
    });
  };

  const setMode = (cap: DeviceCapability | undefined, value: string) => {
    const instance = cap?.state?.instance;
    if (!instance) return;
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.mode", state: { instance, value } }] },
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }),
      onError: () => {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить режим ${device.name}` });
      },
    });
  };

  const handlePause = (value: boolean) => {
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.toggle", state: { instance: "pause", value } }] },
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }),
      onError: () => {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        toast({ variant: "destructive", title: "Ошибка", description: `Не удалось поставить на паузу ${device.name}` });
      },
    });
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
      subtitle="Робот-пылесос"
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
      top={
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className={`font-bold text-foreground leading-none ${size === "compact" ? "text-base" : big ? "text-2xl" : "text-xl"} ${status.className}`}>
            {status.label}
          </span>
          {batteryPct !== undefined && (
            <LuxBadge variant={batteryPct > 20 ? "gold" : "error"} active={batteryPct > 20}>
              🔋 {batteryPct}%{charging ? " ⚡" : ""}
            </LuxBadge>
          )}
          {big && waterPct !== undefined && (
            <LuxBadge variant="muted" active>💧 {Math.round(waterPct)}%</LuxBadge>
          )}
        </div>
      }
      bottom={
        <div className={`w-full space-y-1 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {showControls && (rawCleanModes.length > 0 || rawFanModes.length > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              {rawCleanModes.map((value: string) => {
                const label = getLabel(CLEAN_LABELS, value);
                if (!label) return null;
                return (
                  <LuxButton
                    key={value}
                    type="button"
                    variant={cleanValue === value ? "gold" : "quiet"}
                    glow={cleanValue === value}
                    onClick={() => setMode(cleanCap, value)}
                    className="px-2 py-1 text-[9px]"
                  >
                    {label}
                  </LuxButton>
                );
              })}
              {rawCleanModes.length > 0 && rawFanModes.length > 0 && (
                <span className="text-slate-500 text-[9px]">|</span>
              )}
              {rawFanModes.map((value: string) => {
                const label = getLabel(SPEED_LABELS, value);
                if (!label) return null;
                return (
                  <LuxButton
                    key={value}
                    type="button"
                    variant={fanValue === value ? "gold" : "quiet"}
                    glow={fanValue === value}
                    onClick={() => setMode(fanCap, value)}
                    className="px-2 py-1 text-[9px]"
                  >
                    {label}
                  </LuxButton>
                );
              })}
            </div>
          )}

          {showControls && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {isOn && pauseCap && (
                <LuxButton type="button" variant="action" onClick={() => handlePause(!isPaused)}>
                  {isPaused ? "▶ Продолжить" : "⏸ Пауза"}
                </LuxButton>
              )}
              <LuxButton type="button" variant="gold-ghost" glow onClick={handleReturnHome}>
                🏠 На базу
              </LuxButton>
            </div>
          )}
        </div>
      }
    />
  );
}