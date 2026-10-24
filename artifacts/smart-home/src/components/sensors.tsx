import { getSensorReadings } from "@/lib/yandex";

/* ─── Inline sensor readings (compact, for cards) ─── */
export function SensorReadingsInline({ device }: { device: any }) {
  const readings = getSensorReadings(device);
  if (Object.keys(readings).length === 0) return null;

  return (
    <div className="flex gap-3 flex-wrap mt-2">
      {readings.temperature !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(var(--device-heating))" }}>
          {readings.temperature.toFixed(1)}°C
        </span>
      )}
      {readings.humidity !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(217 91% 60%)" }}>
          {Math.round(readings.humidity)}%
        </span>
      )}
      {readings.pm25 !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(38 95% 64%)" }}>
          PM2.5: {Math.round(readings.pm25)} µg/м³
        </span>
      )}
      {readings.co2 !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(var(--device-success))" }}>
          CO₂: {Math.round(readings.co2)} ppm
        </span>
      )}
      {readings.battery !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(var(--device-success))" }}>
          🔋 {Math.round(readings.battery)}%
        </span>
      )}
    </div>
  );
}

/* ─── PM quality badge ─── */
export function pmQuality(pm25: number) {
  if (pm25 <= 12) return { label: "Хорошо", badge: "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/25" };
  if (pm25 <= 35) return { label: "Норма", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" };
  return { label: "Плохо", badge: "bg-red-500/15 text-red-400 border-red-500/25" };
}

/* ─── CO₂ quality badge ─── */
export function co2Quality(co2: number) {
  if (co2 <= 800) return { label: "Свежий", badge: "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/25" };
  if (co2 <= 1200) return { label: "Норма", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" };
  return { label: "Душно", badge: "bg-red-500/15 text-red-400 border-red-500/25" };
}
