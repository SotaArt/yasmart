import type { Room } from "@/lib/yandex";

export function RoomTab({
  room,
  isActive,
  onClick,
  minWidth,
}: {
  room: Room;
  isActive: boolean;
  onClick: () => void;
  minWidth?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={minWidth ? { minWidth } : undefined}
      className={`shrink-0 px-5 py-3 rounded-xl text-base font-semibold transition-all text-center truncate ${
        isActive
          ? "border-2 border-[hsl(var(--gold))] text-[hsl(var(--gold))] shadow-[0_0_16px_hsl(var(--gold-glow))] bg-transparent"
          : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-border bg-transparent"
      }`}
    >
      {room.name}
    </button>
  );
}
