import React from "react";

interface LuxuryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  value?: string;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LuxuryButton({
  icon,
  label,
  value,
  isActive = false,
  size = "md",
  className = "",
  ...props
}: LuxuryButtonProps) {
  const sizeClasses = {
    sm: "min-h-[64px] p-3",
    md: "min-h-[80px] p-4",
    lg: "min-h-[100px] p-5",
  };

  return (
    <button
      className={`
        group relative overflow-hidden rounded-2xl
        w-full h-full transition-all duration-300 ease-out
        ${sizeClasses[size]}

        /* Базовый фон */
        bg-[#111113] border border-[#1f1f22]
        shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7),0_4px_15px_-5px_rgba(0,0,0,0.5)]

        /* Hover */
        hover:border-[#d4af37]/30 hover:shadow-[0_0_20px_-2px_rgba(212,175,55,0.5)]

        /* Active */
        active:scale-[0.97] active:shadow-[inset_0_4px_8px_0_rgba(0,0,0,0.6)]

        /* Грид для адаптивности */
        grid grid-cols-[auto,1fr] grid-rows-[auto,auto] items-center gap-x-3 gap-y-0.5

        ${isActive ? `
          bg-gradient-to-br from-[#d4af37] to-[#b08d25]
          border-[#f5e0a3]/50 shadow-[0_0_20px_-2px_rgba(212,175,55,0.5)]
        ` : ""}

        ${className}
      `}
      {...props}
    >
      {/* Блик при наведении */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Иконка */}
      <div className={`
        row-span-2 flex items-center justify-center
        transition-all duration-300 relative z-10
        text-3xl text-neutral-500
        group-hover:text-[#f5e0a3] group-hover:scale-110
        ${isActive ? "text-[#0a0a0b]" : ""}
      `}>
        {icon}
      </div>

      {/* Label */}
      <div className={`
        text-left font-medium relative z-10 transition-colors
        text-neutral-200 text-lg leading-tight
        ${isActive ? "text-[#0a0a0b] font-semibold" : ""}
      `}>
        {label}
      </div>

      {/* Value */}
      {value && (
        <div className={`
          text-left relative z-10 transition-colors
          text-xs text-neutral-500 font-mono tracking-wider uppercase
          ${isActive ? "text-[#0a0a0b]/80" : ""}
        `}>
          {value}
        </div>
      )}

      {/* Активный overlay */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl border-2 border-black/20 mix-blend-overlay pointer-events-none" />
      )}
    </button>
  );
}
