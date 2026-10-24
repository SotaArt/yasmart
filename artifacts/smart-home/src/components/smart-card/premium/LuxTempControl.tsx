import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LuxTempControlProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  displayValue?: boolean;
  displayClassName?: string;
  disabled?: boolean;
}

/** Унифицированный блок управления температурой: − / range / + как в кондиционере */
export function LuxTempControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  displayValue = true,
  displayClassName = "text-3xl",
  disabled,
}: LuxTempControlProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  const changeTemp = (delta: number) => {
    const next = Math.min(max, Math.max(min, Math.round((value + delta) / step) * step));
    onChange(next);
  };

  return (
    <div className="w-full select-none">
      {displayValue && (
        <div className="flex items-end justify-between mb-2">
          {label && (
            <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400">
              {label}
            </span>
          )}
          <span className={cn(
            "leading-none font-bold bg-gradient-to-b from-[#f3e5ab] via-[#d4af37] to-[#a8842a] bg-clip-text text-transparent",
            displayClassName
          )}>
            {step < 1 ? value.toFixed(1) : Math.round(value)}°
          </span>
        </div>
      )}

      {!displayValue && label && (
        <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400 mb-1.5 block">
          {label}
        </span>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => changeTemp(-step)}
          disabled={disabled || value <= min}
          aria-label="Уменьшить температуру"
          className={cn(
            "w-8 h-8 shrink-0 rounded-full bg-white/[0.06] border border-[#d4af37]/25 text-[#d4af37] hover:bg-[#d4af37]/15 active:scale-95 transition flex items-center justify-center",
            disabled || value <= min ? "opacity-30 cursor-not-allowed" : ""
          )}
        >
          <Minus className="w-4 h-4" />
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={(e) => onChange(+e.target.value)}
          aria-label={label ?? "Значение"}
          className="flex-1 luxury-slider"
          disabled={disabled}
          style={{ background: `linear-gradient(to right, #d4af37 0%, #f3e5ab ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.06) 100%)` }}
        />

        <button
          type="button"
          onClick={() => changeTemp(step)}
          disabled={disabled || value >= max}
          aria-label="Увеличить температуру"
          className={cn(
            "w-8 h-8 shrink-0 rounded-full bg-white/[0.06] border border-[#d4af37]/25 text-[#d4af37] hover:bg-[#d4af37]/15 active:scale-95 transition flex items-center justify-center",
            disabled || value >= max ? "opacity-30 cursor-not-allowed" : ""
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-between text-[9px] text-slate-500 mt-1.5 px-1">
        <span>{min}°</span>
        <span>{max}°</span>
      </div>
    </div>
  );
}
