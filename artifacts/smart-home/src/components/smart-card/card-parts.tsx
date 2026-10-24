import { createContext, useContext } from "react";
import type { Device } from "@/lib/yandex";
import { matchDeviceToTemplate } from "@/lib/device-template-map";

export type CardPartId = "header" | "top" | "power" | "bottom" | "timer" | "glow";

export const CARD_PART_META: Record<CardPartId, { label: string }> = {
  header: { label: "Заголовок" },
  top: { label: "Верхние элементы" },
  power: { label: "Кнопка вкл/выкл" },
  bottom: { label: "Нижние элементы" },
  timer: { label: "Таймер" },
  glow: { label: "Свечение" },
};

const ALL_CARD_PARTS: CardPartId[] = ["header", "top", "power", "bottom", "timer", "glow"];

// Шаблоны, рендерящие карточку через CardFrame (поддерживают все части)
const CARD_FRAME_TEMPLATES = new Set([
  "switch", "switch-relay", "socket",
  "light-onoff", "light-dimmer", "light-color", "light-temp", "light-full", "light-strip",
  "thermostat", "heater", "ac",
  "humidifier", "purifier", "fan", "hood",
  "lock", "tv", "speaker", "media", "vacuum",
]);

/**
 * Какие части карточки умеет скрывать данное устройство.
 * Карточки на базе CardFrame поддерживают весь набор частей;
 * сенсоры/камеры/протечки/шторы — отображающие карточки без интерактивных частей.
 */
export function getSupportedCardParts(device: Device): CardPartId[] {
  const template = matchDeviceToTemplate(device) ?? "";
  if (CARD_FRAME_TEMPLATES.has(template)) return ALL_CARD_PARTS;
  return [];
}

const CardPartsContext = createContext<CardPartId[]>([]);

export function CardPartsProvider({
  hiddenParts,
  children,
}: {
  hiddenParts?: CardPartId[];
  children: React.ReactNode;
}) {
  return (
    <CardPartsContext.Provider value={hiddenParts ?? []}>
      {children}
    </CardPartsContext.Provider>
  );
}

export function useHiddenParts(): CardPartId[] {
  return useContext(CardPartsContext);
}