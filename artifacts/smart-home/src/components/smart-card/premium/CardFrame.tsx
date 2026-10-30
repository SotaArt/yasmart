import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CardSize, DeviceVariant } from "../types";
import { SmartCard } from "../SmartCard";
import { CardHeader } from "./CardHeader";
import { SmartCardDivider } from "./SmartCardDivider";
import { PowerPill, pillSizeFor } from "./PowerPill";
import { CardTimerSection } from "../CardTimer";
import { useHiddenParts } from "../card-parts";
import { useDeviceSettingsTarget } from "../device-settings-context";
import { DeviceSettingsDialog, hasDeviceSettings } from "../DeviceSettingsDialog";

interface CardFrameProps {
  size: CardSize;
  variant?: DeviceVariant;
  active: boolean;
  pinned?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  dataTestId?: string;
  className?: string;
  alertClassName?: string;

  /** Header props */
  icon: string;
  name: string;
  labelOn?: string;
  labelOff?: string;
  /** Показания устройства справа от имени (температура, заряд, статус уборки) */
  metric?: React.ReactNode;

  /**
   * Круглая кнопка по центру свободной области. Передайте `false`/`null`,
   * если у устройства нет основного переключаемого действия.
   */
  power?: { on: boolean; onChange: (v: boolean) => void; label: string } | false | null;

  /** Show the timer section at the bottom */
  timer?: boolean;

  /** Golden glow overlay when active (default: true) */
  glow?: boolean;

  /** Extra overlay elements (context menu, alert pulse, etc.) */
  overlay?: React.ReactNode;

  children?: React.ReactNode;
}

/**
 * Единая обёртка карточки:
 *   1. Заголовок: иконка, имя + статус, показания справа
 *   2. Разделитель
 *   3. Круглая кнопка питания на всё свободное пространство
 *   4. Разделитель + кнопки «Таймер» и «Настройки»
 */
export function CardFrame({
  size,
  variant = "toggle",
  active,
  pinned = false,
  onContextMenu,
  onClick,
  onKeyDown,
  dataTestId,
  className,
  alertClassName,
  icon,
  name,
  labelOn,
  labelOff,
  metric,
  power,
  timer = false,
  glow = true,
  overlay,
  children,
}: CardFrameProps) {
  const hiddenParts = useHiddenParts();
  const settingsTarget = useDeviceSettingsTarget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isHidden = (part: string) => hiddenParts.includes(part as any);
  const settingsAvailable =
    !!settingsTarget && hasDeviceSettings(settingsTarget.device);

  return (
    <>
    <SmartCard
      size={size}
      variant={variant}
      active={active}
      pinned={pinned}
      onContextMenu={onContextMenu}
      onClick={onClick}
      onKeyDown={onKeyDown}
      data-testid={dataTestId}
      className={cn(alertClassName, className)}
    >
      <div className="h-full flex flex-col">
        {/* 1-3: Заголовок */}
        {!isHidden("header") && (
          <>
            <CardHeader
              icon={icon}
              name={name}
              on={active}
              size={size}
              labelOn={labelOn}
              labelOff={labelOff}
              right={metric}
            />

            {/* 4: Разделитель */}
            <SmartCardDivider className="mt-2 mb-2" />
          </>
        )}

        {/* Круглая кнопка на всё свободное поле */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-1">
          {power && !isHidden("power") && (
            <PowerPill
              on={power.on}
              onChange={power.onChange}
              label={power.label}
              size={pillSizeFor(size)}
              fill
            />
          )}
        </div>

        {/* Разделитель + нижний ряд: таймер и настройки */}
        <CardTimerSection
          showTimer={timer && !isHidden("timer")}
          onSettings={settingsAvailable ? () => setSettingsOpen(true) : undefined}
        />
      </div>

      {/* Свечение при включении */}
      {glow && active && !isHidden("glow") && (
        <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
      )}

      {overlay}
      {children}
    </SmartCard>

    {settingsAvailable && settingsTarget && (
      <DeviceSettingsDialog
        device={settingsTarget.device}
        token={settingsTarget.token}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    )}
    </>
  );
}
