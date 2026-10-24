import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2 } from "lucide-react";
import type { CalendarWidgetData, CalendarEvent } from "@/hooks/use-dashboard-layout";

interface CalendarWidgetProps {
  data: CalendarWidgetData;
  onChange?: (data: CalendarWidgetData) => void;
  readOnly?: boolean;
}

let calendarSeq = 0;
function newCalendarEventId() {
  return `cal_${Date.now()}_${calendarSeq++}`;
}

function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function CalendarWidget({ data, onChange, readOnly = false }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState(todayLocalISO());
  const events = data.events ?? [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthName = currentDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    return map;
  }, [events]);

  const today = todayLocalISO();

  const days = useMemo(() => {
    const result: (number | null)[] = [];
    // Пустые ячейки до первого дня
    for (let i = 0; i < firstDayOfMonth; i++) {
      result.push(null);
    }
    // Дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
      result.push(i);
    }
    return result;
  }, [firstDayOfMonth, daysInMonth]);

  const formatDay = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const addEvent = () => {
    const title = draftTitle.trim();
    if (!title || !draftDate) return;
    onChange?.({
      events: [
        ...events,
        { id: newCalendarEventId(), title, date: draftDate, color: "#D4A843", reminder: false },
      ],
    });
    setDraftTitle("");
  };

  const removeEvent = (id: string) => {
    onChange?.({ events: events.filter((e) => e.id !== id) });
  };

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [events, today]
  );

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1))}
          className="p-0.5 rounded text-neutral-500 hover:text-[#d4af37] transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <span className="text-xs font-medium text-neutral-200 capitalize">{monthName}</span>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1))}
          className="p-0.5 rounded text-neutral-500 hover:text-[#d4af37] transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-0.5 mb-1 shrink-0">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div key={d} className="text-[8px] text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5 flex-1 min-h-0">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;

          const dateStr = formatDay(day);
          const dayEvents = eventsByDate[dateStr] ?? [];
          const isToday = dateStr === today;
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={dateStr}
              className={`relative flex flex-col items-center justify-center rounded text-[9px] ${
                isToday
                  ? "bg-primary text-primary-foreground font-bold"
                  : hasEvents
                  ? "bg-muted/50 text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span>{day}</span>
              {hasEvents && !isToday && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(38,95%,64%)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming events */}
      {events.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/20 shrink-0">
          <span className="text-[9px] text-muted-foreground">Ближайшие:</span>
          <div className="mt-1 space-y-0.5 max-h-12 overflow-y-auto">
            {upcoming.map((event) => (
              <div key={event.id} className="flex items-center gap-1 text-[9px]">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: event.color ?? "#D4A843" }}
                />
                <span className="truncate text-foreground">{event.title}</span>
                {event.reminder && <Bell className="w-2 h-2 text-muted-foreground shrink-0" />}
                {!readOnly && (
                  <button
                    onClick={() => removeEvent(event.id)}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 ml-auto"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick add */}
      {!readOnly && (
        <div className="mt-2 pt-2 border-t border-border/20 shrink-0">
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-[86px] shrink-0 bg-transparent border border-border/50 rounded px-1 py-1 text-[9px] text-muted-foreground"
            />
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEvent();
              }}
              placeholder="Новое событие..."
              className="flex-1 min-w-0 bg-transparent border border-border/50 rounded px-1.5 py-1 text-[9px] placeholder:text-neutral-600"
            />
            <button
              onClick={addEvent}
              disabled={!draftTitle.trim() || !draftDate}
              className="p-1 rounded bg-[#d4af37]/15 text-[#f3e5ab] hover:bg-[#d4af37]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Добавить событие"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CalendarWidgetSettings({
  data,
  onChange,
}: {
  data: CalendarWidgetData;
  onChange: (data: CalendarWidgetData) => void;
}) {
  const events = data.events ?? [];
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [color, setColor] = useState("#D4A843");
  const [reminder, setReminder] = useState(false);

  const addEvent = () => {
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    onChange({
      events: [...events, { id: newCalendarEventId(), title: trimmed, date, color, reminder }],
    });
    setTitle("");
  };

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-lg border border-border/50 p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground">Новое событие</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название события"
          className="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded border border-border/50"
            title="Цвет события"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={reminder}
              onChange={(e) => setReminder(e.target.checked)}
              className="accent-[#d4af37]"
            />
            Напоминание
          </label>
          <button
            onClick={addEvent}
            disabled={!title.trim() || !date}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d4af37]/15 text-[#f3e5ab] hover:bg-[#d4af37]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium"
          >
            <Plus className="w-3 h-3" />
            Добавить
          </button>
        </div>
      </div>

      {events.length === 0 && (
        <p className="text-[10px] text-muted-foreground/60 text-center">Событий пока нет</p>
      )}

      {/* Events list */}
      {sorted.map((event) => (
        <div key={event.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: event.color ?? "#D4A843" }}
          />
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{event.date}</span>
          <span className="flex-1 text-xs text-foreground truncate">{event.title}</span>
          {event.reminder && <Bell className="w-3 h-3 text-muted-foreground shrink-0" />}
          <button
            onClick={() => onChange({ events: events.filter((e) => e.id !== event.id) })}
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