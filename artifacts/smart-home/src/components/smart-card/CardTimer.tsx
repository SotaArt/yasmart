import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceTimer } from "@/hooks/use-panel-config";
import type { CardSize } from "./types";
import { SmartCardDivider } from "./premium/SmartCardDivider";
import { CardSettingsLink } from "./premium/CardSettingsLink";
import { formatTimeRemaining, PRESETS } from "@/components/TimerManager";

interface CardTimerContextValue {
  deviceId: string;
  deviceName: string;
  timers: DeviceTimer[];
  size?: CardSize;
  onAddTimer: (action: "on" | "off", delayMs: number) => void;
  onCancelTimer: (id: string) => void;
}

type CardTimerStateValue = CardTimerContextValue & {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CardTimerContext = createContext<CardTimerStateValue | null>(null);

export function CardTimerProvider({
  value,
  children,
}: {
  value: CardTimerContextValue;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <CardTimerContext.Provider value={{ ...value, open, setOpen }}>
      {/*
        Пока панель таймера развёрнута — весь остальной слой карточки неактивен
        (pointer-events-none), чтобы не пересекаться с кнопками управления.
        Сама панель включает pointer-events-auto в CardTimerSection.
      */}
      <div className={cn("h-full w-full min-h-0", open && "pointer-events-none")}>
        {children}
      </div>
    </CardTimerContext.Provider>
  );
}

/**
 * Секция таймера внутри карточки: под нижним разделителем компактная строка
 * «Таймер / Вкл через Xм Yс». По умолчанию свёрнута; при раскрытии поверх
 * контента всплывает панель с действием «Вкл/Выкл» и пресетами времени.
 * Обратный отсчёт — раз в секунду.
 */
interface CardTimerSectionProps {
  showTimer?: boolean;
  onSettings?: () => void;
}

export function CardTimerSection({
  showTimer = true,
  onSettings,
}: CardTimerSectionProps = {}) {
  const ctx = useContext(CardTimerContext);
  const [action, setAction] = useState<"on" | "off">("off");
  const [, setTick] = useState(0);

  const timer = ctx?.timers.find(
    (t) => t.deviceId === ctx.deviceId && t.active && t.executeAt > Date.now()
  );

  // Обновление обратного отсчёта раз в секунду, пока есть активный таймер
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.id]);

  if (!ctx) return null;

  const { open, setOpen } = ctx;
  const showSettings = !!onSettings;
  const hasFooter = showTimer || showSettings;

  return (
    <div className={cn("w-full shrink-0 relative", open && showTimer && "pointer-events-auto")}>
      <SmartCardDivider className="mt-2 mb-1.5" />

      {hasFooter && (
        <div className="flex items-center justify-center gap-1.5">
          {showTimer && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-400 border border-white/10 bg-white/[0.04] hover:text-[#f3e5ab] hover:border-[#d4af37]/40 transition-all duration-200"
            >
              <Clock className="w-3 h-3" />
              {timer ? (
                <span className="font-mono">
                  {timer.action === "off" ? "Выкл" : "Вкл"} через {formatTimeRemaining(timer.executeAt)}
                </span>
              ) : (
                <span>Таймер</span>
              )}
              {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          )}
          {showSettings && <CardSettingsLink onClick={onSettings} />}
        </div>
      )}

      {/* Панель таймера: всплывает над контентом, приглушая его тёмным фоном.
          Сквозь неё элементы под ней неактивны (см. provider). */}
      <AnimatePresence initial={false}>
        {showTimer && open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto absolute inset-x-0 bottom-[30px] rounded-xl border border-[#d4af37]/25 bg-slate-950/90 backdrop-blur-md shadow-luxury-sm p-2"
          >
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAction("off")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all duration-200",
                  action === "off"
                    ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f3e5ab]"
                    : "border-white/10 text-slate-500 hover:text-slate-300"
                )}
              >
                Выключить
              </button>
              <button
                type="button"
                onClick={() => setAction("on")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all duration-200",
                  action === "on"
                    ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f3e5ab]"
                    : "border-white/10 text-slate-500 hover:text-slate-300"
                )}
              >
                Включить
              </button>
            </div>
            {timer && (
              <button
                type="button"
                onClick={() => {
                  ctx.onCancelTimer(timer.id);
                  setOpen(false);
                }}
                className="w-full mt-1.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-medium text-red-400 hover:bg-red-500/20 transition-all duration-200"
              >
                Отменить таймер ({timer.action === "off" ? "выкл" : "вкл"} через {formatTimeRemaining(timer.executeAt)})
              </button>
            )}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    ctx.onAddTimer(action, preset.computeMs ? preset.computeMs() : preset.ms);
                    setOpen(false);
                  }}
                  className="py-1.5 px-1 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] font-medium text-slate-300 hover:border-[#d4af37]/50 hover:text-[#f3e5ab] transition-all duration-200 truncate"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
