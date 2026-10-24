import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LogEntry, LogFilter } from "./hooks/use-event-log";
import { Trash2, Download, Filter } from "lucide-react";

interface LogsTabProps {
  entries: LogEntry[];
  filter: LogFilter;
  onFilterChange: (f: LogFilter) => void;
  onClear: () => void;
  onExport: () => string;
}

const LOG_TYPE_LABELS: Record<string, string> = {
  device_update: "Устройство",
  scenario_run: "Сценарий",
  command_sent: "Команда",
  command_result: "Результат",
  ws_connect: "WS Подключение",
  ws_disconnect: "WS Отключение",
};

const LOG_TYPE_COLORS: Record<string, string> = {
  device_update: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  scenario_run: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  command_sent: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  command_result: "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30",
  ws_connect: "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30",
  ws_disconnect: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function LogsTab({ entries, filter, onFilterChange, onClear, onExport }: LogsTabProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleExport = () => {
    const json = onExport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            showFilters
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border/50 text-muted-foreground hover:border-border"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Фильтры
        </button>
        <div className="relative flex-1 min-w-[200px]">
          <Input
            value={filter.search}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            placeholder="Поиск в журнале..."
            className="h-8 text-sm bg-card border-border"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={handleExport} className="text-muted-foreground h-8">
          <Download className="w-4 h-4 mr-1" />
          Экспорт
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive h-8">
          <Trash2 className="w-4 h-4 mr-1" />
          Очистить
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={filter.type}
            onChange={(e) => onFilterChange({ ...filter, type: e.target.value })}
            className="text-xs px-2 py-1.5 rounded-md border border-border/50 bg-card text-foreground"
          >
            <option value="">Все типы</option>
            {Object.entries(LOG_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Input
            value={filter.deviceId}
            onChange={(e) => onFilterChange({ ...filter, deviceId: e.target.value })}
            placeholder="ID устройства..."
            className="h-8 text-xs w-48 bg-card border-border"
          />
        </div>
      )}

      {/* Log entries */}
      <p className="text-xs text-muted-foreground mb-3">{entries.length} записей</p>
      <ScrollArea className="h-[500px]">
        <div className="space-y-1">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет записей</p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors text-xs"
            >
              <span className="font-mono text-muted-foreground whitespace-nowrap">
                {new Date(entry.timestamp).toLocaleTimeString("ru-RU")}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] flex-shrink-0 ${LOG_TYPE_COLORS[entry.type] ?? ""}`}
              >
                {LOG_TYPE_LABELS[entry.type] ?? entry.type}
              </Badge>
              <span className="text-foreground break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
