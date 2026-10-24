import { useState, useMemo } from "react";
import { Plus, Trash2, CheckSquare } from "lucide-react";
import type { TasksWidgetData } from "@/hooks/use-dashboard-layout";

interface TasksWidgetProps {
  data: TasksWidgetData;
  onChange?: (data: TasksWidgetData) => void;
  readOnly?: boolean;
}

let taskSeq = 0;
function newTaskId() {
  return `task_${Date.now()}_${taskSeq++}`;
}

export function TasksWidget({ data, onChange, readOnly = false }: TasksWidgetProps) {
  const tasks = data.tasks ?? [];
  const [draft, setDraft] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const toggleTask = (id: string) => {
    onChange?.({
      tasks: tasks.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined }
          : t
      ),
    });
  };

  const addTask = () => {
    const text = draft.trim();
    if (!text) return;
    onChange?.({ tasks: [...tasks, { id: newTaskId(), text, done: false }] });
    setDraft("");
  };

  const removeTask = (id: string) => {
    onChange?.({ tasks: tasks.filter((t) => t.id !== id) });
  };

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => Number(a.done) - Number(b.done)),
    [tasks]
  );

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[hsl(217,91%,60%)]" />
          <span className="text-xs font-medium text-neutral-400">Задачи</span>
        </div>
        {tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {doneCount}/{tasks.length}
          </span>
        )}
      </div>

      {tasks.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-2xl mb-1">✅</span>
          <span className="text-xs text-neutral-500">Задач нет</span>
          {!readOnly && (
            <span className="text-[10px] text-neutral-600 mt-0.5">Добавьте задачи ниже</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="mt-2 shrink-0">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(38,95%,64%)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-1">
          {sorted.map((task) => (
            <div key={task.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.04]">
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  task.done
                    ? "bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)]"
                    : "border-border/60 hover:border-[hsl(217,91%,60%)]/60"
                }`}
                aria-label={task.done ? "Отметить незавершённой" : "Отметить выполненной"}
              >
                {task.done && <span className="text-[7px] text-white font-bold">✓</span>}
              </button>
              <span
                className={`flex-1 text-[11px] transition-all ${
                  task.done ? "text-neutral-600 line-through" : "text-neutral-200"
                }`}
              >
                {task.text}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeTask(task.id)}
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
              if (e.key === "Enter") addTask();
            }}
            placeholder="Новая задача..."
            className="flex-1 min-w-0 bg-transparent border border-border/50 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[hsl(217,91%,60%)]/50 placeholder:text-neutral-600"
          />
          <button
            onClick={addTask}
            disabled={!draft.trim()}
            className="p-1.5 rounded-lg bg-[hsl(217,91%,60%)]/15 text-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,60%)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Добавить"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}