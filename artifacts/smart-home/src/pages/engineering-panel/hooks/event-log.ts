import type { LogEntry } from "./use-event-log";

const MAX_ENTRIES = 500;
const STORAGE_KEY = "eng_event_log_v1";

/** Log an action from anywhere (device cards, AC controls, etc.) */
export function logAction(entry: Omit<LogEntry, "id" | "timestamp">) {
  const newEntry: LogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };

  // Append to localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const entries: LogEntry[] = saved ? JSON.parse(saved) : [];
    entries.push(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // quota exceeded
  }

  // Notify subscribers (useEventLog instances)
  window.dispatchEvent(new CustomEvent("eng-log-entry", { detail: newEntry }));
}
