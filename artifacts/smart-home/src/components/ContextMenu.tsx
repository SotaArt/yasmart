import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-card rounded-xl border border-border shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
            item.danger
              ? "text-destructive hover:bg-destructive/10"
              : "text-foreground hover:bg-accent"
          )}
        >
          <span className="w-4 h-4 shrink-0">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function useContextMenu() {
  const [menuState, setMenuState] = useState<{
    open: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  }>({
    open: false,
    x: 0,
    y: 0,
    items: [],
  });

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const openMenu = (e: React.MouseEvent | React.TouchEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    setMenuState({
      open: true,
      x: clientX,
      y: clientY,
      items,
    });
  };

  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent, items: ContextMenuItem[]) => {
    longPressTimer.current = setTimeout(() => {
      openMenu(e, items);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeMenu = () => {
    setMenuState((prev) => ({ ...prev, open: false }));
  };

  return {
    menuState,
    openMenu,
    handleLongPressStart,
    handleLongPressEnd,
    closeMenu,
  };
}
