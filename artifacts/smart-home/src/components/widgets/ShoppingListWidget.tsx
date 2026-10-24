import { useState } from "react";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import type { ShoppingListWidgetData } from "@/hooks/use-dashboard-layout";

interface ShoppingListWidgetProps {
  data: ShoppingListWidgetData;
  onChange?: (data: ShoppingListWidgetData) => void;
  readOnly?: boolean;
}

let shoppingSeq = 0;
function newShoppingItemId() {
  return `shop_${Date.now()}_${shoppingSeq++}`;
}

export function ShoppingListWidget({ data, onChange, readOnly = false }: ShoppingListWidgetProps) {
  const items = data.items ?? [];
  const [draft, setDraft] = useState("");
  const doneCount = items.filter((i) => i.done).length;

  const toggleItem = (id: string) => {
    onChange?.({
      items: items.map((i) =>
        i.id === id
          ? { ...i, done: !i.done, doneAt: !i.done ? Date.now() : undefined }
          : i
      ),
    });
  };

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    onChange?.({ items: [...items, { id: newShoppingItemId(), text, done: false }] });
    setDraft("");
  };

  const removeItem = (id: string) => {
    onChange?.({ items: items.filter((i) => i.id !== id) });
  };

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[hsl(38,95%,64%)]" />
          <span className="text-xs font-medium text-neutral-400">Список покупок</span>
        </div>
        {items.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-2xl mb-1">🛒</span>
          <span className="text-xs text-neutral-500">Список пуст</span>
          {!readOnly && (
            <span className="text-[10px] text-neutral-600 mt-0.5">Добавьте товары ниже</span>
          )}
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                item.done ? "bg-white/[0.02]" : "bg-white/[0.04]"
              }`}
            >
              <button
                onClick={() => toggleItem(item.id)}
                className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                  item.done
                    ? "bg-[hsl(38,95%,64%)] border-[hsl(38,95%,64%)]"
                    : "border-border/60 hover:border-[hsl(38,95%,64%)]/60"
                }`}
                aria-label={item.done ? "Отметить невыполненным" : "Отметить выполненным"}
              >
                {item.done && <span className="text-[7px] text-black font-bold">✓</span>}
              </button>
              <span
                className={`flex-1 text-[11px] transition-all ${
                  item.done ? "text-neutral-600 line-through" : "text-neutral-200"
                }`}
              >
                {item.text}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add input (only when not readOnly) */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 mt-2 shrink-0">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            placeholder="Добавить товар..."
            className="flex-1 min-w-0 bg-transparent border border-border/50 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[hsl(38,95%,64%)]/50 placeholder:text-neutral-600"
          />
          <button
            onClick={addItem}
            disabled={!draft.trim()}
            className="p-1.5 rounded-lg bg-[hsl(38,95%,64%)]/15 text-[hsl(38,95%,64%)] hover:bg-[hsl(38,95%,64%)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Добавить"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}