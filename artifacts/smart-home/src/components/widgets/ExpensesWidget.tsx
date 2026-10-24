import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import type { ExpensesWidgetData } from "@/hooks/use-dashboard-layout";

interface ExpensesWidgetProps {
  data: ExpensesWidgetData;
  onChange?: (data: ExpensesWidgetData) => void;
  readOnly?: boolean;
}

let expenseSeq = 0;
function newExpenseId() {
  return `exp_${Date.now()}_${expenseSeq++}`;
}

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function formatShortDate(iso: string): string {
  const m = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  return `${day}.${m}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function ExpensesWidget({ data, onChange, readOnly = false }: ExpensesWidgetProps) {
  const entries = data.entries ?? [];
  const [draftCategory, setDraftCategory] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const monthTotal = entries
    .filter((e) => monthKey(e.date) === currentMonthKey())
    .reduce((sum, e) => sum + e.amount, 0);

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    const value = parseFloat(draftAmount.replace(",", "."));
    if (!draftCategory.trim() || !Number.isFinite(value) || value <= 0) return;
    onChange?.({
      entries: [
        ...entries,
        {
          id: newExpenseId(),
          date: todayISO(),
          category: draftCategory.trim(),
          amount: Math.round(value * 100) / 100,
        },
      ],
    });
    setDraftCategory("");
    setDraftAmount("");
  };

  const removeEntry = (id: string) => {
    onChange?.({ entries: entries.filter((e) => e.id !== id) });
  };

  const categories = (() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      if (monthKey(e.date) !== currentMonthKey()) return;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  })();

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[hsl(142,70%,45%)]" />
          <span className="text-xs font-medium text-neutral-400">Расходы</span>
        </div>
        {monthTotal > 0 && (
          <span className="text-[10px] text-muted-foreground">{formatMonth(new Date())}</span>
        )}
      </div>

      {entries.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-2xl mb-1">💰</span>
          <span className="text-xs text-neutral-500">Расходов нет</span>
          {!readOnly && (
            <span className="text-[10px] text-neutral-600 mt-0.5">Добавьте запись ниже</span>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <>
          {/* Month total */}
          <div className="mt-2 mb-2 pt-2 border-t border-white/[0.06] shrink-0">
            <span className="text-2xl font-light text-neutral-100 tabular-nums">
              {formatAmount(monthTotal)}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1.5">за месяц</span>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
              {categories.map(([cat, sum]) => (
                <span
                  key={cat}
                  className="px-1.5 py-0.5 rounded-full bg-white/[0.05] text-[9px] text-neutral-300"
                >
                  {cat} · {formatAmount(sum)}
                </span>
              ))}
            </div>
          )}

          {/* Entries */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {sorted.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.04]">
                <span className="text-[9px] text-muted-foreground tabular-nums w-8 shrink-0">
                  {formatShortDate(entry.date)}
                </span>
                <span className="flex-1 text-[11px] text-neutral-200 truncate">{entry.category}</span>
                <span className="text-[11px] text-[hsl(9,100%,64%)] tabular-nums shrink-0">
                  −{formatAmount(entry.amount)}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                    title="Удалить"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick add (only when not readOnly) */}
      {!readOnly && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEntry();
              }}
              placeholder="Категория"
              className="flex-1 min-w-0 bg-transparent border border-border/50 rounded px-2 py-1 text-[10px] placeholder:text-neutral-600"
            />
            <input
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEntry();
              }}
              inputMode="decimal"
              placeholder="₽"
              className="w-14 shrink-0 bg-transparent border border-border/50 rounded px-1.5 py-1 text-[10px] tabular-nums placeholder:text-neutral-600"
            />
            <button
              onClick={addEntry}
              disabled={!draftCategory.trim() || !draftAmount.trim()}
              className="p-1 rounded bg-[hsl(142,70%,45%)]/15 text-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,45%)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Добавить"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpensesWidgetSettings({
  data,
  onChange,
}: {
  data: ExpensesWidgetData;
  onChange: (data: ExpensesWidgetData) => void;
}) {
  const entries = data.entries ?? [];
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  const addEntry = () => {
    if (!date) return;
    const value = parseFloat(amount.replace(",", "."));
    if (!category.trim() || !Number.isFinite(value) || value <= 0) return;
    onChange({
      entries: [
        ...entries,
        { id: newExpenseId(), date, category: category.trim(), amount: Math.round(value * 100) / 100 },
      ],
    });
    setCategory("");
    setAmount("");
  };

  const removeEntry = (id: string) => {
    onChange({ entries: entries.filter((e) => e.id !== id) });
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-lg border border-border/50 p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground">Новая запись</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Сумма, ₽"
            className="bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addEntry();
            }}
            placeholder="Категория (продукты, транспорт...)"
            className="flex-1 min-w-0 bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
          />
          <button
            onClick={addEntry}
            disabled={!category.trim() || !amount.trim() || !date}
            className="p-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Добавить"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {entries.length === 0 && (
        <p className="text-[10px] text-muted-foreground/60 text-center">Записей пока нет</p>
      )}

      {/* Entries list */}
      {sorted.map((entry) => (
        <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatShortDate(entry.date)} {entry.date.slice(0, 4)}
          </span>
          <span className="flex-1 text-xs text-foreground truncate">{entry.category}</span>
          <span className="text-xs text-[hsl(9,100%,64%)] tabular-nums shrink-0">
            {formatAmount(entry.amount)}
          </span>
          <button
            onClick={() => removeEntry(entry.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Удалить"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}