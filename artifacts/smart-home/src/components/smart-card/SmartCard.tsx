import { createContext, useContext, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FitContent } from "./premium/FitContent";
import { DeviceIcon } from "./DeviceIcon";
import type {
  SmartCardContextValue,
  SmartCardHeaderProps,
  SmartCardPrimaryProps,
  SmartCardControlsProps,
  SmartCardMetaProps,
  SmartCardStatusProps,
  CardSize,
  DeviceVariant,
} from "./types";

const SmartCardContext = createContext<SmartCardContextValue | null>(null);

function useSmartCardContext() {
  const ctx = useContext(SmartCardContext);
  if (!ctx) throw new Error("SmartCard compound components must be used within <SmartCard>");
  return ctx;
}

/* ── Variant color mapping (gold luxury accents) ── */
const variantStyles: Record<DeviceVariant, { active: string; glow: string }> = {
  toggle: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_18px_rgba(212,175,55,0.22)]" },
  sensor: { active: "border-[#d4af37]/45", glow: "" },
  climate: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.18)]" },
  thermostat: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.22)]" },
  curtain: { active: "border-[#d4af37]/45", glow: "" },
  media: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.2)]" },
  vacuum: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.2)]" },
  security: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.2)]" },
  scene: { active: "border-[#d4af37]/45", glow: "shadow-[0_0_16px_rgba(212,175,55,0.2)]" },
};

/* ── Size determines grid span ── */
const sizeGrid: Record<CardSize, string> = {
  compact: "tile-1x1",
  standard: "tile-1x1",
  expanded: "tile-2x1",
  full: "tile-2x2",
};

/* ── Base Card ── */
function SmartCardRoot({
  size = "standard",
  variant = "toggle",
  active = false,
  pinned = false,
  isDragging = false,
  className,
  children,
  onClick,
  onKeyDown,
  onContextMenu,
  "data-testid": testId,
}: {
  size?: CardSize;
  variant?: DeviceVariant;
  active?: boolean;
  pinned?: boolean;
  isDragging?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  "data-testid"?: string;
}) {
  const styles = variantStyles[variant];
  const isInteractive = variant !== "sensor" && variant !== "scene";
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(e);
  }, [onContextMenu]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as React.MouseEvent;
      onContextMenu?.(syntheticEvent);
    }, 500);
  }, [onContextMenu]);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <SmartCardContext.Provider value={{ size, variant, active, isDragging }}>
      <motion.div
        className={cn(
          "relative h-full w-full rounded-xl border p-3 overflow-hidden select-none transition-all duration-200",
          "bg-white/[0.06] backdrop-blur-xl shadow-luxury-sm",
          sizeGrid[size],
          active && !pinned && styles.active,
          active && !pinned && styles.glow,
          pinned && "border-[#d4af37]/60 shadow-[0_0_0_2px_rgba(212,175,55,0.4),0_0_14px_rgba(212,175,55,0.25)]",
          !active && !pinned && "border-[#d4af37]/15",
          isInteractive && "cursor-pointer",
          !isInteractive && "cursor-default",
          isDragging && "opacity-50 scale-95",
          className
        )}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-pressed={isInteractive ? active : undefined}
        data-testid={testId}
      >
        <FitContent>{children}</FitContent>
      </motion.div>
    </SmartCardContext.Provider>
  );
}

/* ── Header Zone ── */
function SmartCardHeader({ icon, name, room, connection }: SmartCardHeaderProps) {
  const { size } = useSmartCardContext();
  const showRoom = size !== "compact" && room;

  return (
    <div className="flex items-start justify-between mb-1">
      <div className="flex items-center gap-2 min-w-0">
        <DeviceIcon icon={icon} size={size} />
        <div className="min-w-0">
          <p className={cn(
            "font-semibold leading-tight text-foreground truncate transition-all duration-200",
            size === "full" && "text-sm",
            size === "expanded" && "text-xs",
            size === "standard" && "text-xs",
            size === "compact" && "text-[10px]"
          )}>
            {name}
          </p>
          {showRoom && (
            <p className="text-[9px] text-muted-foreground truncate transition-all duration-200">{room}</p>
          )}
        </div>
      </div>
      {connection === "offline" && (
        <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      {connection === "error" && (
        <AlertCircle className="w-3.5 h-3.5 text-device-error shrink-0" />
      )}
    </div>
  );
}

/* ── Main Info Zone (primary value) ── */
function SmartCardPrimary({ children, accent }: SmartCardPrimaryProps) {
  const { size } = useSmartCardContext();

  return (
    <div className={cn(
      "flex items-baseline gap-1",
      size === "compact" && "mt-1",
      size === "standard" && "mt-1.5",
      (size === "expanded" || size === "full") && "mt-2"
    )}>
      <span className={cn(
        "font-bold text-foreground leading-none transition-all duration-200",
        size === "full" && "text-4xl",
        size === "expanded" && "text-2xl",
        size === "standard" && "text-xl",
        size === "compact" && "text-base",
        accent && "text-device-light"
      )}>
        {children}
      </span>
    </div>
  );
}

/* ── Controls Zone ── */
function SmartCardControls({ children }: SmartCardControlsProps) {
  const { size } = useSmartCardContext();
  if (size === "compact") return null;

  return (
    <div className="mt-2">
      {children}
    </div>
  );
}

/* ── Meta Zone (additional info) ── */
function SmartCardMeta({ children }: SmartCardMetaProps) {
  const { size } = useSmartCardContext();
  if (size === "compact" || size === "standard") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-2 text-xs text-muted-foreground"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Status Bar Zone ── */
function SmartCardStatus({ children }: SmartCardStatusProps) {
  const { size } = useSmartCardContext();
  if (size === "compact") return null;

  return (
    <div className="mt-1.5 text-[10px] text-muted-foreground/70">
      {children}
    </div>
  );
}

/* ── Compound export ── */
export const SmartCard = Object.assign(SmartCardRoot, {
  Header: SmartCardHeader,
  Primary: SmartCardPrimary,
  Controls: SmartCardControls,
  Meta: SmartCardMeta,
  Status: SmartCardStatus,
});

export type { CardSize, DeviceVariant };
