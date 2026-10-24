import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { Sparkline } from "./Sparkline";
import { isDeviceOn, getDeviceIcon, getDeviceCapability, type Device } from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { deviceCommandQueue } from "@/lib/command-queue";
import type { TileSize } from "@/hooks/use-panel-config";
import { LuxBar, CardFrame } from "./premium";

import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";

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
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
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

interface LightCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  sensorHistory?: { temperature: number[]; humidity: number[] };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function LightCard({
  device,
  token,
  size,
  tileConfig,
  sensorHistory,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: LightCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const brightnessCap = getDeviceCapability(device, "devices.capabilities.range", "brightness");
  const brightness = brightnessCap?.state?.value as number | undefined;
  const isPinned = tileConfig?.pinned ?? false;

  const tempHistory = sensorHistory?.temperature ?? [];
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const colorTempCap = getDeviceCapability(device, "devices.capabilities.range", "color_temperature");
  const colorTemp = colorTempCap?.state?.value as number | undefined;
  const colorTempMin = colorTempCap?.parameters?.min_value as number | undefined ?? 2700;
  const colorTempMax = colorTempCap?.parameters?.max_value as number | undefined ?? 6500;

  // Цветовая температура через color_setting (temperature_k) — для лент и ночников.
  // Ищем по параметрам, а не по parameters.instance: у HSV-лент/ночников instance
  // лежит только в state (или отсутствует), и общий getDeviceCapability их не находит.
  const colorCap = device.capabilities?.find((c) => c.type === "devices.capabilities.color_setting");
  const colorTempKParams = (colorCap?.parameters as any)?.temperature_k as
    | { min?: number; max?: number }
    | undefined;
  const colorTempK = colorCap?.state?.instance === "temperature_k"
    ? (colorCap.state?.value as number | undefined)
    : undefined;

  // Выбор цвета RGB/HSV (color_setting / hsv)
  const colorIsHsv = (colorCap?.parameters as any)?.color_model === "hsv" || colorCap?.state?.instance === "hsv";
  const rgbCurrent = colorCap?.state?.instance === "rgb" && typeof colorCap.state?.value === "object"
    ? (colorCap.state?.value as { r?: number; g?: number; b?: number })
    : undefined;
  const currentRgb = rgbCurrent ? { r: rgbCurrent.r ?? 255, g: rgbCurrent.g ?? 255, b: rgbCurrent.b ?? 255 } : undefined;

  const contextMenuItems = [
    {
      id: "pin",
      label: isPinned ? "Открепить" : "Закрепить",
      icon: isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: () => onPin?.(),
    },
    {
      id: "resize-expand",
      label: "Увеличить",
      icon: <Maximize2 className="w-4 h-4" />,
      onClick: () => onResize?.("2x1"),
    },
    {
      id: "resize-shrink",
      label: "Уменьшить",
      icon: <Minimize2 className="w-4 h-4" />,
      onClick: () => onResize?.("1x1"),
    },
    {
      id: "delete",
      label: "Скрыть",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete?.(),
      danger: true,
    },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    handleLongPressStart(e, contextMenuItems);
  }, [contextMenuItems, handleLongPressStart]);

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
      toast({ variant: "success", title: newValue ? "Свет включён" : "Свет выключен", description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось изменить состояние ${device.name}` });
    });
  };

  const rounded = (v: number) => Math.round(v);

  return (
    <CardFrame
      size={size}
      variant="toggle"
      active={isOn}
      pinned={isPinned}
      onContextMenu={handleContextMenu}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      power={{ on: isOn, onChange: handleToggle, label: device.name }}
      timer
      top={
        <div className="flex items-baseline gap-1">
          <span className={`font-bold leading-none transition-all duration-200 ${size === "compact" ? "text-base" : "text-xl"} ${isOn ? "text-[#f3e5ab]" : "text-muted-foreground"}`}>
            {brightness !== undefined ? `${rounded(brightness)}%` : "—"}
          </span>
        </div>
      }
      bottom={
        <div className={`w-full space-y-1.5 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {brightnessCap && brightness !== undefined && (
            <div className="w-full">
              <LuxBar
                value={brightness}
                min={0}
                max={100}
                step={1}
                label="Яркость"
                display={(v) => `${rounded(v)}%`}
                onChange={(v) =>
                  controlDevice.mutate({
                    deviceId: device.id,
                    data: { actions: [{ type: "devices.capabilities.range", state: { instance: "brightness", value: v } }] },
                  })
                }
              />
            </div>
          )}

          {(colorTempCap && colorTemp !== undefined) || colorTempKParams ? (
            <div className="w-full">
              <LuxBar
                value={colorTemp ?? colorTempK ?? Math.round(((colorTempKParams?.min ?? 2700) + (colorTempKParams?.max ?? 6500)) / 2)}
                min={colorTempCap ? colorTempMin : (colorTempKParams?.min ?? 2700)}
                max={colorTempCap ? colorTempMax : (colorTempKParams?.max ?? 6500)}
                step={100}
                label="Тёплый / Холодный"
                display={(v) => `${rounded(v)}K`}
                onChange={(v) => {
                  if (colorTempCap && colorTemp !== undefined) {
                    controlDevice.mutate({
                      deviceId: device.id,
                      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "color_temperature", value: v } }] },
                    });
                  } else {
                    controlDevice.mutate({
                      deviceId: device.id,
                      data: { actions: [{ type: "devices.capabilities.color_setting", state: { instance: "temperature_k", value: v } }] },
                    });
                  }
                }}
              />
            </div>
          ) : null}

          {colorIsHsv && (
            <div className="w-full">
              <span className="text-[10px] text-slate-400 block mb-1 text-center">Цвет</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                  {RGB_PRESETS.map(color => {
                    const hex = rgbToHex(color.r, color.g, color.b);
                    const isActive = currentRgb && currentRgb.r === color.r && currentRgb.g === color.g && currentRgb.b === color.b;
                    const hsv = rgbToHsv(color.r, color.g, color.b);
                    return (
                      <button
                        key={hex}
                        type="button"
                        title={color.label}
                        aria-label={`Цвет ${color.label}`}
                        onClick={() =>
                          controlDevice.mutate({
                            deviceId: device.id,
                            data: { actions: [{ type: "devices.capabilities.color_setting", state: { instance: "hsv", value: hsv } }] },
                          })
                        }
                        className={`w-6 h-6 rounded-full transition-all ${isActive ? "ring-2 ring-[#d4af37] ring-offset-1 ring-offset-transparent scale-110" : "hover:scale-110"}`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

          {isOn && tempHistory.length > 1 && (size === "expanded" || size === "full") && (
            <div className="mt-1">
              <Sparkline values={tempHistory} color="hsl(var(--device-light))" width={80} height={24} />
            </div>
          )}
        </div>
      }
      overlay={
        <ContextMenu
          open={menuState.open}
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onClose={closeMenu}
        />
      }
    />
  );
}
