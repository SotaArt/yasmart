import { Badge } from "@/components/ui/badge";
import type { DeviceStatusType } from "@/lib/yandex";

const STATUS_STYLES: Record<DeviceStatusType, string> = {
  on: "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30",
  off: "bg-muted text-muted-foreground border-border/50",
  sensor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  camera: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  unknown: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const STATUS_LABELS: Record<DeviceStatusType, string> = {
  on: "Вкл",
  off: "Выкл",
  sensor: "Датчик",
  camera: "Камера",
  unknown: "Нет данных",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatusType }) {
  return (
    <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
