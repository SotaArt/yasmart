import { cn } from "@/lib/utils";

type LuxBadgeVariant = "gold" | "muted" | "success" | "error" | "info";

const BADGE_STYLES: Record<LuxBadgeVariant, string> = {
  gold: "bg-[#d4af37]/12 border-[#d4af37]/35 text-[#f3e5ab]",
  muted: "bg-slate-900/70 border-slate-700/50 text-slate-500",
  success: "bg-emerald-500/12 border-emerald-500/35 text-emerald-300",
  error: "bg-red-500/12 border-red-500/35 text-red-300",
  info: "bg-sky-500/12 border-sky-500/35 text-sky-300",
};

interface LuxBadgeProps {
  variant?: LuxBadgeVariant;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Премиальный статус-бейдж */
export function LuxBadge({ variant = "muted", active, className, children }: LuxBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded-lg border transition-all",
        active ? BADGE_STYLES.gold : BADGE_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}