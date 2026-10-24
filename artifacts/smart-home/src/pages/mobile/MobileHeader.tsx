import { useMemo } from "react";
import { useGetWeather } from "@workspace/api-client-react";
import { getWeatherEmoji, getSensorReadings, type Device } from "@/lib/yandex";
import { co2Quality, pmQuality } from "@/components/sensors";
import { getPinnedSensorIds, getPinnedSensorIcon } from "@/hooks/use-pinned-sensors";
import {
  Thermometer,
  Droplets,
  Wind,
  DoorOpen,
  Users,
  Activity,
  Flame,
  Fuel,
  Droplet,
  Sun,
  Vibrate,
  BatteryMedium,
} from "lucide-react";

interface MobileHeaderProps {
  roomDevices: Device[];
  allDevices?: Device[];
}

interface Chip {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const C: Record<string, string> = {
  gold: "text-[hsl(var(--gold))]",
  green: "text-[hsl(142,70%,45%)]",
  red: "text-[hsl(0,72%,51%)]",
  amber: "text-[hsl(38,95%,64%)]",
  blue: "text-[hsl(217,91%,60%)]",
};

// Фиксированная высота табло датчиков: ровно 2 строки по 36px + gap 6px
// (одна высота для всех комнат — нет «прыжка» при переключении)
const SENSOR_BOARD_H = 78;

export function MobileHeader({ roomDevices, allDevices }: MobileHeaderProps) {
  const weatherQuery = useGetWeather();
  const w = weatherQuery.data;
  const current = w?.current;

  const readings = useMemo(() => {
    const merged: Record<string, any> = {};
    for (const d of roomDevices) {
      const r = getSensorReadings(d);
      for (const [key, val] of Object.entries(r)) {
        if (merged[key] === undefined && val !== undefined) merged[key] = val;
      }
    }
    return merged;
  }, [roomDevices]);

  const boolChip = (value: boolean): { value: string; color: string } =>
    value ? { value: "Да", color: C.red } : { value: "Нет", color: C.green };

  const chips: Chip[] = [];
  if (readings.temperature !== undefined) {
    chips.push({ id: "temperature", icon: <Thermometer className="w-4 h-4" />, label: "Темп.", value: `${Number(readings.temperature).toFixed(1)}°`, color: C.amber });
  }
  if (readings.humidity !== undefined) {
    chips.push({ id: "humidity", icon: <Droplets className="w-4 h-4" />, label: "Влаж.", value: `${Math.round(Number(readings.humidity))}%`, color: C.blue });
  }
  if (readings.co2 !== undefined || readings.pm25 !== undefined) {
    const q = readings.co2 !== undefined ? co2Quality(Number(readings.co2)) : pmQuality(Number(readings.pm25));
    chips.push({
      id: "air",
      icon: <Wind className="w-4 h-4" />,
      label: "Воздух",
      value: readings.co2 !== undefined ? `${readings.co2}` : `PM${Number(readings.pm25)}`,
      color: q.badge.includes("red") ? C.red : q.badge.includes("yellow") ? C.amber : C.green,
    });
  }
  if (readings.illumination !== undefined) {
    chips.push({ id: "illumination", icon: <Sun className="w-4 h-4" />, label: "Свет", value: `${Math.round(Number(readings.illumination))}`, color: C.gold });
  }
  if (readings.open !== undefined) {
    chips.push({
      id: "open",
      icon: <DoorOpen className="w-4 h-4" />,
      label: "Двери",
      value: readings.open ? "Откр" : "Закр",
      color: readings.open ? C.amber : C.green,
    });
  }
  const addBool = (id: string, label: string, icon: React.ReactNode, v: boolean | undefined) => {
    if (v === undefined) return;
    const r = boolChip(v);
    chips.push({ id, icon, label, value: r.value, color: r.color });
  };
  addBool("presence", "Есть", <Users className="w-4 h-4" />, readings.presence);
  addBool("motion", "Движение", <Activity className="w-4 h-4" />, readings.motion);
  addBool("vibration", "Вибрация", <Vibrate className="w-4 h-4" />, readings.vibration);
  addBool("smoke", "Дым", <Flame className="w-4 h-4" />, readings.smoke);
  addBool("gas", "Газ", <Fuel className="w-4 h-4" />, readings.gas);
  addBool("water_leak", "Протечка", <Droplet className="w-4 h-4" />, readings.water_leak);

  if (readings.battery !== undefined) {
    const b = Number(readings.battery);
    const color = b > 20 ? C.green : C.red;
    chips.push({ id: "battery", icon: <BatteryMedium className="w-4 h-4" />, label: "Батарея", value: `${Math.round(b)}%`, color });
  }

  // Закреплённые датчики (например, датчик вент-канала из скрытой комнаты «Сервис»):
  // показываются на табло ИЗ ВСЕХ устройств, независимо от выбранной комнаты
  for (const pd of allDevices ?? []) {
    if (!getPinnedSensorIds().includes(pd.id)) continue;
    const pr = getSensorReadings(pd);
    const icon = getPinnedSensorIcon(pd.id);
    let value = "";
    let color = C.amber;
    if (pr.temperature !== undefined) {
      value = `${Number(pr.temperature).toFixed(1)}°`;
    } else if (pr.humidity !== undefined) {
      value = `${Math.round(Number(pr.humidity))}%`;
      color = C.blue;
    } else if (pr.co2 !== undefined) {
      value = `${pr.co2}`;
    }
    if (!value) continue;
    chips.push({
      id: `pin-${pd.id}`,
      icon: icon ? <span className="text-base leading-none">{icon}</span> : <Wind className="w-4 h-4" />,
      label: String(pd.name ?? "Датчик").split(" ")[0],
      value,
      color,
    });
  }

  const feel = current
    ? Math.round(current.temperature_2m + (current.temperature_2m > 20 ? 1 : -1))
    : null;

  return (
    <div className="pt-3 pb-2 space-y-2">
      {/* Погода: температура + влажность, осадки, ветер, город (как в ЮП) */}
      <div className="flex items-center gap-3 px-3 pb-2 border-b border-border/25">
        {current ? (
          <>
            <span className="text-4xl leading-none shrink-0">
              {getWeatherEmoji(current.weather_code)}
            </span>
            <div className="min-w-0 shrink-0">
              <span className="text-4xl font-light text-foreground leading-none tabular-nums tracking-tight">
                {Math.round(current.temperature_2m)}°
              </span>
              <div className="text-[10px] text-muted-foreground mt-1">
                ощущается {feel}°
              </div>
            </div>
            <div className="ml-auto grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground min-w-0">
              <span className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 shrink-0 text-[hsl(217,91%,60%)]" />
                <span className="tabular-nums">{current.relative_humidity_2m}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="shrink-0">☂️</span>
                <span className="tabular-nums">
                  {current.precipitation_probability != null
                    ? `${current.precipitation_probability}%`
                    : "—"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 shrink-0 text-[hsl(142,70%,45%)]" />
                <span className="tabular-nums">
                  {current.wind_speed_10m !== undefined
                    ? `${Math.round(current.wind_speed_10m)} м/с`
                    : "—"}
                </span>
              </span>
              <span className="flex items-center gap-1 truncate">
                <span className="shrink-0">📍</span>
                <span className="truncate">{w?.city ?? "—"}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xl text-muted-foreground">
            <span className="text-4xl">🌡️</span>
            <span>—°C</span>
          </div>
        )}
      </div>

      {/* Табло датчиков комнаты: всегда 2 строки фиксированной высоты */}
      {chips.length > 0 && (
        <div
          className="flex flex-wrap content-start gap-1.5 px-3 overflow-y-auto"
          style={{ scrollbarWidth: "none", height: SENSOR_BOARD_H, minHeight: SENSOR_BOARD_H }}
        >
          {chips.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-1.5 h-9 rounded-lg border border-border/50 bg-card px-2.5 ${c.color}`}
            >
              {c.icon}
              <span className="text-[10px] text-muted-foreground leading-none">{c.label}</span>
              <span className="text-xs font-bold tabular-nums leading-none">{c.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}