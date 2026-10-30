import { motion } from "framer-motion";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardSize } from "../types";

export type PillSize = "sm" | "md" | "lg" | "xl";

/** Круглая кнопка питания: компактный → 36px, standard → 44px, expanded → 52px, full → 60px */
export function pillSizeFor(size?: CardSize): PillSize {
  if (size === "compact") return "sm";
  if (size === "standard") return "md";
  if (size === "expanded") return "lg";
  return "xl";
}

interface PowerPillProps {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
  size?: PillSize;
  disabled?: boolean;
  fill?: boolean;
}

/** Круглая кнопка питания с иконкой ⏻ — увеличенная для удобного тапа */
export function PowerPill({ on, onChange, label, size = "md", disabled, fill = false }: PowerPillProps) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      title={`${label}: ${on ? "выключить" : "включить"}`}
      aria-pressed={on}
      aria-label={`${label}: ${on ? "включено" : "выключено"}`}
      className={cn(
        "relative flex items-center justify-center rounded-full border transition-all duration-300 select-none shrink-0",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        fill
          ? "h-full w-auto aspect-square max-h-full min-w-9 min-h-9"
          : size === "sm" ? "w-9 h-9" :
            size === "md" ? "w-11 h-11" :
            size === "lg" ? "w-12 h-12" :
            "w-14 h-14",
        on
          ? "bg-gradient-to-br from-[#d4af37] via-[#e8cf6a] to-[#f3e5ab] text-[#0d0f12] border-[#f3e5ab]/70 shadow-[0_0_18px_rgba(212,175,55,0.5)]"
          : "bg-white/[0.06] backdrop-blur-md border-white/10 text-slate-400 hover:bg-white/[0.12] hover:text-slate-200 hover:border-white/20"
      )}
    >
      <Power className={cn(
        "transition-all duration-300",
        fill ? "w-2/5 h-2/5" :
        size === "sm" ? "w-4 h-4" :
        size === "md" ? "w-5 h-5" :
        size === "lg" ? "w-5 h-5" :
        "w-6 h-6",
        on && "drop-shadow-[0_0_4px_rgba(0,0,0,0.3)]"
      )} />

      {/* Маленький индикатор-точка в правом верхнем углу когда включено */}
      {on && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0d0f12]/25 border border-[#0d0f12]/10" />
      )}
    </motion.button>
  );
}
