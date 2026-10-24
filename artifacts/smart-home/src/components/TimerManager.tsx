import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceTimer } from "@/hooks/use-panel-config";

interface TimerManagerProps {
  timers: DeviceTimer[];
  onAddTimer: (deviceId: string, deviceName: string, action: "on" | "off", delayMs: number) => void;
  onCancelTimer: (timerId: string) => void;
  className?: string;
}

export function formatTimeRemaining(executeAt: number): string {
  const remaining = executeAt - Date.now();
  if (remaining <= 0) return "Истёк";

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

export const PRESETS = [
  { label: "5 мин", ms: 5 * 60 * 1000 },
  { label: "15 мин", ms: 15 * 60 * 1000 },
  { label: "30 мин", ms: 30 * 60 * 1000 },
  { label: "1 час", ms: 60 * 60 * 1000 },
  { label: "2 часа", ms: 2 * 60 * 60 * 1000 },
  { label: "Вечер 22:00", computeMs: getEveningDelay },
];

function getEveningDelay(): number {
  const now = new Date();
  const target = new Date();
  target.setHours(22, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

export function TimerManager({
  timers,
  onAddTimer,
  onCancelTimer,
  className,
}: TimerManagerProps) {
  const [, setTick] = useState(0);

  // Update countdown every second
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeTimers = timers.filter((t) => t.active && t.executeAt > Date.now());

  if (activeTimers.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Активные таймеры ({activeTimers.length})</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {activeTimers.map((timer) => (
          <div
            key={timer.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                timer.action === "off"
                  ? "text-device-error bg-device-error/10"
                  : "text-device-success bg-device-success/10"
              }`}>
                {timer.action === "off" ? "Выкл" : "Вкл"}
              </span>
              <span className="text-xs text-foreground truncate">{timer.deviceName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground">
                {formatTimeRemaining(timer.executeAt)}
              </span>
              <button
                onClick={() => onCancelTimer(timer.id)}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
