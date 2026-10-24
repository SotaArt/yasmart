import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type LuxVariant = "gold" | "gold-ghost" | "quiet" | "success" | "danger" | "action";

const VARIANTS: Record<LuxVariant, string> = {
  gold: "bg-gradient-to-br from-[#e2c76d] via-[#d4af37] to-[#a8842a] text-[#0d0f12] border-[#f3e5ab]/60 shadow-[0_2px_14px_rgba(212,175,55,0.35)]",
  "gold-ghost": "bg-[#d4af37]/10 border-[#d4af37]/40 text-[#f3e5ab]",
  quiet: "bg-slate-900/70 border-slate-700/60 text-slate-400",
  success: "bg-emerald-500/10 border-emerald-500/35 text-emerald-300",
  danger: "bg-red-500/10 border-red-500/35 text-red-300",
  action: "bg-gradient-to-b from-slate-700/80 to-slate-800/80 border-slate-600/60 text-slate-100",
};

interface LuxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LuxVariant;
  glow?: boolean;
}

/** Премиальная анимированная кнопка действия */
export function LuxButton({ variant = "quiet", glow, className, children, disabled, ...rest }: LuxButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className={cn(
        "rounded-lg text-[10px] font-semibold tracking-wide border transition-colors duration-200 px-2 py-1.5",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANTS[variant],
        glow && "hover:shadow-[0_0_16px_rgba(212,175,55,0.4)]",
        className
      )}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}