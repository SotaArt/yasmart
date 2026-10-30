import { cn } from "@/lib/utils";
import type { CardSize } from "../types";
import { DeviceIcon } from "../DeviceIcon";

interface CardHeaderProps {
  icon: string;
  name: string;
  on: boolean;
  size?: CardSize;
  labelOn?: string;
  labelOff?: string;
  right?: React.ReactNode;
}

/**
 * Унифицированный заголовок карточки: иконка слева, имя и статус по центру,
 * справа — показания устройства (температура, заряд и т.п.).
 */
export function CardHeader({
  icon,
  name,
  on,
  size = "standard",
  labelOn = "Включен",
  labelOff = "Выключен",
  right,
}: CardHeaderProps) {
  return (
    <div className="flex items-start gap-2 min-w-0 shrink-0">
      <DeviceIcon icon={icon} size={size} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold leading-tight text-foreground truncate",
            size === "compact" ? "text-[10px]" : "text-xs"
          )}
        >
          {name}
        </p>
        <span className="flex items-center gap-1.5 text-[9px] font-medium tracking-widest uppercase mt-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", on ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
          <span className={on ? "text-emerald-400/90" : "text-slate-500"}>{on ? labelOn : labelOff}</span>
        </span>
      </div>
      {right && <div className="shrink-0 ml-auto text-right">{right}</div>}
    </div>
  );
}
