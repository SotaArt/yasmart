import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useControlDevice,
} from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { SensorReadingsInline } from "@/components/sensors";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CopyableId } from "./components/copyable-id";
import { DeviceStatusBadge } from "./components/device-status-badge";
import { DeviceDetailsDialog } from "./components/device-details-dialog";
import { CameraStreamDialog } from "./components/camera-stream-dialog";
import {
  getDeviceIcon,
  getDeviceTypeLabel,
  getDeviceStatus,
  hasToggle,
  isAcDevice,
  getDeviceCapability,
  getAcMode,
  getAcModeOptions,
  getAcTemperature,
  getAcFanSpeed,
  AC_MODE_LABELS,
  getSignalInfo,
  type Device,
  type Room,
} from "@/lib/yandex";
import { Pin, PinOff, ChevronDown, Settings, Wifi, WifiOff, Radio, Power, Wrench, ChevronRight, MapPin, Eye, EyeOff, Star, Activity, Info, ArrowLeftRight } from "lucide-react";
import { logAction } from "./hooks/event-log";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useSensorDevices } from "@/hooks/use-sensor-devices";
import { useSensorInversions } from "@/hooks/use-sensor-inversions";
import { usePinnedSensors } from "@/hooks/use-pinned-sensors";
import { INVERTIBLE_INSTANCES, type InvertibleInstance } from "@/lib/sensor-inversions-store";

// Хранилище "избранных" устройств (roomId -> deviceId)
const FEATURED_DEVICE_KEY = "user_panel_featured_device_v1";

export function loadFeaturedDevices(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FEATURED_DEVICE_KEY) || "{}");
  } catch { return {}; }
}

export function saveFeaturedDevices(devices: Record<string, string>) {
  localStorage.setItem(FEATURED_DEVICE_KEY, JSON.stringify(devices));
}

const DEVICE_OVERRIDES_KEY = "eng_device_overrides_v1";

interface DeviceOverrides {
  [deviceId: string]: {
    customName?: string;
    roomId?: string;
    hidden?: boolean;
  };
}

function loadOverrides(): DeviceOverrides {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_OVERRIDES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveOverrides(overrides: DeviceOverrides) {
  localStorage.setItem(DEVICE_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function useDeviceOverrides() {
  const [overrides, setOverrides] = useState<DeviceOverrides>(loadOverrides);

  const updateOverride = useCallback((deviceId: string, patch: Partial<DeviceOverrides[string]>) => {
    setOverrides((prev) => {
      const next = { ...prev, [deviceId]: { ...prev[deviceId], ...patch } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const getDisplayName = useCallback((device: Device): string => {
    return overrides[device.id]?.customName ?? device.name;
  }, [overrides]);

  const getRoomOverride = useCallback((deviceId: string): string | undefined => {
    return overrides[deviceId]?.roomId;
  }, [overrides]);

  const isHidden = useCallback((deviceId: string): boolean => {
    return overrides[deviceId]?.hidden === true;
  }, [overrides]);

  return { overrides, updateOverride, getDisplayName, getRoomOverride, isHidden };
}

/* ─── Signal strength helper ─── */

/* ─── Capability type labels ─── */
const CAP_TYPE_LABELS: Record<string, string> = {
  "devices.capabilities.on_off": "Вкл/Выкл",
  "devices.capabilities.mode": "Режим",
  "devices.capabilities.range": "Диапазон",
  "devices.capabilities.toggle": "Переключатель",
  "devices.capabilities.color_setting": "Цвет",
};

const CAP_INSTANCE_LABELS: Record<string, string> = {
  on: "Включение",
  brightness: "Яркость",
  temperature: "Температура",
  thermostat: "Термостат",
  fan_speed: "Вентилятор",
  swing: "Качание",
  night_mode: "Ночной режим",
  color_temperature: "Цветовая температура",
  scene: "Сцена",
  hue: "Оттенок",
  saturation: "Насыщенность",
};

const PROP_INSTANCE_LABELS: Record<string, string> = {
  temperature: "Температура",
  humidity: "Влажность",
  co2_level: "CO2",
  "pm2.5_density": "PM2.5",
  battery_level: "Батарея",
  motion: "Движение",
  open: "Открытие",
  presence: "Присутствие",
  vibration: "Вибрация",
  water_leak: "Протечка",
  illumination: "Освещённость",
  signal_strength: "Сигнал",
  rssi: "Сигнал",
  smoke: "Дым",
  gas: "Газ",
};

/* ─── Interface ─── */
interface DeviceCardProps {
  device: Device;
  token: string;
  rooms: Room[];
  hideOffline: boolean;
  displayName?: string;
  onHide?: (id: string) => void;
  onShowDetail?: (device: Device) => void;
  onShowSettings?: (device: Device) => void;
  isFeatured?: boolean;
  onToggleFeatured?: () => void;
}

/* ─── Main component ─── */
export function DeviceCard({
  device,
  token,
  rooms,
  hideOffline,
  displayName,
  onHide,
  onShowDetail,
  onShowSettings,
  isFeatured,
  onToggleFeatured,
}: DeviceCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useDeviceControl(token);
  const { isDeviceVisible, setDeviceVisible } = useDeviceVisibility();
  const { isSensorOnly, setSensorOnly } = useSensorDevices();
  const { isInverted, toggleInverted } = useSensorInversions();
  const { isPinnedSensor: isPinned, setPinned } = usePinnedSensors();
  const [showDetails, setShowDetails] = useState(false);

  const status = getDeviceStatus(device);
  const canToggle = hasToggle(device);
  const isAc = isAcDevice(device);
  const isOn = status.type === "on";
  const icon = getDeviceIcon(device.type);
  const signal = getSignalInfo(device);

  const brightnessCap = getDeviceCapability(device, "devices.capabilities.range", "brightness");
  const brightness = brightnessCap?.state?.value as number | undefined;

  const capabilityCount = device.capabilities?.length ?? 0;
  const propertyCount = device.properties?.length ?? 0;

  const hasExtra = !!(
    device.device_info?.hw_version ||
    device.device_info?.sw_version ||
    device.device_info?.serial ||
    device.device_info?.device_id ||
    device.external_id ||
    device.skill_id ||
    (device.aliases?.length ?? 0) > 0 ||
    (device.groups?.length ?? 0) > 0
  );

  if (hideOffline && status.type === "off") return null;

  const name = displayName ?? device.name;
  const room = rooms.find((r) => r.id === device.room_id);
  const brand = device.device_info?.manufacturer ?? "—";
  const model = device.device_info?.model;

  const toggle = () => {
    if (!canToggle) return;
    logAction({
      type: "command_sent",
      deviceId: device.id,
      deviceName: device.name,
      message: `${isOn ? "Выключение" : "Включение"} устройства "${name}"`,
    });
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: !isOn } }] },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
          logAction({
            type: "command_result",
            deviceId: device.id,
            deviceName: device.name,
            message: `Устройство "${name}" ${!isOn ? "включено" : "выключено"}`,
          });
        },
        onError: (err) => {
          logAction({
            type: "command_result",
            deviceId: device.id,
            deviceName: device.name,
            message: `Ошибка: ${err.message}`,
          });
        },
      }
    );
  };

  const setBrightness = (val: number[]) => {
    logAction({
      type: "command_sent",
      deviceId: device.id,
      deviceName: device.name,
      message: `Установка яркости ${val[0]}% на "${name}"`,
    });
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "brightness", value: val[0] } }] },
    });
  };

  return (
    <div
      className={`group relative rounded-xl border bg-card transition-all duration-300 overflow-hidden ${
        isDeviceVisible(device.id) ? "border-border/50" : "border-border/30 grayscale opacity-55"
      }`}
      data-testid={`device-card-${device.id}`}
    >
      {/* ── Header: Icon + Name ── */}
      <div className="p-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0" role="img">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-foreground truncate">{name}</p>
              <div className="mt-0.5">
                <DeviceStatusBadge status={status.type} />
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canToggle && (
              <button
                onClick={toggle}
                disabled={controlDevice.isPending}
                className={`p-1.5 rounded-md border transition-colors ${
                  isOn
                    ? "border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
                title={isOn ? "Выключить" : "Включить"}
                data-testid={`button-toggle-${device.id}`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Звёздочка — главная карточка в юзер-панели */}
            {onToggleFeatured && (
              <button
                onClick={onToggleFeatured}
                className={`p-1.5 rounded-md transition-colors ${
                  isFeatured
                    ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-400 border border-border"
                }`}
                title={isFeatured ? "Главная карточка" : "Сделать главной карточкой"}
              >
                <Star className={`w-3.5 h-3.5 ${isFeatured ? "fill-yellow-400" : ""}`} />
              </button>
            )}
            <button
              onClick={() => setDeviceVisible(device.id, !isDeviceVisible(device.id))}
              className={`p-1.5 rounded-md transition-colors ${
                isDeviceVisible(device.id)
                  ? "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/20 border border-[hsl(var(--gold))]/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
              }`}
              title={isDeviceVisible(device.id) ? "Видна в юзер-панели" : "Скрыта в юзер-панели"}
            >
              {isDeviceVisible(device.id) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setSensorOnly(device.id, !isSensorOnly(device.id))}
              className={`p-1.5 rounded-md transition-colors ${
                isSensorOnly(device.id)
                  ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-400 border border-border"
              }`}
              title={isSensorOnly(device.id) ? "Датчик — не в сетке, данные в InfoPanel" : "Пометить как датчик"}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPinned(device.id, !isPinned(device.id))}
              className={`p-1.5 rounded-md transition-colors ${
                isPinned(device.id)
                  ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/30 border border-[hsl(var(--gold))]/40"
                  : "bg-muted/50 text-muted-foreground hover:bg-[hsl(var(--gold))]/10 hover:text-[hsl(var(--gold))] border border-border"
              }`}
              title={isPinned(device.id) ? "Откреплено — показывается в любой комнате" : "Закрепить: показывать датчик в ЮП и ЮМП независимо от комнаты"}
            >
              {isPinned(device.id) ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>
            {onShowSettings && (
              <button
                onClick={() => onShowSettings(device)}
                className="p-1.5 rounded-md bg-muted/50 hover:bg-primary/20 hover:text-primary text-muted-foreground flex items-center justify-center transition-colors"
                title="Настройки"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
            {device.type === "devices.types.camera" && <CameraStreamDialog device={device} />}
            <DeviceDetailsDialog device={device} token={token} />
          </div>
        </div>
      </div>

      {/* ── Info row: Type + Brand + Model + Room ── */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] font-normal">
            {getDeviceTypeLabel(device.type)}
          </Badge>
          {brand !== "—" && (
            <span className="text-[10px] text-muted-foreground">
              {brand}{model && <span className="ml-1 font-mono">{model}</span>}
            </span>
          )}
        </div>
        {/* Room + Signal + Network status */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {room && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{room.name}</span>
            </div>
          )}
          {signal && (
            <div className="flex items-center gap-1">
              <Radio className={`w-3 h-3 ${signal.color}`} />
              <span className={`text-[10px] font-mono ${signal.color}`}>
                {signal.value} <span className="opacity-70">{signal.label}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {status.type === "on" || status.type === "camera" ? (
              <>
                <Wifi className="w-3 h-3 text-[hsl(var(--gold))]" />
                <span className="text-[10px] text-[hsl(var(--gold))]">В сети</span>
              </>
            ) : status.type === "off" ? (
              <>
                <WifiOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Не в сети</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-blue-400">Активен</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Sensor readings ── */}
      <div className="px-3 pb-2">
        <SensorReadingsInline device={device} />
      </div>

      {/* ── AC Controls ── */}
      {isAc && isOn && (
        <div className="px-3 pb-2">
          <AcControls device={device} token={token} />
        </div>
      )}

      {/* ── Brightness ── */}
      {brightnessCap && isOn && brightness !== undefined && !isAc && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground mb-1">Яркость: {brightness}%</p>
          <Slider
            value={[brightness]}
            onValueCommit={setBrightness}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* ── ID ── */}
      <div className="px-3 pb-2">
        <CopyableId id={device.id} />
      </div>

      {/* ── Тех. данные: доп. инфо + функции + свойства (одна сворачиваемая секция) ── */}
      {(hasExtra || capabilityCount > 0 || propertyCount > 0) && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/30">
              <span className="flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Тех. данные и функции
              </span>
              {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {hasExtra && (
              <div className="px-3 pt-2 space-y-1">
                {device.device_info?.hw_version && <ExtraRow label="HW версия" value={device.device_info.hw_version} mono />}
                {device.device_info?.sw_version && <ExtraRow label="SW версия" value={device.device_info.sw_version} mono />}
                {device.device_info?.serial && <ExtraRow label="Серийник" value={device.device_info.serial} mono />}
                {device.device_info?.device_id && <ExtraRow label="Device ID" value={device.device_info.device_id} mono />}
                {device.external_id && <ExtraRow label="External ID" value={device.external_id} mono />}
                {device.skill_id && <ExtraRow label="Skill ID" value={device.skill_id} mono />}
                {device.household_id && <ExtraRow label="Объект (household)" value={device.household_id} mono />}
                {(device.aliases?.length ?? 0) > 0 && <ExtraRow label="Алиасы" value={device.aliases!.join(", ")} />}
                {(device.groups?.length ?? 0) > 0 && <ExtraRow label="Группы" value={device.groups!.join(", ")} />}
              </div>
            )}

            {capabilityCount > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Wrench className="w-3 h-3" /> Функции ({capabilityCount})
                </p>
                <div className="px-3 pb-1 space-y-1">
                  {device.capabilities?.map((cap, i) => {
                    const typeLabel = CAP_TYPE_LABELS[cap.type] ?? cap.type.split(".").pop();
                    const instLabel = cap.state?.instance
                      ? (CAP_INSTANCE_LABELS[cap.state.instance] ?? cap.state.instance)
                      : "";
                    return (
                      <div key={i} className="flex items-center justify-between py-1 text-[10px]">
                        <span className="text-muted-foreground truncate">
                          {typeLabel}
                          {instLabel && <span className="ml-1 opacity-70">· {instLabel}</span>}
                        </span>
                        <span className="font-mono text-foreground ml-2">
                          {cap.state?.value !== undefined ? String(cap.state.value) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {propertyCount > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Radio className="w-3 h-3" /> Свойства ({propertyCount})
                </p>
                <div className="px-3 pb-2 space-y-1">
                  {device.properties?.map((prop, i) => {
                    const instLabel = prop.parameters?.instance
                      ? (PROP_INSTANCE_LABELS[prop.parameters.instance] ?? prop.parameters.instance)
                      : "";
                    const instance = prop.parameters?.instance;
                    const invertible =
                      typeof prop.state?.value === "boolean" &&
                      instance !== undefined &&
                      (INVERTIBLE_INSTANCES as readonly string[]).includes(instance);
                    return (
                      <div key={i} className="flex items-center justify-between py-1 text-[10px]">
                        <span className="text-muted-foreground truncate">
                          {instLabel || prop.type.split(".").pop()}
                        </span>
                        <span className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          {invertible && (
                            <button
                              onClick={() => toggleInverted(device.id, instance as InvertibleInstance)}
                              title={
                                isInverted(device.id, instance as InvertibleInstance)
                                  ? "Инверсия включена (значение перевёрнуто)" : "Инверсия выключена"
                              }
                              className={`p-0.5 rounded border transition-colors flex items-center justify-center ${
                                isInverted(device.id, instance as InvertibleInstance)
                                  ? "border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                              }`}
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                            </button>
                          )}
                          <span className="font-mono text-foreground">
                            {prop.state?.value !== undefined ? String(prop.state.value) : "—"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

/* ─── Hook: useDeviceControl ─── */
function useDeviceControl(token: string) {
  return useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });
}

/* ─── Extra info row ─── */
function ExtraRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-[10px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-foreground text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

/* ─── AC Controls (inline) ─── */
function AcControls({ device, token }: { device: Device; token: string }) {
  const queryClient = useQueryClient();
  const controlDevice = useDeviceControl(token);

  const mode = getAcMode(device);
  const modeOptions = getAcModeOptions(device);
  const tempInfo = getAcTemperature(device);
  const fanInfo = getAcFanSpeed(device);
  const swingCap = getDeviceCapability(device, "devices.capabilities.toggle", "swing");

  const send = (actions: any[], label: string) => {
    logAction({
      type: "command_sent",
      deviceId: device.id,
      deviceName: device.name,
      message: `${label} на "${device.name}"`,
    });
    controlDevice.mutate(
      { deviceId: device.id, data: { actions } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }) }
    );
  };

  return (
    <div className="space-y-2">
      {modeOptions.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Режим</p>
          <div className="flex flex-wrap gap-1">
            {modeOptions.map((m) => {
              const info = AC_MODE_LABELS[m] ?? { emoji: "⚙️", label: m };
              return (
                <button
                  key={m}
                  onClick={() => send([{ type: "devices.capabilities.mode", state: { instance: "thermostat", value: m } }], `Смена режима на "${info.label}"`)}
                  disabled={controlDevice.isPending}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                    mode === m
                      ? "border-primary text-primary bg-primary/20"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tempInfo.value !== undefined && tempInfo.min !== undefined && tempInfo.max !== undefined && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            Температура: <span className="text-foreground font-mono font-semibold">{tempInfo.value}°C</span>
          </p>
          <Slider
            value={[tempInfo.value]}
            onValueCommit={(v) => send([{ type: "devices.capabilities.range", state: { instance: "temperature", value: v[0] } }], `Установка температуры ${v[0]}°C`)}
            min={tempInfo.min}
            max={tempInfo.max}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {fanInfo.value !== undefined && fanInfo.min !== undefined && fanInfo.max !== undefined && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            Вентилятор: <span className="text-foreground font-mono font-semibold">{fanInfo.value}</span>
          </p>
          <Slider
            value={[fanInfo.value]}
            onValueCommit={(v) => send([{ type: "devices.capabilities.range", state: { instance: "fan_speed", value: v[0] } }], `Установка скорости вентилятора ${v[0]}`)}
            min={fanInfo.min}
            max={fanInfo.max}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {swingCap && (
        <button
          onClick={() => send([{ type: "devices.capabilities.toggle", state: { instance: "swing", value: !swingCap.state?.value } }], `Качание ${swingCap.state?.value ? "выкл" : "вкл"}`)}
          disabled={controlDevice.isPending}
          className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
            swingCap.state?.value
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border/50 text-muted-foreground hover:border-border"
          }`}
        >
          🔀 Качание {swingCap.state?.value ? "вкл" : "выкл"}
        </button>
      )}
    </div>
  );
}
