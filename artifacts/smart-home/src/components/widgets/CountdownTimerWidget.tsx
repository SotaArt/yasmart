import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import type { CountdownTimerWidgetData } from "@/hooks/use-dashboard-layout";

interface CountdownTimerWidgetProps {
  data: CountdownTimerWidgetData;
  onChange?: (data: CountdownTimerWidgetData) => void;
  readOnly?: boolean;
}

const PRESETS_MIN = [1, 3, 5, 10, 15, 30, 60];

function formatTime(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1108.73, 1318.51, 1760];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1600);
  } catch {}
}

export function CountdownTimerWidget({ data, onChange }: CountdownTimerWidgetProps) {
  const restore = () => {
    const duration = data.duration ?? 60;
    if (data.endAt != null) {
      const left = Math.max(0, Math.round((data.endAt - Date.now()) / 1000));
      return { duration, remaining: left, running: left > 0 };
    }
    if (data.pausedRemaining != null) {
      return { duration, remaining: data.pausedRemaining, running: false };
    }
    return { duration, remaining: duration, running: false };
  };

  const init = restore();
  const [totalSeconds, setTotalSeconds] = useState(init.duration);
  const [remaining, setRemaining] = useState(init.remaining);
  const [running, setRunning] = useState(init.running);
  const finishedRef = useRef(false);

  const persist = (patch: Partial<CountdownTimerWidgetData>) => {
    onChange?.({ ...data, ...patch });
  };

  const setPreset = (minutes: number) => {
    const total = minutes * 60;
    setTotalSeconds(total);
    setRemaining(total);
    setRunning(false);
    finishedRef.current = false;
    persist({ duration: total, endAt: undefined, pausedRemaining: undefined });
  };

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const endAt = data.endAt;
      if (endAt == null) {
        setRunning(false);
        return;
      }
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        if (!finishedRef.current) {
          finishedRef.current = true;
          playChime();
          persist({ endAt: undefined, pausedRemaining: 0 });
        }
      }
    }, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, data.endAt]);

  useEffect(() => {
    if (remaining > 0 && running) finishedRef.current = false;
  }, [remaining, running]);

  const isFinished = remaining <= 0;
  const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;

  const toggleRun = () => {
    if (isFinished) {
      const endAt = Date.now() + totalSeconds * 1000;
      setRemaining(totalSeconds);
      setRunning(true);
      finishedRef.current = false;
      persist({ endAt, pausedRemaining: undefined });
    } else if (running) {
      setRunning(false);
      persist({ endAt: undefined, pausedRemaining: remaining });
    } else {
      const endAt = Date.now() + remaining * 1000;
      setRunning(true);
      persist({ endAt, pausedRemaining: undefined });
    }
  };

  const handleReset = () => {
    setRemaining(totalSeconds);
    setRunning(false);
    finishedRef.current = false;
    persist({ endAt: undefined, pausedRemaining: undefined });
  };

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[hsl(9,100%,64%)]" />
          <span className="text-xs font-medium text-neutral-400">Таймер</span>
        </div>
        {data.label && <span className="text-[10px] text-neutral-500 truncate">{data.label}</span>}
      </div>

      {/* Time display */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <span
          className={`text-4xl font-light tabular-nums leading-none ${
            isFinished ? "text-[hsl(9,100%,64%)]" : "text-neutral-100"
          }`}
        >
          {formatTime(remaining)}
        </span>
        <div className="w-full max-w-[140px] h-1 rounded-full bg-white/[0.06] overflow-hidden mt-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(9,100%,64%)] to-[hsl(38,95%,64%)] transition-all duration-500"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        {isFinished ? (
          <span className="mt-3 text-[11px] text-[hsl(9,100%,64%)]">Готово!</span>
        ) : (
          running && <span className="mt-3 text-[10px] text-muted-foreground">идёт обратный отсчёт</span>
        )}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 justify-center shrink-0">
        {PRESETS_MIN.map((min) => {
          const active = !running && !isFinished && totalSeconds === min * 60;
          return (
            <button
              key={min}
              onClick={() => setPreset(min)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                active
                  ? "bg-[hsl(9,100%,64%)]/20 text-[hsl(9,100%,64%)]"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              {min === 60 ? "1 ч" : `${min} мин`}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mt-2 shrink-0">
        <button
          onClick={toggleRun}
          disabled={!isFinished && remaining <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(9,100%,64%)]/15 text-[hsl(9,100%,64%)] hover:bg-[hsl(9,100%,64%)]/25 transition-colors"
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {running ? "Пауза" : isFinished ? "Заново" : "Старт"}
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
          title="Сброс"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}