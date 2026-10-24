import { useMemo } from "react";
import { useGetWeather } from "@workspace/api-client-react";
import { getWeatherEmoji } from "@/lib/yandex";
import { Droplets, Wind, Umbrella, MapPin, Sunrise } from "lucide-react";
import type { WeatherWidgetData } from "@/hooks/use-dashboard-layout";

interface WeatherWidgetProps {
  data: WeatherWidgetData;
  onChange?: (data: WeatherWidgetData) => void;
  readOnly?: boolean;
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function WeatherWidget({ data }: WeatherWidgetProps) {
  const weatherQuery = useGetWeather();
  const w = weatherQuery.data;
  const current = w?.current;

  // Почасовые осадки (следующие ~12 часов)
  const hourly = useMemo(() => {
    if (!w?.hourly?.time || !w.hourly.precipitation_probability) return [];
    const points: { time: string; prob: number }[] = [];
    const now = Date.now();
    for (let i = 0; i < w.hourly.time.length; i++) {
      const t = new Date(w.hourly.time[i]).getTime();
      if (t < now - 3600_000) continue;
      points.push({
        time: w.hourly.time[i],
        prob: w.hourly.precipitation_probability[i] ?? 0,
      });
    }
    return points.slice(0, 12);
  }, [w]);

  if (!current) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 rounded-2xl bg-[#111113] border border-[#1f1f22]">
        <span className="text-3xl mb-2">🌡️</span>
        <span className="text-xs text-neutral-400">Погода недоступна</span>
      </div>
    );
  }

  const feelsLike = current.temperature_2m + (current.temperature_2m > 20 ? 2 : -2);
  const maxProb = Math.max(...hourly.map((h) => h.prob), 1);

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{getWeatherEmoji(current.weather_code)}</span>
          {data.label && (
            <span className="text-[10px] text-neutral-400">{data.label}</span>
          )}
        </div>
        {w?.city && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {w.city}
          </span>
        )}
      </div>

      {/* Current temperature */}
      <div className="flex items-baseline justify-center mt-1 shrink-0">
        <span className="text-5xl font-light text-neutral-100 tabular-nums leading-none">
          {Math.round(current.temperature_2m)}°
        </span>
        <span className="text-xs text-muted-foreground ml-2">ошущается {Math.round(feelsLike)}°</span>
      </div>

      {/* Details row */}
      <div className="flex items-center justify-center gap-4 mt-2 mb-2 shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Droplets className="w-3 h-3 text-[hsl(217,91%,60%)]" />
          {current.relative_humidity_2m}%
        </span>
        {current.wind_speed_10m !== undefined && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wind className="w-3 h-3 text-[hsl(142,70%,45%)]" />
            {Math.round(current.wind_speed_10m)} м/с
          </span>
        )}
        {current.precipitation_probability != null && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Umbrella className="w-3 h-3 text-[hsl(38,95%,64%)]" />
            {current.precipitation_probability}%
          </span>
        )}
      </div>

      {/* Hourly precipitation bars */}
      {hourly.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-1 shrink-0">
            <Sunrise className="w-3 h-3" />
            <span>Осадки по часам</span>
          </div>
          <div className="flex-1 min-h-0 flex items-end gap-1.5">
            {hourly.map((h, idx) => {
              const heightPct = Math.max(8, Math.round((h.prob / maxProb) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
                  <span className={`text-[8px] tabular-nums ${h.prob >= 50 ? "text-[hsl(38,95%,64%)]" : h.prob >= 25 ? "text-[hsl(38,95%,64%)]/70" : "text-muted-foreground/50"}`}>
                    {h.prob}%
                  </span>
                  <div
                    className={`w-full rounded-sm transition-all ${
                      h.prob >= 50
                        ? "bg-[hsl(38,95%,64%)]"
                        : h.prob >= 25
                        ? "bg-[hsl(38,95%,64%)]/50"
                        : "bg-[hsl(217,91%,60%)]/30"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: 3 }}
                  />
                  <span className="text-[8px] text-muted-foreground/70 truncate">{formatHour(h.time)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}