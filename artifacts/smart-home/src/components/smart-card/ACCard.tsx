import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import { isDeviceOn, getDeviceIcon } from "@/lib/yandex";
import type { Device } from "@/lib/yandex";
import { LuxButton, LuxTempControl, CardFrame } from "./premium";
import {
  Snowflake, Flame, Droplets, Wind, Sparkles, Moon, Zap, Activity, Fan, Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function getCapVal(device: Device, instance: string, fallback: any) {
  const cap = device.capabilities?.find(c => c.state?.instance === instance);
  return cap?.state?.value ?? fallback;
}

function getModes(device: Device, instance: string): string[] {
  const cap = device.capabilities?.find(c => c.type === "devices.capabilities.mode" && c.state?.instance === instance);
  return (cap?.parameters?.modes?.map((m: any) => (typeof m === "string" ? m : m.value)) ?? []) as string[];
}

function getRange(device: Device, instance: string): { min: number; max: number } {
  const cap = device.capabilities?.find(c => c.type === "devices.capabilities.range" && c.state?.instance === instance);
  return { min: cap?.parameters?.min_value ?? 0, max: cap?.parameters?.max_value ?? 100 };
}

function hasCap(device: Device, type: string, instance?: string): boolean {
  return device.capabilities?.some(c => c.type === type && (instance === undefined || c.state?.instance === instance)) ?? false;
}

const MODE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  auto: { label: "Авто", Icon: Sparkles },
  cool: { label: "Охлаждение", Icon: Snowflake },
  heat: { label: "Обогрев", Icon: Flame },
  dry: { label: "Осушение", Icon: Droplets },
  fan: { label: "Вентиляция", Icon: Wind },
  fan_only: { label: "Вентиляция", Icon: Wind },
  warm: { label: "Тепло", Icon: Flame },
  quiet: { label: "Тихий", Icon: Moon },
  turbo: { label: "Турбо", Icon: Zap },
};

const FAN_MODE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  auto: { label: "Авто", Icon: Sparkles },
  low: { label: "Слабо", Icon: Wind },
  medium: { label: "Средне", Icon: Wind },
  high: { label: "Сильно", Icon: Wind },
  quiet: { label: "Тихий", Icon: Moon },
  turbo: { label: "Турбо", Icon: Zap },
};

const SWING_MODE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  auto: { label: "Авто", Icon: Sparkles },
  stop: { label: "Стоп", Icon: Moon },
  low: { label: "Слабо", Icon: Waves },
  medium: { label: "Средне", Icon: Waves },
  high: { label: "Сильно", Icon: Waves },
};

export function ACCard({ device, token, size = "expanded", tileConfig, onPin, onDelete, onResize, onToggleCompact }: ACCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({ request: { headers: { "x-yandex-token": token } } });
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;

  const hasOnOff = hasCap(device, "devices.capabilities.on_off");
  const hasTemp = hasCap(device, "devices.capabilities.range", "temperature");
  const hasMode = hasCap(device, "devices.capabilities.mode", "thermostat");

  const fanCap = device.capabilities?.find(c => c.state?.instance === "fan_speed");
  const hasFanSpeed = !!fanCap;
  const fanIsMode = fanCap?.type === "devices.capabilities.mode";
  const fanModes = fanIsMode ? getModes(device, "fan_speed") : [];
  const fanRange = fanIsMode ? { min: 0, max: 0 } : getRange(device, "fan_speed");
  const fanLevels = useMemo(() => (
    fanIsMode
      ? fanModes
      : fanRange.max > fanRange.min
        ? Array.from({ length: fanRange.max - fanRange.min + 1 }, (_, i) => fanRange.min + i)
        : []
  ), [fanIsMode, fanModes, fanRange]);

  const swingCap = device.capabilities?.find(c => c.state?.instance === "swing");
  const hasSwing = !!swingCap;
  const swingIsToggle = swingCap?.type === "devices.capabilities.toggle";
  const swingModes = !swingIsToggle ? getModes(device, "swing") : [];

  const tempRange = useMemo(() => getRange(device, "temperature"), [device]);
  const modes = useMemo(() => getModes(device, "thermostat"), [device]);

  const [localOn, setLocalOn] = useState(isDeviceOn(device));
  const [targetTemp, setTargetTemp] = useState(getCapVal(device, "temperature", tempRange.min + 5));
  const [fan, setFan] = useState(getCapVal(device, "fan_speed", fanIsMode ? fanModes[0] : 1));
  const [mode, setMode] = useState(getCapVal(device, "thermostat", modes[0] ?? "auto"));
  const [swing, setSwing] = useState(getCapVal(device, "swing", swingIsToggle ? false : swingModes[0]));

  useEffect(() => {
    setLocalOn(isDeviceOn(device));
    const t = getCapVal(device, "temperature", undefined);
    if (t !== undefined) setTargetTemp(t);
    const f = getCapVal(device, "fan_speed", undefined);
    if (f !== undefined) setFan(f);
    const m = getCapVal(device, "thermostat", undefined);
    if (m !== undefined) setMode(m);
    const s = getCapVal(device, "swing", undefined);
    if (s !== undefined) setSwing(s);
  }, [device]);

  const sendAction = (actionType: string, instance: string, value: any) => {
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions: [{ type: actionType, state: { instance, value } }] },
      })
    ).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить ${device.name}` });
    });
  };

  const patchCapability = (capType: string, instance: string, value: any) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return { ...old, devices: old.devices.map((d: any) => {
        if (d.id !== device.id) return d;
        return { ...d, capabilities: d.capabilities.map((c: any) =>
          c.type === capType && c.state?.instance === instance
            ? { ...c, state: { ...(c.state ?? {}), value } }
            : c
        )};
      })};
    });
  };

  const toggleDevice = (newValue: boolean) => {
    setLocalOn(newValue);
    patchCapability("devices.capabilities.on_off", "on", newValue);
    sendAction("devices.capabilities.on_off", "on", newValue);
  };

  const changeTemp = (v: number) => {
    const clamped = Math.min(tempRange.max, Math.max(tempRange.min, v));
    setTargetTemp(clamped);
    patchCapability("devices.capabilities.range", "temperature", clamped);
    sendAction("devices.capabilities.range", "temperature", clamped);
  };

  const changeFan = (v: string | number) => {
    setFan(v);
    if (fanIsMode) {
      patchCapability("devices.capabilities.mode", "fan_speed", v);
      sendAction("devices.capabilities.mode", "fan_speed", v);
    } else {
      patchCapability("devices.capabilities.range", "fan_speed", v);
      sendAction("devices.capabilities.range", "fan_speed", v);
    }
  };

  const changeSwing = (v: string | boolean) => {
    setSwing(v);
    if (swingIsToggle) {
      patchCapability("devices.capabilities.toggle", "swing", v);
      sendAction("devices.capabilities.toggle", "swing", v);
    } else {
      patchCapability("devices.capabilities.mode", "swing", v);
      sendAction("devices.capabilities.mode", "swing", v);
    }
  };

  const changeMode = (m: string) => {
    setMode(m);
    patchCapability("devices.capabilities.mode", "thermostat", m);
    sendAction("devices.capabilities.mode", "thermostat", m);
  };

  const currentFanLabel = fanIsMode
    ? (FAN_MODE_META[String(fan)]?.label ?? String(fan))
    : `Уровень ${fan}`;

  return (
    <CardFrame
      size={size}
      variant="thermostat"
      active={localOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      subtitle="Кондиционер"
      power={hasOnOff ? { on: localOn, onChange: toggleDevice, label: device.name } : false}
      timer
      top={
        hasTemp ? (
          <LuxTempControl
            value={targetTemp}
            min={tempRange.min}
            max={tempRange.max}
            step={1}
            label="Целевая температура"
            displayClassName={size === "full" ? "text-4xl" : "text-3xl"}
            onChange={(v) => changeTemp(v)}
          />
        ) : undefined
      }
      bottom={
        <div className={`w-full space-y-3 transition-opacity duration-300 ${localOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {hasFanSpeed && fanLevels.length > 0 && (
            <div>
              <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400 mb-1.5 block">
                Скорость обдува · {currentFanLabel}
              </span>
              <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex gap-1">
                {fanLevels.map((s) => {
                  const isActive = fan === s;
                  return (
                    <LuxButton
                      key={String(s)}
                      type="button"
                      variant={isActive ? "gold" : "quiet"}
                      glow={isActive}
                      onClick={() => changeFan(s)}
                      className="flex-1 h-8 py-0 text-xs font-bold"
                    >
                      {fanIsMode ? (FAN_MODE_META[String(s)]?.label ?? String(s)) : s}
                    </LuxButton>
                  );
                })}
              </div>
            </div>
          )}

          {hasMode && modes.length > 0 && (
            <div>
              <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400 mb-1.5 block">
                Режим работы
              </span>
              <div className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.min(modes.length, 6)}, minmax(0, 1fr))` }}>
                {modes.map((m) => {
                  const meta = MODE_META[m] ?? { label: m, Icon: Activity };
                  const Icon = meta.Icon;
                  const active = mode === m;
                  return (
                    <LuxButton
                      key={m}
                      type="button"
                      variant={active ? "gold" : "quiet"}
                      glow={active}
                      onClick={() => changeMode(m)}
                      className="flex-1 min-w-[64px] h-auto py-2 px-1"
                    >
                      <span className="flex flex-col items-center gap-1">
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px]">{meta.label}</span>
                      </span>
                    </LuxButton>
                  );
                })}
              </div>
            </div>
          )}

          {hasSwing && (
            <div>
              <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400 mb-1.5 block">
                Воздушная шторка
              </span>
              {swingIsToggle ? (
                <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <LuxButton
                    type="button"
                    variant={swing ? "gold" : "quiet"}
                    glow={!!swing}
                    onClick={() => changeSwing(!swing)}
                    className="w-full h-8 py-0 text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <Fan className="w-3.5 h-3.5" />
                      {swing ? "Качание вкл" : "Качание выкл"}
                    </span>
                  </LuxButton>
                </div>
              ) : (swingModes.length > 0) ? (
                <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex gap-1">
                  {swingModes.map((s) => {
                    const meta = SWING_MODE_META[s] ?? { label: s, Icon: Waves };
                    const Icon = meta.Icon;
                    const active = swing === s;
                    return (
                      <LuxButton
                        key={s}
                        type="button"
                        variant={active ? "gold" : "quiet"}
                        glow={active}
                        onClick={() => changeSwing(s)}
                        className="flex-1 h-8 py-0 text-[10px]"
                      >
                        <span className="flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                      </LuxButton>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      }
    />
  );
}
