import { Settings2 } from "lucide-react";

interface CardSettingsLinkProps {
  onClick: () => void;
}

/** Компактная кнопка «Настройки» в нижнем ряду карточки, рядом с таймером. */
export function CardSettingsLink({ onClick }: CardSettingsLinkProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title="Настройки устройства"
      aria-label="Настройки устройства"
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-[#f3e5ab] border border-[#d4af37]/35 bg-[#d4af37]/10 hover:bg-[#d4af37]/15 hover:border-[#d4af37]/60 transition-all duration-200"
    >
      <Settings2 className="w-3 h-3" />
      <span>Настройки</span>
    </button>
  );
}
