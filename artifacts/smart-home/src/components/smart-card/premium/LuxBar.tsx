import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LuxBarProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  label?: string;
  display?: (value: number) => string;
  size?: "sm" | "md";
  disabled?: boolean;
}

const SPRING = { type: "spring" as const, stiffness: 280, damping: 28 };

/** Премиальный анимированный бар вместо обычного ползунка */
export function LuxBar({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  display,
  size = "md",
  disabled,
}: LuxBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const lastSentRef = useRef<{ at: number; value: number } | null>(null);
  const pendingRef = useRef<number | null>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const pct = max > min ? ((clamp(value) - min) / (max - min)) * 100 : 0;

  const ratioToValue = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    let v = min + ratio * (max - min);
    v = Math.round(v / step) * step;
    return clamp(v);
  };

  const commit = (v: number) => {
    lastSentRef.current = { at: Date.now(), value: v };
    pendingRef.current = null;
    onChange?.(v);
  };

  const send = (v: number) => {
    pendingRef.current = v;
    const last = lastSentRef.current;
    if (!last || Date.now() - last.at >= 200) commit(v);
  };

  const flushPending = () => {
    const pending = pendingRef.current;
    if (pending != null && lastSentRef.current?.value !== pending) commit(pending);
  };

  const move = (clientX: number) => {
    const v = ratioToValue(clientX);
    setLive(v);
    send(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      send(clamp(value + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      send(clamp(value - step));
    }
  };

  const shown = live ?? value;

  return (
    <div className={cn("w-full select-none", disabled && "opacity-40")}>
      <div className="flex items-center justify-between mb-1">
        {label && <span className="text-[10px] text-slate-400">{label}</span>}
        <span className="text-[10px] font-mono text-[#d4af37]">{display ? display(shown) : shown}</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKey}
        onKeyUp={flushPending}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging && move(e.clientX)}
        onPointerUp={() => {
          setDragging(false);
          flushPending();
        }}
        onPointerCancel={() => setDragging(false)}
        className={cn(
          "relative rounded-full bg-slate-900/80 border border-slate-700/40 cursor-pointer touch-none overflow-visible",
          "focus-visible:ring-2 focus-visible:ring-[#d4af37]/50 focus-visible:outline-none",
          size === "sm" ? "h-2" : "h-3",
          dragging && "border-[#d4af37]/50"
        )}
      >
        {/* Внутренняя фактура трека */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
        <span className="absolute inset-x-1 top-[2px] h-px rounded-full bg-white/5 pointer-events-none" />

        {/* Заливка с анимацией */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-[#9a7c26] via-[#d4af37] to-[#f3e5ab] shadow-[0_0_12px_rgba(212,175,55,0.45)]"
          animate={{ width: `${pct}%` }}
          transition={SPRING}
        />

        {/* Бегущий блик */}
        <motion.div
          className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
          animate={dragging ? { left: `${pct}%`, opacity: 0.9 } : { left: `${Math.max(6, pct)}%`, opacity: 0 }}
          transition={SPRING}
          style={{ width: dragging ? 48 : 28 }}
        />

        {/* Thumb */}
        <motion.div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-[#fff8e6] to-[#efcf7a] border border-[#d4af37]/70 shadow-[0_0_10px_rgba(212,175,55,0.65)]"
          animate={{ left: `${pct}%`, scale: dragging ? 1.25 : 1 }}
          transition={SPRING}
        />
      </div>
    </div>
  );
}