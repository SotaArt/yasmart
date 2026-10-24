import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "./components/stat-card";
import type { ApiRequest } from "./hooks/use-api-monitor";
import { Trash2, Clock, Activity, AlertTriangle, CheckCircle } from "lucide-react";

interface ApiMonitorTabProps {
  requests: ApiRequest[];
  stats: {
    total: number;
    avgDuration: number;
    errorRate: number;
    successCount: number;
    errorCount: number;
  };
  onClear: () => void;
}

export function ApiMonitorTab({ requests, stats, onClear }: ApiMonitorTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Всего запросов"
          value={stats.total}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Среднее время"
          value={`${stats.avgDuration}мс`}
          color={stats.avgDuration > 1000 ? "text-amber-400" : "text-[hsl(var(--gold))]"}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Успешные"
          value={stats.successCount}
          color="text-[hsl(var(--gold))]"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Ошибки"
          value={`${stats.errorRate}%`}
          color={stats.errorRate > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{requests.length} запросов</p>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive h-8">
          <Trash2 className="w-4 h-4 mr-1" />
          Очистить
        </Button>
      </div>

      {/* Request list */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-1">
          {requests.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет запросов</p>
          )}
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors text-xs"
            >
              <span className="font-mono text-muted-foreground whitespace-nowrap">
                {new Date(req.timestamp).toLocaleTimeString("ru-RU")}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  req.status === null
                    ? "bg-muted text-muted-foreground"
                    : req.status >= 400
                    ? "bg-destructive/20 text-destructive border-destructive/30"
                    : "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30"
                }`}
              >
                {req.method}
              </Badge>
              <span className="text-foreground font-mono truncate flex-1">{req.url}</span>
              {req.status !== null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    req.status >= 400
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {req.status}
                </Badge>
              )}
              {req.duration !== null && (
                <span className="text-muted-foreground font-mono whitespace-nowrap">
                  {req.duration}мс
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
