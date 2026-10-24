import { useState, useCallback, useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "device_update" | "scenario_run" | "command_sent" | "command_result" | "ws_connect" | "ws_disconnect";
  deviceId?: string;
  deviceName?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LogFilter {
  type: string;
  deviceId: string;
  search: string;
}

const MAX_ENTRIES = 500;
const STORAGE_KEY = "eng_event_log_v1";

function loadLog(): LogEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // quota exceeded — silently drop
  }
}

export function useEventLog() {
  const [entries, setEntries] = useState<LogEntry[]>(loadLog);
  const [filter, setFilter] = useState<LogFilter>({ type: "", deviceId: "", search: "" });
  const idCounter = useRef(0);

  useEffect(() => {
    saveLog(entries);
  }, [entries]);

  // Listen for external log entries (from logAction in device cards)
  useEffect(() => {
    const handler = (e: Event) => {
      const entry = (e as CustomEvent<LogEntry>).detail;
      setEntries((prev) => {
        // Deduplicate by id
        if (prev.some((p) => p.id === entry.id)) return prev;
        return [...prev.slice(-(MAX_ENTRIES - 1)), entry];
      });
    };
    window.addEventListener("eng-log-entry", handler);
    return () => window.removeEventListener("eng-log-entry", handler);
  }, []);

  const addEntry = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${++idCounter.current}`,
      timestamp: Date.now(),
    };
    setEntries((prev) => [...prev.slice(-(MAX_ENTRIES - 1)), newEntry]);
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const filtered = entries.filter((e) => {
    if (filter.type && e.type !== filter.type) return false;
    if (filter.deviceId && e.deviceId !== filter.deviceId) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!e.message.toLowerCase().includes(q) && !(e.deviceName ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const exportJSON = useCallback(() => {
    return JSON.stringify(filtered, null, 2);
  }, [filtered]);

  return {
    entries: filtered,
    allEntries: entries,
    addEntry,
    clear,
    filter,
    setFilter,
    exportJSON,
  };
}
