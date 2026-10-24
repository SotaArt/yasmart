import { StatCard } from "./components/stat-card";
import type { PerformanceMetrics } from "./hooks/use-performance";
import { Gauge, Cpu, HardDrive, Wifi, RefreshCw, Database } from "lucide-react";

interface PerformanceTabProps {
  metrics: PerformanceMetrics;
  onRefresh: () => void;
}

export function PerformanceTab({ metrics, onRefresh }: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Gauge className="w-5 h-5" />}
          label="Кадры/сек"
          value={metrics.fps}
          color={metrics.fps >= 55 ? "text-[hsl(var(--gold))]" : metrics.fps >= 30 ? "text-amber-400" : "text-destructive"}
        />
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label="Задержка"
          value={metrics.wsLatency !== null ? `${metrics.wsLatency}мс` : "Н/Д"}
          color={metrics.wsLatency !== null && metrics.wsLatency < 200 ? "text-[hsl(var(--gold))]" : "text-muted-foreground"}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5" />}
          label="Память"
          value={metrics.memoryUsed !== null ? `${metrics.memoryUsed}МБ` : "Н/Д"}
        />
        <StatCard
          icon={<Cpu className="w-5 h-5" />}
          label="Лимит кучи"
          value={metrics.memoryTotal !== null ? `${metrics.memoryTotal}МБ` : "Н/Д"}
        />
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label="Кэш запросов"
          value={metrics.queryCacheStats.total}
        />
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Обновить
      </button>

      {/* Cache details */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Кэш React Query
        </h3>
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
          <CacheRow label="Всего запросов" value={metrics.queryCacheStats.total} />
          <CacheRow label="Актуальные" value={metrics.queryCacheStats.fresh} color="text-[hsl(var(--gold))]" />
          <CacheRow label="Устаревшие" value={metrics.queryCacheStats.stale} color="text-amber-400" />
          <CacheRow label="Загружаются" value={metrics.queryCacheStats.fetching} color="text-blue-400" />
        </div>
      </div>

      {/* Memory bar */}
      {metrics.memoryUsed !== null && metrics.memoryTotal !== null && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Использование памяти
          </h3>
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">
                {metrics.memoryUsed} МБ / {metrics.memoryTotal} МБ
              </span>
              <span className="text-muted-foreground">
                {Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (metrics.memoryUsed / metrics.memoryTotal) > 0.8
                    ? "bg-destructive"
                    : (metrics.memoryUsed / metrics.memoryTotal) > 0.5
                    ? "bg-amber-400"
                    : "bg-[hsl(var(--gold))]"
                }`}
                style={{ width: `${(metrics.memoryUsed / metrics.memoryTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* FPS history note */}
      <div className="text-xs text-muted-foreground">
        Кадры обновляются каждую секунду. Данные о памяти доступны только в Chrome/Edge.
      </div>
    </div>
  );
}

function CacheRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${color ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}
