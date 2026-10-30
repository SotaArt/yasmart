import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import {
  Gauge,
  Layers,
  Palette,
  Power,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getUserInfoKey } from "@/lib/query-keys";
import { DeviceIcon } from "./DeviceIcon";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import {
  getDeviceIcon,
  getDeviceTypeLabel,
  isDeviceOn,
  type Device,
  type DeviceCapability,
} from "@/lib/yandex";
import { LuxBar } from "./premium/LuxBar";
import { LuxButton } from "./premium/LuxButton";
import { LuxBadge } from "./premium/LuxBadge";

/* ─── Capability helpers ─── */

function getInstance(cap: DeviceCapability): string {
  const instance = cap.state?.instance ?? cap.parameters?.instance;
  return typeof instance === "string" ? instance : "";
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function hasDeviceSettings(device: Device): boolean {
  return (device.capabilities ?? []).some((c) =>
    [
      "devices.capabilities.on_off",
      "devices.capabilities.range",
      "devices.capabilities.mode",
      "devices.capabilities.toggle",
      "devices.capabilities.color_setting",
      "devices.capabilities.color",
    ].includes(c.type)
  );
}

/* ─── Labels ─── */

const RANGE_META: Record<
  string,
  { label: string; unit?: string; min?: number; max?: number; step?: number }
> = {
  brightness: { label: "Яркость", unit: "%", min: 0, max: 100, step: 1 },
  color_temperature: { label: "Цветовая температура", unit: "K", min: 2700, max: 6500, step: 100 },
  temperature: { label: "Температура", unit: "°C", min: 16, max: 30, step: 0.5 },
  fan_speed: { label: "Скорость вентилятора", min: 1, max: 5, step: 1 },
  work_speed: { label: "Скорость", min: 1, max: 5, step: 1 },
  volume: { label: "Громкость", unit: "%", min: 0, max: 100, step: 1 },
  open: { label: "Положение", unit: "%", min: 0, max: 100, step: 1 },
  humidity: { label: "Влажность", unit: "%", min: 0, max: 100, step: 1 },
  channel: { label: "Канал" },
};

const MODE_LABELS: Record<string, string> = {
  thermostat: "Режим работы",
  fan_speed: "Скорость обдува",
  work_speed: "Скорость",
  swing: "Положение заслонки",
  playback: "Воспроизведение",
  cleanup_mode: "Тип уборки",
  cleaning: "Тип уборки",
  program: "Программа",
  air_flow: "Поток воздуха",
};

const TOGGLE_LABELS: Record<string, string> = {
  lock: "Замок",
  pause: "Пауза",
  night_mode: "Ночной режим",
  ionization: "Ионизация",
  backlight: "Подсветка",
  oscillation: "Автоповорот",
  mute: "Без звука",
  child_lock: "Защита от детей",
  turbo: "Турбо",
  eco: "Эко",
};

const VALUE_LABELS: Record<string, string> = {
  auto: "Авто",
  cool: "Охлаждение",
  heat: "Обогрев",
  dry: "Осушение",
  fan: "Вентиляция",
  fan_only: "Вентиляция",
  warm: "Тепло",
  low: "Слабо",
  medium: "Средне",
  high: "Сильно",
  maximum: "Максимум",
  max: "Максимум",
  minimum: "Минимум",
  min: "Минимум",
  quiet: "Тихий",
  turbo: "Турбо",
  night: "Ночь",
  normal: "Обычный",
  eco: "Эко",
  balanced: "Сбалансированный",
  efficient: "Эффективный",
  gentle: "Бережный",
  standard: "Стандартный",
  stop: "Стоп",
  play: "Играть",
  pause: "Пауза",
  next_track: "Следующий",
  prev_track: "Предыдущий",
  dry_cleaning: "Сухая",
  dry_clean: "Сухая",
  sweep: "Сухая",
  wet_cleaning: "Влажная",
  wet_clean: "Влажная",
  mop: "Влажная",
  mixed_cleaning: "Сухая + влажная",
  dry_wet: "Сухая + влажная",
  dry_wet_clean: "Сухая + влажная",
  both: "Сухая + влажная",
  low_1: "Слабо",
  medium_1: "Средне",
  high_1: "Сильно",
};

function valueLabel(value: string): string {
  return VALUE_LABELS[value.toLowerCase()] ?? value.replace(/_/g, " ");
}

function formatRange(value: number, instance: string, unit?: string): string {
  const rounded = instance === "temperature" ? Math.round(value * 2) / 2 : Math.round(value);
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

/* ─── Color helpers ─── */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const RGB_PRESETS: { rgb: Rgb; label: string }[] = [
  { rgb: { r: 255, g: 255, b: 255 }, label: "Белый" },
  { rgb: { r: 255, g: 0, b: 0 }, label: "Красный" },
  { rgb: { r: 255, g: 165, b: 0 }, label: "Оранжевый" },
  { rgb: { r: 255, g: 255, b: 0 }, label: "Жёлтый" },
  { rgb: { r: 0, g: 255, b: 0 }, label: "Зелёный" },
  { rgb: { r: 0, g: 200, b: 255 }, label: "Голубой" },
  { rgb: { r: 0, g: 0, b: 255 }, label: "Синий" },
  { rgb: { r: 128, g: 0, b: 255 }, label: "Фиолетовый" },
  { rgb: { r: 255, g: 0, b: 200 }, label: "Розовый" },
];

function rgbToHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function rgbToHsv(rgb: Rgb): { h: number; s: number; v: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h),
    s: Math.round((max === 0 ? 0 : d / max) * 100),
    v: Math.round(max * 100),
  };
}

function hsvToRgb(hsv: { h: number; s: number; v: number }): Rgb {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, hsv.s)) / 100;
  const v = Math.min(100, Math.max(0, hsv.v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
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

function readColorRgb(cap: DeviceCapability): Rgb | undefined {
  const value = cap.state?.value;
  if (value && typeof value === "object") {
    const record = value as Record<string, number>;
    if (typeof record.r === "number" && typeof record.g === "number" && typeof record.b === "number") {
      return { r: record.r, g: record.g, b: record.b };
    }
    if (typeof record.h === "number" && typeof record.s === "number" && typeof record.v === "number") {
      return hsvToRgb({ h: record.h, s: record.s, v: record.v });
    }
  }
  return undefined;
}

function getModeOptions(cap: DeviceCapability): string[] {
  const modes = cap.parameters?.modes;
  if (!Array.isArray(modes)) return [];
  return modes
    .map((mode) => (typeof mode === "string" ? mode : (mode as { value?: string })?.value))
    .filter((mode): mode is string => typeof mode === "string" && mode.length > 0);
}

/* ─── Component ─── */

interface DeviceSettingsDialogProps {
  device: Device;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceSettingsDialog({
  device,
  token,
  open,
  onOpenChange,
}: DeviceSettingsDialogProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const capabilities = device.capabilities ?? [];
  const icon = getDeviceIcon(device.type, device.id);
  const isCurtain = (device.type ?? "").includes("curtain");
  const openCapability = capabilities.find(
    (c) =>
      c.type === "devices.capabilities.range" && getInstance(c) === "open"
  );
  const openValue = numeric(openCapability?.state?.value);
  const isOn =
    isDeviceOn(device) || (isCurtain && openValue !== undefined && openValue > 0);

  const patchCapability = useCallback(
    (type: string, instance: string, value: unknown) => {
      queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((d: any) => {
            if (d.id !== device.id) return d;
            return {
              ...d,
              capabilities: (d.capabilities ?? []).map((c: any) => {
                const currentInstance = c.state?.instance ?? c.parameters?.instance;
                const matches =
                  c.type === type &&
                  (currentInstance === instance ||
                    type === "devices.capabilities.color_setting");
                if (!matches) return c;
                return { ...c, state: { ...(c.state ?? {}), instance, value } };
              }),
            };
          }),
        };
      });
    },
    [device.id, queryClient, token]
  );

  const send = useCallback(
    (type: string, instance: string, value: unknown) => {
      patchCapability(type, instance, value);
      deviceCommandQueue
        .add(() =>
          controlDevice.mutateAsync({
            deviceId: device.id,
            data: { actions: [{ type, state: { instance, value } }] },
          })
        )
        .catch(() => {
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: `Не удалось изменить ${device.name}`,
          });
        });
    },
    [controlDevice, device.id, device.name, patchCapability, queryClient, token]
  );

  const powerChannels = useMemo(
    () => capabilities.filter((c) => c.type === "devices.capabilities.on_off"),
    [capabilities]
  );

  const ranges = useMemo(() => {
    const items: {
      key: string;
      type: string;
      instance: string;
      label: string;
      unit?: string;
      min: number;
      max: number;
      step: number;
      value: number;
    }[] = [];

    capabilities.forEach((cap, index) => {
      if (cap.type !== "devices.capabilities.range") return;
      const instance = getInstance(cap);
      if (!instance) return;
      const meta = RANGE_META[instance] ?? { label: valueLabel(instance) };
      const params = cap.parameters ?? {};
      const min = numeric(params.min_value) ?? meta.min ?? 0;
      const max = numeric(params.max_value) ?? meta.max ?? 100;
      const step =
        numeric(params.step) ?? meta.step ?? (Math.abs(max - min) > 20 ? 1 : 0.5);
      const value = numeric(cap.state?.value) ?? meta.min ?? min;

      items.push({
        key: `${instance}-${index}`,
        type: cap.type,
        instance,
        label: meta.label,
        unit: meta.unit,
        min,
        max,
        step,
        value,
      });
    });

    const tempKCap = capabilities.find(
      (c) =>
        c.type === "devices.capabilities.color_setting" &&
        (c.parameters as Record<string, any> | null | undefined)?.temperature_k
    );
    const hasTempRange = items.some(
      (item) => item.instance === "color_temperature" || item.instance === "temperature_k"
    );

    if (tempKCap && !hasTempRange) {
      const config = (tempKCap.parameters as Record<string, any>).temperature_k as {
        min?: number;
        max?: number;
      };
      const min = numeric(config?.min) ?? 2700;
      const max = numeric(config?.max) ?? 6500;
      const stateValue =
        tempKCap.state?.instance === "temperature_k"
          ? numeric(tempKCap.state.value)
          : undefined;

      items.push({
        key: "temperature_k",
        type: "devices.capabilities.color_setting",
        instance: "temperature_k",
        label: "Цветовая температура",
        unit: "K",
        min,
        max,
        step: 100,
        value: stateValue ?? Math.round((min + max) / 2),
      });
    }

    return items;
  }, [capabilities]);

  const colorCaps = useMemo(
    () =>
      capabilities.filter(
        (c) =>
          (c.type === "devices.capabilities.color_setting" ||
            c.type === "devices.capabilities.color") &&
          getInstance(c) !== "temperature_k"
      ),
    [capabilities]
  );

  const modeCaps = useMemo(
    () =>
      capabilities
        .filter((c) => c.type === "devices.capabilities.mode")
        .map((cap) => ({ cap, options: getModeOptions(cap) }))
        .filter(({ options }) => options.length > 0),
    [capabilities]
  );

  const toggleCaps = useMemo(
    () => capabilities.filter((c) => c.type === "devices.capabilities.toggle"),
    [capabilities]
  );

  const hasAnyControl =
    powerChannels.length > 0 ||
    ranges.length > 0 ||
    colorCaps.length > 0 ||
    modeCaps.length > 0 ||
    toggleCaps.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-[#d4af37]/25 bg-[#0d0f12] p-0">
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-3 pr-6">
            <DeviceIcon icon={icon} size="expanded" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-foreground">
                {device.name}
              </span>
              <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {getDeviceTypeLabel(device.type)}
              </span>
            </span>
            <LuxBadge variant={isOn ? "gold" : "muted"} active={isOn}>
              {isCurtain
                ? isOn
                  ? "Открыто"
                  : "Закрыто"
                : isOn
                  ? "Вкл"
                  : "Выкл"}
            </LuxBadge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Настройки устройства {device.name}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-5 py-4">
          {powerChannels.length > 0 && (
            <Section title="Питание" icon={Power}>
              {powerChannels.map((cap, index) => {
                const instance = getInstance(cap) || "on";
                const label =
                  powerChannels.length > 1
                    ? instance === "on"
                      ? "Основной канал"
                      : `Канал ${index + 1}`
                    : "Питание";
                return (
                  <div
                    key={`${instance}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                  >
                    <span className="text-xs text-slate-300">{label}</span>
                    <Switch
                      checked={cap.state?.value === true}
                      onCheckedChange={(checked) =>
                        send("devices.capabilities.on_off", instance, checked)
                      }
                      aria-label={`${device.name}: ${label}`}
                    />
                  </div>
                );
              })}
            </Section>
          )}

          {ranges.length > 0 && (
            <Section title="Параметры" icon={Gauge}>
              {ranges.map((range) => (
                <div
                  key={range.key}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3"
                >
                  <LuxBar
                    value={range.value}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    label={range.label}
                    display={(value) => formatRange(value, range.instance, range.unit)}
                    onChange={(value) => send(range.type, range.instance, value)}
                  />
                </div>
              ))}
            </Section>
          )}

          {colorCaps.length > 0 && (
            <Section title="Цвет" icon={Palette}>
              {colorCaps.map((cap, index) => (
                <ColorControl
                  key={`${getInstance(cap)}-${index}`}
                  cap={cap}
                  onChange={send}
                />
              ))}
            </Section>
          )}

          {modeCaps.length > 0 && (
            <Section title="Режимы" icon={Layers}>
              {modeCaps.map(({ cap, options }, index) => {
                const instance = getInstance(cap);
                const currentValue = String(cap.state?.value ?? "");
                return (
                  <div
                    key={`${instance}-${index}`}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3"
                  >
                    <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {MODE_LABELS[instance] ?? valueLabel(instance)}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((option) => {
                        const active = currentValue === option;
                        return (
                          <LuxButton
                            key={option}
                            variant={active ? "gold" : "quiet"}
                            glow={active}
                            onClick={() =>
                              send("devices.capabilities.mode", instance, option)
                            }
                            className="px-2.5 py-1.5"
                          >
                            {valueLabel(option)}
                          </LuxButton>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          {toggleCaps.length > 0 && (
            <Section title="Дополнительно" icon={ToggleRight}>
              {toggleCaps.map((cap, index) => {
                const instance = getInstance(cap);
                return (
                  <div
                    key={`${instance}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                  >
                    <span className="text-xs text-slate-300">
                      {TOGGLE_LABELS[instance] ?? valueLabel(instance)}
                    </span>
                    <Switch
                      checked={cap.state?.value === true}
                      onCheckedChange={(checked) =>
                        send("devices.capabilities.toggle", instance, checked)
                      }
                      aria-label={`${device.name}: ${TOGGLE_LABELS[instance] ?? instance}`}
                    />
                  </div>
                );
              })}
            </Section>
          )}

          {!hasAnyControl && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              У этого устройства нет дополнительных настроек.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#d4af37]/80">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ColorControl({
  cap,
  onChange,
}: {
  cap: DeviceCapability;
  onChange: (type: string, instance: string, value: unknown) => void;
}) {
  const instance = getInstance(cap);
  const currentRgb = readColorRgb(cap);
  const currentHex = currentRgb ? rgbToHex(currentRgb) : "#ffffff";
  const isRgb =
    instance === "rgb" ||
    cap.type === "devices.capabilities.color" ||
    (cap.parameters as Record<string, any> | null | undefined)?.color_model === "rgb";

  const sendRgb = (rgb: Rgb) => {
    if (isRgb) {
      onChange(cap.type, "rgb", rgb);
    } else {
      onChange(cap.type, "hsv", rgbToHsv(rgb));
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-slate-400">
        Оттенок
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {RGB_PRESETS.map(({ rgb, label }) => {
          const active =
            currentRgb !== undefined &&
            currentRgb.r === rgb.r &&
            currentRgb.g === rgb.g &&
            currentRgb.b === rgb.b;
          return (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={`Цвет ${label}`}
              onClick={() => sendRgb(rgb)}
              className={`h-7 w-7 rounded-full transition-all ${
                active
                  ? "scale-110 ring-2 ring-[#d4af37] ring-offset-1 ring-offset-[#0d0f12]"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: rgbToHex(rgb) }}
            />
          );
        })}

        <label
          className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20"
          title="Свой цвет"
        >
          <span
            className="absolute inset-0"
            style={{ background: "conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
          />
          <span
            className="absolute inset-1 rounded-full border border-black/40"
            style={{ backgroundColor: currentHex }}
          />
          <input
            type="color"
            value={currentHex}
            onChange={(event) => sendRgb(hexToRgb(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Выбрать свой цвет"
          />
        </label>
      </div>
    </div>
  );
}
