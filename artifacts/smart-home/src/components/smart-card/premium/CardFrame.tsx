import { cn } from "@/lib/utils";
import type { CardSize, DeviceVariant } from "../types";
import { SmartCard } from "../SmartCard";
import { CardHeader } from "./CardHeader";
import { SmartCardDivider } from "./SmartCardDivider";
import { PowerPill, pillSizeFor } from "./PowerPill";
import { CardTimerSection } from "../CardTimer";
import { useHiddenParts } from "../card-parts";

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
  subtitle?: string | null;
  labelOn?: string;
  labelOff?: string;
  headerRight?: React.ReactNode;

  /**
   * Power pill props — pass { on, onChange, label } to show a centered round
   * power button, or `null`/`false` to omit (e.g. curtain without on/off).
   */
  power?: { on: boolean; onChange: (v: boolean) => void; label: string } | false | null;

  /** Show the timer section at the bottom */
  timer?: boolean;

  /** Functional controls above the power button */
  top?: React.ReactNode;

  /** Functional controls below the power button (often wrapped in a dimming div) */
  bottom?: React.ReactNode;

  /** Golden glow overlay when active (default: true) */
  glow?: boolean;

  /** Extra overlay elements (context menu, alert pulse, etc.) */
  overlay?: React.ReactNode;

  children?: React.ReactNode;
}

/**
 * Единая обёртка карточки с типовым анатомическим шаблоном:
 *   1-3. Заголовок (иконка + имя + статус)
 *   4.   Разделитель
 *   5.   Верхний слот (функциональные кнопки/слайдеры или пустота)
 *   6.   Круглая кнопка вкл/выкл по центру
 *   7.   Нижний слот (остальные кнопки/слайдеры)
 *   8.   Разделитель + таймер
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
  subtitle,
  labelOn,
  labelOff,
  headerRight,
  power,
  timer = false,
  top,
  bottom,
  glow = true,
  overlay,
  children,
}: CardFrameProps) {
  const hiddenParts = useHiddenParts();
  const isHidden = (part: string) => hiddenParts.includes(part as any);

  return (
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
              subtitle={subtitle}
              labelOn={labelOn}
              labelOff={labelOff}
              right={headerRight}
            />

            {/* 4: Разделитель */}
            <SmartCardDivider className="mt-2 mb-2" />
          </>
        )}

        {/* 5-7: Функциональная область */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5">
          {!isHidden("top") && top}

          {power && !isHidden("power") && (
            <div className="flex justify-center shrink-0">
              <PowerPill
                on={power.on}
                onChange={power.onChange}
                label={power.label}
                size={pillSizeFor(size)}
              />
            </div>
          )}

          {!isHidden("bottom") && bottom}
        </div>

        {/* 8-10: Разделитель + таймер */}
        {timer && !isHidden("timer") && <CardTimerSection />}
      </div>

      {/* Свечение при включении */}
      {glow && active && !isHidden("glow") && (
        <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
      )}

      {overlay}
      {children}
    </SmartCard>
  );
}
