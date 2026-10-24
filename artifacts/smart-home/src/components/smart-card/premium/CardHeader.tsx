import { cn } from "@/lib/utils";
import type { CardSize } from "../types";

interface CardHeaderProps {
  icon: string;
  name: string;
  on: boolean;
  size?: CardSize;
  subtitle?: string | null;
  labelOn?: string;
  labelOff?: string;
  right?: React.ReactNode;
}

/**
 * Унифицированный заголовок карточки: иконка + имя + статус всегда вверху слева,
 * не зависит от размера слота. Справа можно разместить доп. элемент (badge и т.п.).
 */
export function CardHeader({
  icon,
  name,
  on,
  size = "standard",
  subtitle,
  labelOn = "Включен",
  labelOff = "Выключен",
  right,
}: CardHeaderProps) {
  return (
    <div className="flex items-center gap-2 min-w-0 shrink-0">
      <span
        className={cn(
          "shrink-0 leading-none",
          size === "full" ? "text-2xl" : "text-xl",
          size === "compact" && "text-lg"
        )}
        role="img"
      >
        {icon}
      </span>
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
        {subtitle && <p className="text-[9px] text-slate-500 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}