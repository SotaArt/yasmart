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
  getDeviceCapability,
  AC_MODE_LABELS,
  getSignalInfo,
  setDeviceIconOverride,
  getSensorReadings,
  type Device,
  type DeviceCapability,
  type Room,
} from "@/lib/yandex";
import { Pin, PinOff, ChevronDown, Settings, Wifi, WifiOff, Radio, Power, ChevronRight, MapPin, Eye, EyeOff, Star, Activity, SlidersHorizontal, ArrowLeftRight, Image as ImageIcon, X } from "lucide-react";
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

/* ─── Control labels ─── */
const RANGE_LABELS: Record<string, { label: string; unit?: string; step?: number }> = {
  brightness: { label: "Яркость", unit: "%" },
  temperature: { label: "Температура", unit: "°C" },
  color_temperature: { label: "Цветовая температура", unit: "K", step: 100 },
  fan_speed: { label: "Скорость вентиляции" },
  work_speed: { label: "Скорость вентиляции" },
  open: { label: "Открытие", unit: "%" },
  humidity: { label: "Влажность", unit: "%" },
  volume: { label: "Громкость", unit: "%" },
  channel: { label: "Канал" },
  camera_pan: { label: "Поворот камеры" },
  camera_tilt: { label: "Наклон камеры" },
};

const MODE_TITLES: Record<string, string> = {
  thermostat: "Режим",
  fan_speed: "Скорость вентиляции",
  work_speed: "Скорость вентиляции",
  swing: "Качание",
  program: "Программа",
  clean: "Очистка",
  humidity: "Влажность",
  video_resolution: "Разрешение видео",
};

const MODE_VALUE_LABELS: Record<string, Record<string, string>> = {
  fan_speed: { auto: "Авто", low: "Слабо", medium: "Средне", high: "Сильно", quiet: "Тихо", turbo: "Турбо" },
  work_speed: { auto: "Авто", low: "Слабо", medium: "Средне", high: "Сильно", quiet: "Тихо", turbo: "Турбо" },
  swing: { auto: "Авто", stop: "Стоп", low: "Слабо", medium: "Средне", high: "Сильно", vertical: "Вертикально", horizontal: "Горизонтально" },
  program: { auto: "Авто", manual: "Ручной", eco: "Эко", comfort: "Комфорт", sleep: "Сон" },
  video_resolution: {
    video_resolution_auto: "Авто",
    video_resolution_1440: "1440p",
    video_resolution_1080: "1080p",
    video_resolution_720: "720p",
    video_resolution_480: "480p",
  },
};

const TOGGLE_LABELS: Record<string, string> = {
  swing: "Качание",
  night_mode: "Ночной режим",
  ionizer: "Ионизация",
  oscillation: "Колебание",
  mute: "Без звука",
  child_lock: "Защита от детей",
  backlight: "Подсветка",
  keep_warm: "Поддержание тепла",
  anti_freeze: "Защита от заморозки",
  water_ionizer: "Ионизация воды",
  camera_sw_mute: "Без звука",
  camera_sw_night_mode: "Ночной режим",
};

const RGB_PRESETS: { r: number; g: number; b: number; label: string }[] = [
  { r: 255, g: 255, b: 255, label: "Белый" },
  { r: 255, g: 0, b: 0, label: "Красный" },
  { r: 255, g: 165, b: 0, label: "Оранжевый" },
  { r: 255, g: 255, b: 0, label: "Жёлтый" },
  { r: 0, g: 255, b: 0, label: "Зелёный" },
  { r: 0, g: 200, b: 255, label: "Голубой" },
  { r: 0, g: 0, b: 255, label: "Синий" },
  { r: 128, g: 0, b: 255, label: "Фиолетовый" },
  { r: 255, g: 0, b: 200, label: "Розовый" },
];

function capabilityInstance(cap: DeviceCapability): string {
  return (cap.state?.instance ?? cap.parameters?.instance ?? "") as string;
}

function getModeValues(cap: DeviceCapability): string[] {
  const modes = cap.parameters?.modes;
  if (!Array.isArray(modes)) return [];
  return modes.map((m) => (typeof m === "string" ? m : m?.value)).filter(Boolean);
}

function getRangeBounds(cap: DeviceCapability) {
  const min = Number(cap.parameters?.min_value ?? 0);
  const max = Number(cap.parameters?.max_value ?? 100);
  const instance = capabilityInstance(cap);
  return {
    min,
    max: max > min ? max : min + 100,
    step: RANGE_LABELS[instance]?.step ?? 1,
  };
}

function formatRangeValue(instance: string, value: unknown): string {
  if (value === undefined || value === null) return "—";
  const unit = RANGE_LABELS[instance]?.unit ?? "";
  return `${value}${unit}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const ss = s / 100, vv = v / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vv - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

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
  onShowDetail?: (device: Device) => void;
  onShowSettings?: (device: Device) => void;
  isFeatured?: boolean;
  onToggleFeatured?: () => void;
  reorder?: React.ReactNode;
}

/* ─── Main component ─── */
export function DeviceCard({
  device,
  token,
  rooms,
  hideOffline,
  displayName,
  onShowDetail,
  onShowSettings,
  isFeatured,
  onToggleFeatured,
  reorder,
}: DeviceCardProps) {
  const { isDeviceVisible, setDeviceVisible } = useDeviceVisibility();
  const { isSensorOnly, setSensorOnly } = useSensorDevices();
  const { isPinnedSensor: isPinned, setPinned } = usePinnedSensors();

  const status = getDeviceStatus(device);
  const [customIcon, setCustomIcon] = useState<string | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("eng_device_icon_overrides_v1") || "{}")[device.id] ?? null;
    } catch {
      return null;
    }
  });
  const icon = customIcon || getDeviceIcon(device.type);
  const signal = getSignalInfo(device);
  const readings = getSensorReadings(device);
  const [sensorExpanded, setSensorExpanded] = useState(false);

  if (hideOffline && status.type === "off") return null;

  const name = displayName ?? device.name;
  const room = rooms.find((r) => r.id === device.room_id);
  const brand = device.device_info?.manufacturer ?? "—";
  const model = device.device_info?.model;

  return (
    <div
      className={`group relative rounded-xl border bg-card transition-all duration-300 overflow-hidden ${
        isDeviceVisible(device.id) ? "border-border/50" : "border-border/30 grayscale opacity-55"
      }`}
      data-testid={`device-card-${device.id}`}
    >
      {/* ── Header: Icon + Name ── */}
      <div className="p-3 pb-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-2xl flex-shrink-0 flex items-center justify-center w-8 h-8" role="img">
            {icon.startsWith("data:") ? <img src={icon} alt="" className="w-6 h-6 object-contain" /> : icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-foreground truncate">{name}</p>
            <div className="mt-0.5">
              <DeviceStatusBadge status={status.type} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Action row ── */}
      <div className="px-3 pt-2">
        <div className="flex items-center gap-1 flex-wrap border-t border-border/30 pt-2">
            {reorder}
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const max = 128;
                      const scale = Math.min(max / img.width, max / img.height, 1);
                      canvas.width = Math.round(img.width * scale);
                      canvas.height = Math.round(img.height * scale);
                      const ctx = canvas.getContext("2d");
                      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      const compressed = canvas.toDataURL("image/png");
                      setDeviceIconOverride(device.id, compressed);
                      setCustomIcon(compressed);
                    };
                    img.src = result;
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
              className="p-1.5 rounded-md bg-muted/50 hover:bg-primary/20 hover:text-primary text-muted-foreground flex items-center justify-center transition-colors"
              title="Загрузить иконку (PNG/JPG)"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            {customIcon && (
              <button
                onClick={() => {
                  setDeviceIconOverride(device.id, null);
                  setCustomIcon(null);
                }}
                className="p-1.5 rounded-md bg-muted/50 hover:bg-destructive/20 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors"
                title="Сбросить иконку"
              >
                <X className="w-3.5 h-3.5" />
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
              title={isDeviceVisible(device.id) ? "Показывать в ЮП и МП" : "Скрыто в ЮП и МП"}
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
              title={isSensorOnly(device.id) ? "Датчик — данные только в InfoPanel" : "Пометить как датчик"}
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
      {Object.keys(readings).length > 0 ? (
        <Collapsible open={sensorExpanded} onOpenChange={setSensorExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/30">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Показания датчика
              </span>
              {sensorExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pt-2 pb-2">
              <SensorReadingsInline device={device} />
              <div className="mt-2 space-y-1">
                {readings.temperature !== undefined && <SensorRow label="Температура" value={`${readings.temperature.toFixed(1)} °C`} />}
                {readings.humidity !== undefined && <SensorRow label="Влажность" value={`${Math.round(readings.humidity)} %`} />}
                {readings.illumination !== undefined && <SensorRow label="Освещённость" value={`${readings.illumination} лк`} />}
                {readings.pm25 !== undefined && <SensorRow label="PM2.5" value={`${Math.round(readings.pm25)} мкг/м³`} />}
                {readings.co2 !== undefined && <SensorRow label="CO₂" value={`${Math.round(readings.co2)} ppm`} />}
                {readings.battery !== undefined && <SensorRow label="Батарея" value={`${Math.round(readings.battery)} %`} />}
                {readings.motion !== undefined && <SensorRow label="Движение" value={readings.motion ? "Обнаружено" : "Нет"} />}
                {readings.open !== undefined && <SensorRow label="Открытие" value={readings.open ? "Открыто" : "Закрыто"} />}
                {readings.presence !== undefined && <SensorRow label="Присутствие" value={readings.presence ? "Есть" : "Нет"} />}
                {readings.vibration !== undefined && <SensorRow label="Вибрация" value={readings.vibration ? "Обнаружена" : "Нет"} />}
                {readings.water_leak !== undefined && <SensorRow label="Протечка" value={readings.water_leak ? "Да" : "Нет"} />}
                {readings.smoke !== undefined && <SensorRow label="Дым" value={readings.smoke ? "Обнаружен" : "Нет"} />}
                {readings.gas !== undefined && <SensorRow label="Газ" value={readings.gas ? "Обнаружен" : "Нет"} />}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {/* ── ID ── */}
      <div className="px-3 pb-2">
        <CopyableId id={device.id} />
      </div>

      <DeviceControls device={device} token={token} />
    </div>
  );
}

/* ─── Hook: useDeviceControl ─── */
function useDeviceControl(token: string) {
  return useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  }  );
}

function SensorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

/* ─── Device controls (capability-based) ─── */
function DeviceControls({ device, token }: { device: Device; token: string }) {
  const queryClient = useQueryClient();
  const controlDevice = useDeviceControl(token);
  const { isInverted, toggleInverted } = useSensorInversions();
  const [open, setOpen] = useState(false);

  const capabilities = device.capabilities ?? [];
  const powerCap = getDeviceCapability(device, "devices.capabilities.on_off");
  const rangeCaps = capabilities.filter((cap) => cap.type === "devices.capabilities.range");
  const rangeInstances = new Set(rangeCaps.map(capabilityInstance));
  const modeCaps = capabilities.filter(
    (cap) => cap.type === "devices.capabilities.mode" && !rangeInstances.has(capabilityInstance(cap))
  );
  const toggleCaps = capabilities.filter((cap) => cap.type === "devices.capabilities.toggle");
  const colorCap = capabilities.find((cap) => cap.type === "devices.capabilities.color_setting");
  const colorTempRange = getDeviceCapability(device, "devices.capabilities.range", "color_temperature");
  const colorTempKParams = (colorCap?.parameters as any)?.temperature_k as
    | { min?: number; max?: number }
    | undefined;
  const colorInstance = colorCap ? capabilityInstance(colorCap) : "";
  const colorModel = (colorCap?.parameters as any)?.color_model as string | undefined;
  const hasColorTempK = !!(
    colorCap &&
    !colorTempRange &&
    (colorInstance === "temperature_k" || colorTempKParams)
  );
  const showColorPresets = !!(
    colorCap &&
    (colorInstance === "hsv" ||
      colorInstance === "rgb" ||
      colorModel === "hsv" ||
      colorModel === "rgb")
  );
  const showColorTempK = hasColorTempK && !showColorPresets;

  const invertibleProps = (device.properties ?? []).filter((prop) => {
    const instance = prop.parameters?.instance;
    return (
      typeof prop.state?.value === "boolean" &&
      instance !== undefined &&
      (INVERTIBLE_INSTANCES as readonly string[]).includes(instance)
    );
  });

  const hasControls =
    !!powerCap ||
    rangeCaps.length > 0 ||
    modeCaps.length > 0 ||
    toggleCaps.length > 0 ||
    showColorPresets ||
    showColorTempK;
  const hasAnything = hasControls || invertibleProps.length > 0;

  const send = (type: string, instance: string, value: unknown) => {
    controlDevice.mutate(
      { deviceId: device.id, data: { actions: [{ type, state: { instance, value } }] } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }) }
    );
  };

  const sendColor = (r: number, g: number, b: number) => {
    if (!colorCap) return;
    if (colorInstance === "rgb" || colorModel === "rgb") {
      send("devices.capabilities.color_setting", "rgb", { r, g, b });
    } else {
      send("devices.capabilities.color_setting", "hsv", rgbToHsv(r, g, b));
    }
  };

  if (!hasAnything) return null;

  const isOn = powerCap?.state?.value === true;
  const currentColorState = colorCap?.state?.instance === "rgb" ? colorCap.state?.value : undefined;
  const currentRgb = currentColorState && typeof currentColorState === "object"
    ? {
        r: Number((currentColorState as any).r ?? 255),
        g: Number((currentColorState as any).g ?? 255),
        b: Number((currentColorState as any).b ?? 255),
      }
    : undefined;
  const currentHsv = colorCap?.state?.instance === "hsv" && colorCap.state?.value
    ? colorCap.state.value as { h?: number; s?: number; v?: number }
    : currentRgb
      ? rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b)
      : undefined;
  const colorTempKValue = Number(colorCap?.state?.value ?? 0);
  const colorTempKMin = Number(colorTempKParams?.min ?? 2700);
  const colorTempKMax = Number(colorTempKParams?.max ?? 6500);
  const currentHex = currentRgb
    ? rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)
    : currentHsv
      ? (() => {
          const rgb = hsvToRgb(currentHsv.h ?? 0, currentHsv.s ?? 0, currentHsv.v ?? 0);
          return rgbToHex(rgb.r, rgb.g, rgb.b);
        })()
      : "#ffffff";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/30"
          data-testid={`controls-trigger-${device.id}`}
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            Управление
          </span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pt-2 pb-3 space-y-3" data-testid={`controls-${device.id}`}>
          {powerCap && (
            <button
              onClick={() => send("devices.capabilities.on_off", "on", !isOn)}
              disabled={controlDevice.isPending}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                isOn
                  ? "border-[hsl(var(--gold))]/50 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]"
                  : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Power className="w-3.5 h-3.5" />
                Питание
              </span>
              <span className="text-[10px] font-mono">{isOn ? "Вкл" : "Выкл"}</span>
            </button>
          )}

          {rangeCaps.map((cap) => {
            const instance = capabilityInstance(cap);
            const meta = RANGE_LABELS[instance] ?? { label: instance || "Значение" };
            const { min, max, step } = getRangeBounds(cap);
            const rawValue = Number(cap.state?.value);
            const value = Number.isFinite(rawValue) ? Math.min(max, Math.max(min, rawValue)) : min;
            return (
              <div key={`range-${instance}`}>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                  {meta.label}:{" "}
                  <span className="text-foreground font-mono font-semibold">
                    {formatRangeValue(instance, cap.state?.value)}
                  </span>
                </p>
                <Slider
                  value={[value]}
                  onValueCommit={(v) => send("devices.capabilities.range", instance, v[0])}
                  min={min}
                  max={max}
                  step={step}
                  disabled={controlDevice.isPending}
                  className="w-full"
                />
                {instance === "open" && (
                  <div className="flex gap-1 mt-1.5">
                    <button
                      onClick={() => send("devices.capabilities.range", instance, 100)}
                      disabled={controlDevice.isPending}
                      className="text-[10px] px-2 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      Открыть
                    </button>
                    <button
                      onClick={() => send("devices.capabilities.range", instance, 0)}
                      disabled={controlDevice.isPending}
                      className="text-[10px] px-2 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {showColorTempK && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                Цветовая температура:{" "}
                <span className="text-foreground font-mono font-semibold">
                  {colorTempKValue > 0 ? `${colorTempKValue}K` : "—"}
                </span>
              </p>
              <Slider
                value={[Math.min(colorTempKMax, Math.max(colorTempKMin, colorTempKValue || colorTempKMin))]}
                onValueCommit={(v) => send("devices.capabilities.color_setting", "temperature_k", v[0])}
                min={colorTempKMin}
                max={colorTempKMax}
                step={100}
                disabled={controlDevice.isPending}
                className="w-full"
              />
            </div>
          )}

          {showColorPresets && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Цвет</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {RGB_PRESETS.map((color) => {
                  const hex = rgbToHex(color.r, color.g, color.b);
                  const hsv = rgbToHsv(color.r, color.g, color.b);
                  const isActive = colorInstance === "hsv"
                    ? currentHsv?.h === hsv.h && currentHsv?.s === hsv.s && currentHsv?.v === hsv.v
                    : currentRgb
                      ? rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b) === hex
                      : false;
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={color.label}
                      aria-label={`Цвет ${color.label}`}
                      onClick={() => sendColor(color.r, color.g, color.b)}
                      disabled={controlDevice.isPending}
                      className={`w-6 h-6 rounded-full transition-all ${
                        isActive ? "ring-2 ring-[hsl(var(--gold))] ring-offset-1 ring-offset-background scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
                <input
                  type="color"
                  value={currentHex}
                  onChange={(e) => {
                    const { r, g, b } = hexToRgb(e.target.value);
                    sendColor(r, g, b);
                  }}
                  disabled={controlDevice.isPending}
                  title="Выбрать цвет"
                  className="w-7 h-7 rounded-md border border-border bg-transparent cursor-pointer"
                />
              </div>
            </div>
          )}

          {modeCaps.map((cap) => {
            const instance = capabilityInstance(cap);
            const values = getModeValues(cap);
            if (values.length === 0) return null;
            const current = cap.state?.value;
            return (
              <div key={`mode-${instance}`}>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                  {MODE_TITLES[instance] ?? instance}
                </p>
                <div className="flex flex-wrap gap-1">
                  {values.map((value) => {
                    const acLabel = instance === "thermostat"
                      ? AC_MODE_LABELS[value as keyof typeof AC_MODE_LABELS]
                      : undefined;
                    const label = acLabel
                      ? `${acLabel.emoji} ${acLabel.label}`
                      : MODE_VALUE_LABELS[instance]?.[value] ?? value;
                    return (
                      <button
                        key={value}
                        onClick={() => send(cap.type, instance, value)}
                        disabled={controlDevice.isPending}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                          current === value
                            ? "border-primary text-primary bg-primary/20"
                            : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {toggleCaps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {toggleCaps.map((cap) => {
                const instance = capabilityInstance(cap);
                const active = cap.state?.value === true;
                return (
                  <button
                    key={`toggle-${instance}`}
                    onClick={() => send(cap.type, instance, !active)}
                    disabled={controlDevice.isPending}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      active
                        ? "border-primary/50 text-primary bg-primary/10"
                        : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {TOGGLE_LABELS[instance] ?? instance}: {active ? "вкл" : "выкл"}
                  </button>
                );
              })}
            </div>
          )}

          {invertibleProps.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Инверсия датчиков</p>
              <div className="flex flex-wrap gap-1">
                {invertibleProps.map((prop) => {
                  const instance = prop.parameters?.instance as InvertibleInstance;
                  const active = isInverted(device.id, instance);
                  return (
                    <button
                      key={`invert-${instance}`}
                      onClick={() => toggleInverted(device.id, instance)}
                      title={active ? "Значение перевёрнуто" : "Значение не перевёрнуто"}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                        active
                          ? "border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      {PROP_INSTANCE_LABELS[instance] ?? instance}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
