import { useState, useEffect, useMemo } from "react";
import { useGetWeather } from "@workspace/api-client-react";
import { getWeatherEmoji, getSensorReadings, type Device } from "@/lib/yandex";
import { getPinnedSensorIds, getPinnedSensorIcon } from "@/hooks/use-pinned-sensors";
import { pmQuality, co2Quality } from "@/components/sensors";
import { useSensorHistory } from "@/hooks/use-sensor-history";
import {
  Thermometer,
  Droplets,
  Wind,
  DoorOpen,
  Users,
  Sun,
  Battery,
  Droplet,
  Vibrate,
  Activity,
  Flame,
  Fuel,
  type LucideIcon,
} from "lucide-react";

interface InfoPanelProps {
  roomDevices: Device[];
  allDevices?: Device[];
  editMode?: boolean;
}

// Sensor type definition
interface SensorType {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  extract: (readings: Record<string, any>) => { value: string; badge?: string; badgeClass?: string; color?: string } | null;
}

// All available sensor types — only shown if data exists
const SENSOR_TYPES: SensorType[] = [
  {
    id: "temperature",
    icon: Thermometer,
    label: "Темп.",
    color: "text-[hsl(38,95%,64%)]",
    extract: (r) => r.temperature !== undefined ? { value: `${r.temperature.toFixed(1)}°` } : null,
  },
  {
    id: "humidity",
    icon: Droplets,
    label: "Влаж.",
    color: "text-[hsl(217,91%,60%)]",
    extract: (r) => r.humidity !== undefined ? { value: `${Math.round(r.humidity)}%` } : null,
  },
  {
    id: "air",
    icon: Wind,
    label: "Воздух",
    color: "text-[hsl(142,70%,45%)]",
    extract: (r) => {
      if (r.co2 !== undefined) {
        const q = co2Quality(r.co2);
        return { value: `${r.co2}`, badge: q?.label, badgeClass: q?.badge };
      }
      if (r.pm25 !== undefined) {
        const q = pmQuality(r.pm25);
        return { value: `PM${r.pm25}`, badge: q?.label, badgeClass: q?.badge };
      }
      return null;
    },
  },
  {
    id: "illumination",
    icon: Sun,
    label: "Свет",
    color: "text-[hsl(var(--gold))]",
    extract: (r) => r.illumination !== undefined ? { value: `${Math.round(r.illumination)}` } : null,
  },
  {
    id: "open",
    icon: DoorOpen,
    label: "Двери",
    color: "text-[hsl(38,95%,64%)]",
    extract: (r) => r.open !== undefined ? { value: r.open ? "Откр" : "Закр", color: r.open ? "text-[hsl(38,95%,64%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
  {
    id: "presence",
    icon: Users,
    label: "Есть",
    color: "text-[hsl(217,91%,60%)]",
    extract: (r) => r.presence !== undefined ? { value: r.presence ? "Да" : "Нет", color: r.presence ? "text-[hsl(217,91%,60%)]" : "text-[hsl(40,8%,40%)]" } : null,
  },
  {
    id: "motion",
    icon: Activity,
    label: "Движение",
    color: "text-[hsl(38,95%,64%)]",
    extract: (r) => r.motion !== undefined ? { value: r.motion ? "Да" : "Нет", color: r.motion ? "text-[hsl(38,95%,64%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
  {
    id: "smoke",
    icon: Flame,
    label: "Дым",
    color: "text-[hsl(0,72%,51%)]",
    extract: (r) => r.smoke !== undefined ? { value: r.smoke ? "Да" : "Нет", color: r.smoke ? "text-[hsl(0,72%,51%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
  {
    id: "gas",
    icon: Fuel,
    label: "Газ",
    color: "text-[hsl(38,95%,64%)]",
    extract: (r) => r.gas !== undefined ? { value: r.gas ? "Да" : "Нет", color: r.gas ? "text-[hsl(38,95%,64%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
  {
    id: "water_leak",
    icon: Droplet,
    label: "Протечка",
    color: "text-[hsl(217,91%,60%)]",
    extract: (r) => r.water_leak !== undefined ? { value: r.water_leak ? "Да" : "Нет", color: r.water_leak ? "text-[hsl(217,91%,60%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
  {
    id: "vibration",
    icon: Vibrate,
    label: "Вибрация",
    color: "text-[hsl(38,95%,64%)]",
    extract: (r) => r.vibration !== undefined ? { value: r.vibration ? "Да" : "Нет", color: r.vibration ? "text-[hsl(38,95%,64%)]" : "text-[hsl(142,70%,45%)]" } : null,
  },
];

export function InfoPanel({ roomDevices, allDevices, editMode }: InfoPanelProps) {
  const [now, setNow] = useState(new Date());
  const weatherQuery = useGetWeather();
  const w = weatherQuery.data;
  const current = w?.current;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scan all room devices and collect battery levels
  const allReadings = useMemo(() => {
    const merged: Record<string, any> = {};
    let battery: number | undefined;

    for (const d of roomDevices) {
      const r = getSensorReadings(d);
      for (const [key, val] of Object.entries(r)) {
        if (key === "battery") {
          if (battery === undefined && val !== undefined) battery = val as number;
          continue;
        }
        if (merged[key] === undefined && val !== undefined) merged[key] = val;
      }
    }

    return { readings: merged, battery };
  }, [roomDevices]);

  // История показаний сенсоров комнаты (для спарклайнов)
  const sensorHistory = useSensorHistory(roomDevices);

  const sparkSeries = useMemo(() => {
    const sensorIds = roomDevices
      .filter((d) => d.type.includes("sensor"))
      .map((d) => d.id);

    const merge = (key: "temperature" | "humidity"): number[] | null => {
      const series = sensorIds
        .map((id) => sensorHistory[id]?.[key] ?? [])
        .filter((s) => s.length > 0);
      if (series.length === 0) return null;
      const len = Math.max(...series.map((s) => s.length));
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        const vals = series.filter((s) => s.length > i).map((s) => s[i]);
        out.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      return out;
    };

    return { temperature: merge("temperature"), humidity: merge("humidity") };
  }, [roomDevices, sensorHistory]);

  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });

  const battery = allReadings.battery;
  const batteryColor = battery !== undefined
    ? battery > 60 ? "text-[hsl(142,70%,45%)]" : battery > 20 ? "text-[hsl(38,95%,64%)]" : "text-[hsl(0,72%,51%)]"
    : "text-muted-foreground";

  return (
    <div className="mx-3 py-3 flex items-stretch gap-6 h-[120px]">

      {/* ── Clock ── */}
      <div className="flex flex-col items-center justify-center shrink-0 min-w-[140px]">
        <p className="text-5xl font-light text-foreground tabular-nums tracking-tight leading-none">
          {timeStr}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 capitalize text-center">
          {dateStr}
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="w-px bg-border/40 shrink-0" />

      {/* ── Weather: emoji + temperature ── */}
      <div className="flex items-center gap-3 shrink-0">
        {current ? (
          <>
            <span className="text-4xl leading-none shrink-0 self-start">
              {getWeatherEmoji(current.weather_code)}
            </span>
            <div className="min-w-0">
              <span className="text-5xl font-light text-foreground block leading-none tabular-nums tracking-tight">
                {Math.round(current.temperature_2m)}°
              </span>
              <div className="text-xs text-muted-foreground mt-1.5">
                ощущается {Math.round(current.temperature_2m + (current.temperature_2m > 20 ? 1 : -1))}°
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xl text-muted-foreground">
            <span className="text-4xl">🌡️</span>
            <span>—°C</span>
          </div>
        )}
      </div>

      {/* ── Weather details: humidity, wind, location ── */}
      {current && (
        <div className="flex flex-col justify-center gap-1 shrink-0 text-xs text-muted-foreground min-w-[120px]">
          <span className="flex items-center gap-1.5">
            <Droplets className="w-4 h-4 text-[hsl(217,91%,60%)]" />
            {current.relative_humidity_2m}%
          </span>
          {current.wind_speed_10m !== undefined && (
            <span className="flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-[hsl(142,70%,45%)]" />
              {Math.round(current.wind_speed_10m)} м/с
            </span>
          )}
          {current.precipitation_probability != null && (
            <span className="flex items-center gap-1.5">
              ☂️ {current.precipitation_probability}%
            </span>
          )}
          {w?.city && (
            <span className="flex items-center gap-1.5">
              📍 {w.city}
            </span>
          )}
        </div>
      )}

      {/* ── Right: Dynamic sensors ── */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {/* Закреплённые датчики (напр. вент-канал из скрытой комнаты «Сервис»):
            выводятся всегда, независимо от выбранной комнаты */}
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5 py-1.5 pl-2 pr-2.5">
          <span className="text-[10px] font-medium leading-none text-[hsl(var(--gold))] shrink-0">📌 Закреплено</span>
          <div className="flex items-center gap-2">
            {(allDevices ?? []).filter((d) => getPinnedSensorIds().includes(d.id)).map((pd) => {
              const r = getSensorReadings(pd);
              const icon = getPinnedSensorIcon(pd.id);
              const label = String(pd.name ?? "Датчик");
              let value: string | null = null;
              let color = "text-[hsl(38,95%,64%)]";
              if (r.temperature !== undefined) {
                value = `${Number(r.temperature).toFixed(1)}°`;
              } else if (r.humidity !== undefined) {
                value = `${Math.round(Number(r.humidity))}%`;
                color = "text-[hsl(217,91%,60%)]";
              } else if (r.co2 !== undefined) {
                value = `${Number(r.co2)}`;
              } else if (r.pm25 !== undefined) {
                value = `PM${Number(r.pm25)}`;
              }
              if (!value) return null;
              return (
                <div key={pd.id} className="rounded-lg border border-[hsl(var(--gold))]/25 bg-background/60 p-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-lg leading-none">{icon ?? "🌬️"}</span>
                    <span className="text-[10px] text-muted-foreground leading-none max-w-[120px] truncate">{label}</span>
                    <span className={`text-sm font-semibold leading-none tabular-nums ${color}`}>{value}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {SENSOR_TYPES.map((st) => {
          const result = st.extract(allReadings.readings);
          if (result) {
            return (
              <SensorCard
                key={st.id}
                icon={<st.icon className="w-5 h-5" />}
                label={st.label}
                value={result.value}
                color={(result as any).color ?? st.color}
                badge={result.badge}
                badgeClass={result.badgeClass}
                sparkline={st.id === "temperature" ? sparkSeries.temperature : st.id === "humidity" ? sparkSeries.humidity : undefined}
                battery={st.id === "vibration" ? battery : undefined}
                batteryColor={st.id === "vibration" ? batteryColor : undefined}
              />
            );
          }
          // В режиме редактирования — показать все возможные датчики (призрак)
          if (editMode) {
            return (
              <SensorCard
                key={st.id}
                icon={<st.icon className="w-5 h-5" />}
                label={st.label}
                value="—"
                color="text-muted-foreground/40"
                ghost
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function SensorCard({
  icon,
  label,
  value,
  color,
  badge,
  badgeClass,
  sparkline,
  battery,
  batteryColor,
  ghost,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  badge?: string;
  badgeClass?: string;
  sparkline?: number[] | null;
  battery?: number;
  batteryColor?: string;
  ghost?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-between py-2 px-2 rounded-xl h-full ${ghost ? "opacity-30" : ""}`}>
      {/* Row 1: Icon */}
      <span className={`${color}`}>{icon}</span>
      {/* Row 2: Label */}
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      {/* Row 3: Value */}
      <span className="text-base font-bold text-foreground tabular-nums leading-none">{value}</span>
      {/* Row 4: Info */}
      <div className="h-4 flex items-center justify-center">
        {sparkline && sparkline.length >= 2 ? (
          <Sparkline data={sparkline} className="text-[hsl(38,95%,64%)]" />
        ) : badge && badgeClass ? (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badgeClass}`}>{badge}</span>
        ) : battery !== undefined ? (
          <span className={`flex items-center gap-0.5 text-[9px] ${batteryColor}`}>
            <Battery className="w-3 h-3" />
            {Math.round(battery)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const W = 44;
  const H = 12;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / span) * (H - 1) - 0.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
