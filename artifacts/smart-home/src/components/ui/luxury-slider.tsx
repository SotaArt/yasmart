import React from "react";

interface LuxurySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LuxurySlider({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
  unit = "",
  showValue = true,
  size = "md",
  className = "",
}: LuxurySliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label и значение */}
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs">
          {label && <span className="text-slate-400 font-medium">{label}</span>}
          {showValue && (
            <span className="font-bold text-sm text-[#d4af37] font-mono">
              {value}{unit}
            </span>
          )}
        </div>
      )}

      {/* Слайдер */}
      <div className="relative">
        {/* Фоновая полоса с заполнением */}
        <div
          className={`absolute top-1/2 left-0 -translate-y-1/2 ${sizeClasses[size]} rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5e0a3] pointer-events-none`}
          style={{ width: `${percentage}%` }}
        />

        {/* Тонкая линия-трек */}
        <div
          className={`absolute top-1/2 left-0 -translate-y-1/2 w-full ${sizeClasses[size]} rounded-full bg-[#1f1f22] pointer-events-none`}
        />

        {/* Реальный input */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="luxury-slider relative z-10"
        />
      </div>
    </div>
  );
}
