import { cn } from "@/lib/utils";

interface CardMetricProps {
  value: React.ReactNode;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  tone?: "gold" | "muted" | "success" | "error";
}

const TONES = {
  gold: "text-[#f3e5ab]",
  muted: "text-slate-300",
  success: "text-emerald-300",
  error: "text-red-300",
};

/** Компактное показание устройства в правой части заголовка карточки. */
export function CardMetric({
  value,
  label,
  icon,
  className,
  tone = "gold",
}: CardMetricProps) {
  return (
    <div className={cn("leading-tight", className)}>
      <p className={cn("flex items-center justify-end gap-0.5 text-xs font-semibold font-mono", TONES[tone])}>
        {icon}
        {value}
      </p>
      {label && (
        <p className="text-[8px] uppercase tracking-wider text-slate-500 mt-0.5">
          {label}
        </p>
      )}
    </div>
  );
}
