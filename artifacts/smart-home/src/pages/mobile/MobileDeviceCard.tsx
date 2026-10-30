import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { SensorReadingsInline } from "@/components/sensors";
import { LuxBar } from "@/components/smart-card/premium";
import { DeviceIcon } from "@/components/smart-card/DeviceIcon";
import { toast } from "@/hooks/use-toast";
import {
  getDeviceStatus,
  hasToggle,
  getDeviceIcon,
  AC_MODE_LABELS,
  type Device,
  type DeviceCapability,
} from "@/lib/yandex";
import { Power, ChevronDown } from "lucide-react";

interface MobileDeviceCardProps {
  device: Device;
  token: string;
}

const stopTouch = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Ленивое чтение instance: он может лежать в parameters ИЛИ в state
 * (часть устройств Яндекса не отдаёт parameters.instance — из-за этого
 * общий getDeviceCapability не находит capability, и слайдеры пропадают).
 */
function getCapInstance(c: DeviceCapability): string | undefined {
  return c.parameters?.instance ?? c.state?.instance ?? undefined;
}

/* ─── Карта функций устройств: label/диапазоны по instance ─── */

interface RangeCfg {
  label: string;
  suffix: string;
  step: number;
  min?: number;
  max?: number;
}

const RANGE_CFG: Record<string, RangeCfg> = {
  temperature: { label: "Температура", suffix: "°", step: 0.5, min: 5, max: 35 },
  brightness: { label: "Яркость", suffix: "%", step: 1, min: 0, max: 100 },
  color_temperature: { label: "Тёплый/Холодный", suffix: "K", step: 100, min: 2700, max: 6500 },
  open: { label: "Открытие", suffix: "%", step: 1, min: 0, max: 100 },
  fan_speed: { label: "Вентилятор", suffix: "", step: 1, min: 0, max: 5 },
  volume: { label: "Громкость", suffix: "%", step: 1, min: 0, max: 100 },
  heat: { label: "Тепло", suffix: "%", step: 1, min: 0, max: 100 },
  camera_pan: { label: "Поворот", suffix: "°", step: 1, min: -180, max: 180 },
  camera_tilt: { label: "Наклон", suffix: "°", step: 1, min: -90, max: 90 },
};

const MODE_LABELS: Record<string, string> = {
  thermostat: "Режим",
  swing: "Шторка",
  fan_speed: "Скорость",
  work_speed: "Скорость",
  heat: "Обогрев",
  input_source: "Источник",
  cooking: "Режим",
  coffee_mode: "Режим",
  noise_canceling: "Шумоподавление",
};

const TOGGLE_LABELS: Record<string, string> = {
  swing: "Качание",
  night_mode: "Ночной режим",
  mute: "Без звука",
  backlight: "Подсветка",
  pause: "Пауза",
  turbo: "Турбо",
  child_lock: "Блокировка",
  controls_locked: "Управление заблокировано",
  camera_sw_mute: "Микрофон выкл",
};

/** Русские подписи общих значений режимов, когда Яндекc не отдаёт name */
const VALUE_LABELS: Record<string, string> = {
  auto: "Авто",
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  heat: "Нагрев",
  cool: "Охлаждение",
  fan_only: "Вентиляция",
  dry: "Осушение",
  preheat: "Прогрев",
  sleep: "Сон",
  boost: "Турбо",
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

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** RGB (0-255) → HSV для Яндекс-команды color_setting hsv (h 0-360, s/v 0-100). */
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
  const s = max === 0 ? 0 : d / max;
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(max * 100) };
}

interface RangeSection {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step: number;
  action: (value: number) => void;
}

export function MobileDeviceCard({ device, token }: MobileDeviceCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const status = getDeviceStatus(device);
  const canToggle = hasToggle(device);
  const isOn = status.type === "on";

  const send = useCallback(
    (actions: any[]) => {
      controlDevice.mutate(
        { deviceId: device.id, data: { actions } },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }),
          onError: () =>
            toast({
              variant: "destructive",
              title: "Ошибка",
              description: `Не удалось изменить ${device.name}`,
            }),
        }
      );
    },
    [controlDevice, device.id, queryClient, token]
  );

  const toggle = () => {
    if (!canToggle) return;
    send([
      { type: "devices.capabilities.on_off", state: { instance: "on", value: !isOn } },
    ]);
  };

  /* ─── Шторы: обычная карточка (вкл/выкл + слайдер открытия в "Настройки") ─── */

  const caps = device.capabilities ?? [];
  const isCurtain = device.type.includes("curtain");
  const openCap = caps.find(
    (c) => c.type === "devices.capabilities.range" && getCapInstance(c) === "open"
  );
  const openValue = openCap?.state?.value as number | undefined;

  /* ─── Разбор всех capabilities устройства в секции управления ─── */

  // Range-слайдеры (порядок: температура, цветовая температура, яркость, открытие, вентилятор…)
  const rangeSections: RangeSection[] = [];
  const rangePriority: Record<string, number> = {
    temperature: 0,
    color_temperature: 1,
    brightness: 2,
    open: 3,
    fan_speed: 4,
    volume: 5,
  };
  const orderedRangeCaps = caps
    .filter((c) => c.type === "devices.capabilities.range")
    .sort((a, b) => (rangePriority[getCapInstance(a) ?? ""] ?? 9) - (rangePriority[getCapInstance(b) ?? ""] ?? 9));

  for (const cap of orderedRangeCaps) {
    const instance = getCapInstance(cap);
    if (!instance) continue;
    const cfg = RANGE_CFG[instance];
    const value = cap.state?.value as number | undefined;
    const min = cap.parameters?.range?.min as number | undefined ?? cap.parameters?.min_value as number | undefined ?? cfg?.min;
    const max = cap.parameters?.range?.max as number | undefined ?? cap.parameters?.max_value as number | undefined ?? cfg?.max;
    const step = cap.parameters?.range?.precision as number | undefined ?? cfg?.step ?? 1;
    if (value === undefined || min === undefined || max === undefined || max <= min) continue;
    rangeSections.push({
      label: (cfg ?? { label: instance }).label,
      suffix: cfg?.suffix ?? "",
      value,
      min,
      max,
      step,
      action: (value) =>
        send([{ type: "devices.capabilities.range", state: { instance, value } }]),
    });
  }

  // Мод-наборы (режимы кондиционера, шторка, скорость, источник…)
  const modeSections: { instance: string; label: string; options: { value: string; display: string }[]; current?: string; activeDisplay?: string }[] = [];
  for (const cap of caps.filter((c) => c.type === "devices.capabilities.mode")) {
    const instance = getCapInstance(cap);
    if (!instance) continue;
    const options = (cap.parameters?.modes ?? []) as { value: string; name?: string }[];
    if (options.length === 0) continue;
    const current = cap.state?.value as string | undefined;
    const isThermostat = instance === "thermostat";
    let activeDisplay: string | undefined;
    const mapped = options.map((o) => {
      const acInfo = isThermostat ? (AC_MODE_LABELS as Record<string, { emoji: string; label: string }>)[o.value] : undefined;
      const display = acInfo
        ? `${acInfo.emoji} ${acInfo.label}`
        : (o.name ?? VALUE_LABELS[o.value] ?? o.value);
      if (o.value === current) activeDisplay = display;
      return { value: o.value, display };
    });
    modeSections.push({
      instance,
      label: MODE_LABELS[instance] ?? instance,
      current,
      options: mapped,
      activeDisplay,
    });
  }

  // Toggle-переключатели (качание, ночной режим, блокировка…)
  const toggleSections: { instance: string; label: string; value?: boolean }[] = [];
  for (const cap of caps.filter((c) => c.type === "devices.capabilities.toggle")) {
    const instance = getCapInstance(cap);
    if (!instance) continue;
    toggleSections.push({
      instance,
      label: TOGGLE_LABELS[instance] ?? instance,
      value: cap.state?.value as boolean | undefined,
    });
  }

  // Цвет (color_setting): температура, палитра RGB, сцены.
  // Определяем по параметрам, а не по instance в state — у CCT-ламп и
  // hsv-лент instance=null/temperature_k/color_setting/hsv при разных режандах.
  const colorCap = caps.find((c) => c.type === "devices.capabilities.color_setting");
  const tempKParams = colorCap?.parameters?.temperature_k as { min?: number; max?: number } | undefined;
  const tempKValue = colorCap?.state?.instance === "temperature_k"
    ? (colorCap.state?.value as number | undefined)
    : undefined;
  const colorIsHsv = (colorCap?.parameters?.color_model as string | undefined) === "hsv" ||
    colorCap?.state?.instance === "hsv";
  const rgbCurrent = colorCap?.state?.instance === "rgb" && typeof colorCap.state?.value === "object"
    ? (colorCap.state?.value as { r?: number; g?: number; b?: number })
    : undefined;
  const currentRgb = rgbCurrent ? { r: rgbCurrent.r ?? 255, g: rgbCurrent.g ?? 255, b: rgbCurrent.b ?? 255 } : undefined;

  const colorHasControls =
    !!tempKParams || !!colorIsHsv;

  // Сценарии (devices.capabilities.scene — пульты-сценарии); у светильников не показываем
  const isLightCard = device.type.includes("light");
  const sceneCapList = !isLightCard ? caps.filter((c) => c.type === "devices.capabilities.scene") : [];
  const sceneGroups = sceneCapList.map((cap) => {
    const instance = getCapInstance(cap) ?? "scene";
    const options = (cap.parameters?.scene?.scenes ?? []) as { id: string; name?: string }[];
    return { instance, options };
  }).filter((g) => g.options.length > 0);

  const hasSettings =
    rangeSections.length > 0 ||
    modeSections.length > 0 ||
    toggleSections.length > 0 ||
    colorHasControls ||
    sceneGroups.length > 0;

  const hasControls = canToggle || hasSettings;

  const busy = controlDevice.isPending;

  const statusLabel =
    status.type === "on" || status.type === "camera"
      ? "В сети"
      : status.type === "off"
        ? "Выключено"
        : status.type === "sensor"
          ? "Активен"
          : "Нет данных";
  const statusClass =
    status.type === "on" || status.type === "camera"
      ? "text-[hsl(var(--gold))]"
      : status.type === "sensor"
        ? "text-blue-400"
        : "text-muted-foreground";

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-3 flex flex-col gap-2.5"
      onTouchStart={stopTouch}
      onTouchEnd={stopTouch}
    >
      {/* Название полное (до 2 строк), без сокращений */}
      <div className="flex items-start gap-2">
        <DeviceIcon icon={getDeviceIcon(device.type, device.id)} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground leading-snug">{device.name}</p>
          <p className={`text-[10px] ${statusClass}`}>
            {isCurtain
              ? openValue !== undefined
                ? openValue > 0
                  ? `Открыто ${Math.round(openValue)}%`
                  : "Закрыто"
                : "Шторы"
              : statusLabel}
          </p>
        </div>
      </div>

      {/* Кнопка вкл/выкл по центру */}
      {canToggle && (
        <button
          onClick={toggle}
          disabled={busy}
          className={`mx-auto h-14 w-14 rounded-full border-2 transition-colors flex items-center justify-center ${
            isOn
              ? "border-[hsl(var(--gold))] text-[hsl(var(--gold))] bg-[hsl(var(--gold))]/15 shadow-[0_0_20px_hsl(var(--gold-glow))]"
              : "border-border text-muted-foreground bg-muted/30 hover:text-foreground"
          }`}
          title={isOn ? "Выключить" : "Включить"}
        >
          <Power className="w-7 h-7" />
        </button>
      )}

      {!hasControls && <SensorReadingsInline device={device} />}

      {hasSettings && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1.5 rounded-lg border border-border/50 w-full hover:text-foreground">
              <ChevronDown className="w-3.5 h-3.5" />
              Настройки
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 mt-2">
            {/* Режимы */}
            {modeSections.map((sec) => (
              <div key={sec.instance}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{sec.label}</span>
                  {sec.activeDisplay && <span className="text-[10px] text-foreground/80">{sec.activeDisplay}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {sec.options.map((o) => (
                    <button
                      key={`${sec.instance}-${o.value}`}
                      onClick={() =>
                        send([
                          { type: "devices.capabilities.mode", state: { instance: sec.instance, value: o.value } },
                        ])
                      }
                      disabled={busy}
                      className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors min-h-[32px] ${
                        sec.current === o.value
                          ? "border-primary text-primary bg-primary/20"
                          : "border-border/50 text-muted-foreground"
                      }`}
                    >
                      {o.display}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Слайдеры (температура, яркость, открытие, цвет. температура…) */}
            {rangeSections.map((sec) => (
              <LuxBar
                key={sec.label}
                label={sec.label}
                value={sec.value}
                min={sec.min}
                max={sec.max}
                step={sec.step}
                size="sm"
                display={(v) => `${Math.round(v * (sec.step < 1 ? 10 : 1)) / (sec.step < 1 ? 10 : 1)}${sec.suffix}`}
                onChange={sec.action}
              />
            ))}

            {/* Переключатели */}
            {toggleSections.map((sec) => (
              <button
                key={sec.instance}
                onClick={() =>
                  send([
                    { type: "devices.capabilities.toggle", state: { instance: sec.instance, value: !sec.value } },
                  ])
                }
                disabled={busy}
                className={`w-full text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                  sec.value
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {sec.label} {sec.value ? "вкл" : "выкл"}
              </button>
            ))}

            {/* Цвет */}
            {tempKParams && (
              <LuxBar
                label="Тёплый/Холодный"
                value={Math.round(tempKValue ?? (tempKParams.min ?? 2700))}
                min={tempKParams.min ?? 2700}
                max={tempKParams.max ?? 6500}
                step={100}
                size="sm"
                display={(v) => `${v}K`}
                onChange={(v) =>
                  send([{ type: "devices.capabilities.color_setting", state: { instance: "temperature_k", value: v } }])
                }
              />
            )}

            {colorIsHsv && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {RGB_PRESETS.map((c) => {
                  const hex = rgbToHex(c.r, c.g, c.b);
                  const active = currentRgb && currentRgb.r === c.r && currentRgb.g === c.g && currentRgb.b === c.b;
                  const hsv = rgbToHsv(c.r, c.g, c.b);
                  return (
                    <button
                      key={hex}
                      title={c.label}
                      aria-label={`Цвет ${c.label}`}
                      onClick={() =>
                        send([{ type: "devices.capabilities.color_setting", state: { instance: "hsv", value: hsv } }])
                      }
                      className={`w-6 h-6 rounded-full transition-transform ${
                        active ? "ring-2 ring-[#d4af37] ring-offset-1 ring-offset-card scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            )}

            {/* Сценарии устройства */}
            {sceneGroups.map((g) => (
              <div key={g.instance}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Сценарии</div>
                <div className="flex flex-wrap gap-1">
                  {g.options.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        send([{ type: "devices.capabilities.scene", state: { instance: g.instance, value: { id: s.id } } }])
                      }
                      disabled={busy}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground"
                    >
                      {s.name ?? s.id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}