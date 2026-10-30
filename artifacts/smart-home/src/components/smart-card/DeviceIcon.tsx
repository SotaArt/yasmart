import { cn } from "@/lib/utils";
import type { CardSize } from "./types";

const TEXT_SIZES: Record<CardSize, string> = {
  compact: "text-lg",
  standard: "text-xl",
  expanded: "text-2xl",
  full: "text-3xl",
};

const IMAGE_SIZES: Record<CardSize, string> = {
  compact: "w-4 h-4",
  standard: "w-5 h-5",
  expanded: "w-6 h-6",
  full: "w-7 h-7",
};

interface DeviceIconProps {
  icon: string;
  size?: CardSize;
  className?: string;
}

/** Иконка устройства: эмодзи по типу или загруженное в ИП изображение (data URL). */
export function DeviceIcon({ icon, size = "standard", className }: DeviceIconProps) {
  if (icon.startsWith("data:")) {
    return (
      <img
        src={icon}
        alt=""
        className={cn("shrink-0 object-contain", IMAGE_SIZES[size], className)}
      />
    );
  }

  return (
    <span
      className={cn("shrink-0 leading-none", TEXT_SIZES[size], className)}
      role="img"
    >
      {icon}
    </span>
  );
}
